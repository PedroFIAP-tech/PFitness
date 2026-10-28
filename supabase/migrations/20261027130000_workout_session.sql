-- =====================================================================
-- Treino em andamento: sessão, séries, PRs e pontos gravados de forma
-- atômica. Todas as funções são security invoker (rodam com o RLS de quem
-- chama) e são idempotentes onde o app pode reenviar (fila offline).
--
-- Pontos (point_events):
--   série concluída  +10  ref_id = session_sets.id
--   PR               +50  ref_id = session_sets.id
--   treino concluído +100 ref_id = workout_sessions.id
--
-- Erros (SQLSTATE):
--   28000  não autenticado
--   22023  parâmetro inválido
--   PF002  ficha não encontrada
--   PF003  exercício inexistente ou não visível
--   PF010  já existe um treino em andamento de outra ficha
--   PF011  a sessão não está em andamento
--   PF012  sessão não encontrada
--   PF013  nenhuma série concluída (não dá para finalizar)
-- =====================================================================

-- Uma sessão em andamento por usuário (também cobre o toque duplo em Iniciar)
create unique index if not exists workout_sessions_one_in_progress
  on public.workout_sessions (user_id)
  where status = 'em_andamento';

-- ---------------------------------------------------------------------
-- Melhor carga de cada exercício nas sessões que começaram antes da
-- sessão informada. É o "histórico" usado para decidir PR.
-- ---------------------------------------------------------------------
create or replace function public.exercise_bests_before(p_session_id bigint)
returns table (exercise_id bigint, best_kg numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select ss.exercise_id, max(ss.weight_kg)
  from public.workout_sessions cur
  join public.workout_sessions ws
    on ws.user_id = cur.user_id
   and ws.id <> cur.id
   and ws.started_at < cur.started_at
  join public.session_sets ss on ss.session_id = ws.id
  where cur.id = p_session_id
    and cur.user_id = auth.uid()
    and ss.status = 'concluida'
    and ss.reps > 0
  group by ss.exercise_id;
$$;

-- ---------------------------------------------------------------------
-- Descarta um treino em andamento: apaga sessão, séries e pontos.
-- ---------------------------------------------------------------------
create or replace function public.discard_workout(p_session_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_status public.session_status;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select s.status into v_status
  from public.workout_sessions s
  where s.id = p_session_id and s.user_id = v_user
  for update;

  if not found then
    return; -- já descartada
  end if;
  if v_status <> 'em_andamento' then
    raise exception 'session not in progress' using errcode = 'PF011';
  end if;

  delete from public.point_events pe
  where pe.user_id = v_user
    and pe.kind in ('serie', 'pr')
    and pe.ref_id in (select ss.id from public.session_sets ss where ss.session_id = p_session_id);

  -- session_sets vão junto (on delete cascade)
  delete from public.workout_sessions s where s.id = p_session_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Inicia (ou retoma) o treino de uma ficha. Com p_discard_session_id,
-- descarta antes o treino em andamento de outra ficha, na mesma transação.
-- Retorna o id da sessão.
-- ---------------------------------------------------------------------
create or replace function public.start_workout(
  p_plan_id            bigint,
  p_discard_session_id bigint default null
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user        uuid := auth.uid();
  v_active_id   bigint;
  v_active_plan bigint;
  v_title       text;
  v_session_id  bigint;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_discard_session_id is not null then
    perform public.discard_workout(p_discard_session_id);
  end if;

  select s.id, s.plan_id into v_active_id, v_active_plan
  from public.workout_sessions s
  where s.user_id = v_user and s.status = 'em_andamento';

  if v_active_id is not null then
    if v_active_plan is not distinct from p_plan_id then
      return v_active_id;
    end if;
    raise exception 'another workout in progress' using errcode = 'PF010';
  end if;

  select p.title into v_title
  from public.workout_plans p
  where p.id = p_plan_id and p.user_id = v_user;

  if not found then
    raise exception 'plan not found' using errcode = 'PF002';
  end if;

  begin
    insert into public.workout_sessions (user_id, plan_id, plan_title)
    values (v_user, p_plan_id, v_title)
    returning id into v_session_id;
  exception when unique_violation then
    -- Outra requisição iniciou um treino ao mesmo tempo
    select s.id, s.plan_id into v_active_id, v_active_plan
    from public.workout_sessions s
    where s.user_id = v_user and s.status = 'em_andamento';

    if v_active_plan is not distinct from p_plan_id then
      return v_active_id;
    end if;
    raise exception 'another workout in progress' using errcode = 'PF010';
  end;

  return v_session_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Grava (ou substitui) uma série concluída/pulada, decide se é PR e
-- refaz os pontos dela. Reenviar a mesma série não duplica nada.
-- ---------------------------------------------------------------------
create or replace function public.log_set(
  p_session_id  bigint,
  p_exercise_id bigint,
  p_set_number  integer,
  p_weight_kg   numeric,
  p_reps        integer,
  p_status      public.set_status
)
returns table (set_id bigint, is_pr boolean, previous_best numeric)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user    uuid := auth.uid();
  v_history numeric;
  v_best    numeric;
  v_is_pr   boolean := false;
  v_set_id  bigint;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_set_number < 1 or p_weight_kg < 0 or p_reps < 0 then
    raise exception 'invalid set' using errcode = '22023';
  end if;

  -- Trava a sessão: as séries de um treino são gravadas uma de cada vez
  perform 1 from public.workout_sessions s
  where s.id = p_session_id and s.user_id = v_user and s.status = 'em_andamento'
  for update;
  if not found then
    raise exception 'session not in progress' using errcode = 'PF011';
  end if;

  -- O RLS de exercises deixa passar só os globais e os do usuário
  perform 1 from public.exercises e where e.id = p_exercise_id;
  if not found then
    raise exception 'invalid exercise' using errcode = 'PF003';
  end if;

  -- PR = carga acima da melhor já feita (treinos anteriores + séries deste).
  -- Sem histórico anterior a esta sessão não há PR, como no protótipo.
  if p_status = 'concluida' and p_reps > 0 then
    select b.best_kg into v_history
    from public.exercise_bests_before(p_session_id) b
    where b.exercise_id = p_exercise_id;

    if coalesce(v_history, 0) > 0 then
      select greatest(v_history, coalesce(max(ss.weight_kg), 0)) into v_best
      from public.session_sets ss
      where ss.session_id = p_session_id
        and ss.exercise_id = p_exercise_id
        and ss.set_number <> p_set_number
        and ss.status = 'concluida'
        and ss.reps > 0;

      v_is_pr := p_weight_kg > v_best;
    end if;
  end if;

  insert into public.session_sets as ss
    (session_id, exercise_id, set_number, weight_kg, reps, status, is_pr, completed_at)
  values
    (p_session_id, p_exercise_id, p_set_number, p_weight_kg, p_reps, p_status, v_is_pr, now())
  on conflict (session_id, exercise_id, set_number) do update
    set weight_kg    = excluded.weight_kg,
        reps         = excluded.reps,
        status       = excluded.status,
        is_pr        = excluded.is_pr,
        completed_at = excluded.completed_at
  returning ss.id into v_set_id;

  delete from public.point_events pe
  where pe.user_id = v_user and pe.ref_id = v_set_id and pe.kind in ('serie', 'pr');

  if p_status = 'concluida' then
    insert into public.point_events (user_id, kind, points, ref_id)
    values (v_user, 'serie', 10, v_set_id);

    if v_is_pr then
      insert into public.point_events (user_id, kind, points, ref_id)
      values (v_user, 'pr', 50, v_set_id);
    end if;
  end if;

  return query select v_set_id, v_is_pr, v_best;
end;
$$;

-- ---------------------------------------------------------------------
-- Desfaz uma série (concluída ou pulada): apaga a série e estorna os pontos.
-- ---------------------------------------------------------------------
create or replace function public.undo_set(
  p_session_id  bigint,
  p_exercise_id bigint,
  p_set_number  integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_set_id bigint;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform 1 from public.workout_sessions s
  where s.id = p_session_id and s.user_id = v_user and s.status = 'em_andamento'
  for update;
  if not found then
    raise exception 'session not in progress' using errcode = 'PF011';
  end if;

  delete from public.session_sets ss
  where ss.session_id = p_session_id
    and ss.exercise_id = p_exercise_id
    and ss.set_number = p_set_number
  returning ss.id into v_set_id;

  if v_set_id is not null then
    delete from public.point_events pe
    where pe.user_id = v_user and pe.ref_id = v_set_id and pe.kind in ('serie', 'pr');
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Finaliza o treino: status concluido, finished_at e +100 pontos.
-- Retorna a sequência (streak) antes e depois, para a animação do resumo.
-- ---------------------------------------------------------------------
create or replace function public.finish_workout(p_session_id bigint)
returns table (streak_before integer, streak_after integer)
language plpgsql
security invoker
-- current_streak() usa nomes de tabela sem schema: precisa de public no search_path
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_status public.session_status;
  v_before integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select s.status into v_status
  from public.workout_sessions s
  where s.id = p_session_id and s.user_id = v_user
  for update;

  if not found then
    raise exception 'session not found' using errcode = 'PF012';
  end if;

  -- Já finalizada (toque repetido, reenvio): não paga os pontos de novo
  if v_status = 'concluido' then
    return query select public.current_streak(v_user), public.current_streak(v_user);
    return;
  end if;
  if v_status <> 'em_andamento' then
    raise exception 'session not in progress' using errcode = 'PF011';
  end if;

  if not exists (
    select 1 from public.session_sets ss
    where ss.session_id = p_session_id and ss.status = 'concluida'
  ) then
    raise exception 'no completed sets' using errcode = 'PF013';
  end if;

  v_before := public.current_streak(v_user);

  update public.workout_sessions s
  set status = 'concluido', finished_at = now()
  where s.id = p_session_id;

  insert into public.point_events (user_id, kind, points, ref_id)
  values (v_user, 'treino_concluido', 100, p_session_id);

  return query select v_before, public.current_streak(v_user);
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões: só usuários logados
-- ---------------------------------------------------------------------
revoke execute on function public.exercise_bests_before(bigint) from public, anon;
revoke execute on function public.discard_workout(bigint) from public, anon;
revoke execute on function public.start_workout(bigint, bigint) from public, anon;
revoke execute on function public.log_set(bigint, bigint, integer, numeric, integer, public.set_status) from public, anon;
revoke execute on function public.undo_set(bigint, bigint, integer) from public, anon;
revoke execute on function public.finish_workout(bigint) from public, anon;

grant execute on function public.exercise_bests_before(bigint) to authenticated;
grant execute on function public.discard_workout(bigint) to authenticated;
grant execute on function public.start_workout(bigint, bigint) to authenticated;
grant execute on function public.log_set(bigint, bigint, integer, numeric, integer, public.set_status) to authenticated;
grant execute on function public.undo_set(bigint, bigint, integer) to authenticated;
grant execute on function public.finish_workout(bigint) to authenticated;
