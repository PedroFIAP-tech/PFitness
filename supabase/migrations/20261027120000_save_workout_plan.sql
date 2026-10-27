-- =====================================================================
-- save_workout_plan: cria ou atualiza uma ficha e substitui os exercícios
-- dela numa única transação.
--
-- * security invoker: roda com o RLS de quem chama (não ganha permissão extra)
-- * ficha nova recebe a primeira letra livre (A–Z) e a próxima position
-- * exercícios ficam com position 1..n na ordem do array
-- * só aceita exercícios visíveis ao usuário (globais ou dele)
--
-- p_exercises: [{ "exercise_id": 1, "target_sets": 4, "target_reps": 10, "rest_seconds": 90 }, ...]
-- Retorna o id da ficha.
--
-- Erros (SQLSTATE):
--   28000  não autenticado
--   PF001  já existem 26 fichas (sem letra livre)
--   PF002  ficha não encontrada (ou de outro usuário)
--   PF003  exercício inexistente ou não visível
--   23514  séries/reps fora dos limites (checks de plan_exercises)
-- =====================================================================

create or replace function public.save_workout_plan(
  p_title     text,
  p_exercises jsonb,
  p_plan_id   bigint default null
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_plan_id  bigint;
  v_code     text;
  v_title    text := nullif(btrim(p_title), '');
  v_expected integer;
  v_inserted integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if jsonb_typeof(p_exercises) is distinct from 'array' then
    raise exception 'p_exercises must be a json array' using errcode = '22023';
  end if;

  if p_plan_id is null then
    select chr(c) into v_code
    from generate_series(ascii('A'), ascii('Z')) as c
    where not exists (
      select 1 from public.workout_plans p
      where p.user_id = v_user and p.code = chr(c)
    )
    order by c
    limit 1;

    if v_code is null then
      raise exception 'plan limit reached' using errcode = 'PF001';
    end if;

    insert into public.workout_plans (user_id, code, title, position)
    values (
      v_user,
      v_code,
      coalesce(v_title, 'Treino ' || v_code),
      coalesce((select max(p.position) + 1 from public.workout_plans p where p.user_id = v_user), 0)
    )
    returning id into v_plan_id;
  else
    update public.workout_plans p
    set title = coalesce(v_title, 'Treino ' || p.code)
    where p.id = p_plan_id
    returning p.id into v_plan_id;

    if v_plan_id is null then
      raise exception 'plan not found' using errcode = 'PF002';
    end if;

    delete from public.plan_exercises pe where pe.plan_id = v_plan_id;
  end if;

  v_expected := jsonb_array_length(p_exercises);

  -- O join com exercises passa pelo RLS: ids de exercícios privados de
  -- outros usuários somem aqui e a contagem abaixo acusa.
  insert into public.plan_exercises (plan_id, exercise_id, position, target_sets, target_reps, rest_seconds)
  select
    v_plan_id,
    e.id,
    item.ord,
    (item.value ->> 'target_sets')::smallint,
    (item.value ->> 'target_reps')::smallint,
    coalesce((item.value ->> 'rest_seconds')::smallint, 90)
  from jsonb_array_elements(p_exercises) with ordinality as item(value, ord)
  join public.exercises e on e.id = (item.value ->> 'exercise_id')::bigint;

  get diagnostics v_inserted = row_count;
  if v_inserted <> v_expected then
    raise exception 'invalid exercise' using errcode = 'PF003';
  end if;

  return v_plan_id;
end;
$$;

revoke execute on function public.save_workout_plan(text, jsonb, bigint) from public, anon;
grant execute on function public.save_workout_plan(text, jsonb, bigint) to authenticated;
