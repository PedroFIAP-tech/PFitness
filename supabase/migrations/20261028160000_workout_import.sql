-- =====================================================================
-- Importar treino por texto (IA) + observação por exercício, dia da
-- semana na ficha e limite diário de uso da IA.
--
-- Erros (SQLSTATE):
--   28000  não autenticado
--   22023  parâmetro inválido
--   PF001  sem letra livre (26 fichas ativas)
--   PF003  exercício inexistente ou não visível
--   PF014  há um treino em andamento (Substituir fichas)
--   PF030  limite diário de uso da IA atingido
-- =====================================================================

-- ---------------------------------------------------------------------
-- Colunas novas
-- ---------------------------------------------------------------------
alter table public.plan_exercises
  add column if not exists notes text check (char_length(notes) <= 200);

-- 0 = domingo … 6 = sábado (como Date.getDay)
alter table public.workout_plans
  add column if not exists weekday smallint check (weekday between 0 and 6);

-- ---------------------------------------------------------------------
-- Letras únicas só entre fichas ativas: as arquivadas guardam a letra
-- antiga (o histórico continua apontando para elas) e as novas podem
-- recomeçar em A.
-- ---------------------------------------------------------------------
do $$
declare
  v_name text;
begin
  select c.conname into v_name
  from pg_constraint c
  where c.conrelid = 'public.workout_plans'::regclass
    and c.contype = 'u'
    and (
      select array_agg(a.attname::text order by a.attname)
      from pg_attribute a
      where a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    ) = array['code', 'user_id'];

  if v_name is not null then
    execute format('alter table public.workout_plans drop constraint %I', v_name);
  end if;
end;
$$;

create unique index if not exists workout_plans_active_code
  on public.workout_plans (user_id, code)
  where not archived;

-- ---------------------------------------------------------------------
-- save_workout_plan: agora com dia da semana e observação.
-- A assinatura mudou, então a versão antiga sai (senão viraria overload).
--
-- p_exercises: [{ "exercise_id": 1, "target_sets": 4, "target_reps": 10,
--                 "rest_seconds": 90, "notes": "cada perna" }, ...]
-- ---------------------------------------------------------------------
drop function if exists public.save_workout_plan(text, jsonb, bigint);

create or replace function public.save_workout_plan(
  p_title     text,
  p_exercises jsonb,
  p_plan_id   bigint default null,
  p_weekday   smallint default null
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
    -- Primeira letra livre entre as fichas ativas
    select chr(c) into v_code
    from generate_series(ascii('A'), ascii('Z')) as c
    where not exists (
      select 1 from public.workout_plans p
      where p.user_id = v_user and p.code = chr(c) and not p.archived
    )
    order by c
    limit 1;

    if v_code is null then
      raise exception 'plan limit reached' using errcode = 'PF001';
    end if;

    insert into public.workout_plans (user_id, code, title, position, weekday)
    values (
      v_user,
      v_code,
      coalesce(v_title, 'Treino ' || v_code),
      coalesce((select max(p.position) + 1 from public.workout_plans p where p.user_id = v_user), 0),
      p_weekday
    )
    returning id into v_plan_id;
  else
    update public.workout_plans p
    set title = coalesce(v_title, 'Treino ' || p.code),
        weekday = p_weekday
    where p.id = p_plan_id and not p.archived
    returning p.id into v_plan_id;

    if v_plan_id is null then
      raise exception 'plan not found' using errcode = 'PF002';
    end if;

    delete from public.plan_exercises pe where pe.plan_id = v_plan_id;
  end if;

  v_expected := jsonb_array_length(p_exercises);

  -- O join com exercises passa pelo RLS: ids de exercícios privados de
  -- outros usuários somem aqui e a contagem abaixo acusa.
  insert into public.plan_exercises (plan_id, exercise_id, position, target_sets, target_reps, rest_seconds, notes)
  select
    v_plan_id,
    e.id,
    item.ord,
    (item.value ->> 'target_sets')::smallint,
    (item.value ->> 'target_reps')::smallint,
    coalesce((item.value ->> 'rest_seconds')::smallint, 90),
    nullif(btrim(item.value ->> 'notes'), '')
  from jsonb_array_elements(p_exercises) with ordinality as item(value, ord)
  join public.exercises e on e.id = (item.value ->> 'exercise_id')::bigint;

  get diagnostics v_inserted = row_count;
  if v_inserted <> v_expected then
    raise exception 'invalid exercise' using errcode = 'PF003';
  end if;

  return v_plan_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Importa fichas revisadas numa transação só: cria os exercícios novos
-- (reaproveitando um do usuário com o mesmo nome e equipamento), arquiva
-- as fichas atuais se p_replace e salva cada ficha com save_workout_plan.
--
-- p_plans: [{
--   "title": "Costas", "weekday": 1,
--   "exercises": [
--     { "exercise_id": 10, "target_sets": 3, "target_reps": 12, "notes": null },
--     { "new_exercise": { "name": "Stiff com halteres", "muscle_group": "Pernas",
--                         "equipment": "Halter" },
--       "target_sets": 3, "target_reps": 12, "notes": null }
--   ]
-- }, ...]
-- Retorna os ids das fichas criadas, na ordem.
-- ---------------------------------------------------------------------
create or replace function public.import_workout_plans(p_plans jsonb, p_replace boolean default false)
returns bigint[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_plan      jsonb;
  v_item      jsonb;
  v_new       jsonb;
  v_exercises jsonb;
  v_ex_id     bigint;
  v_name      text;
  v_equipment text;
  v_ids       bigint[] := '{}';
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_plans) is distinct from 'array'
     or jsonb_array_length(p_plans) = 0
     or jsonb_array_length(p_plans) > 26 then
    raise exception 'p_plans must be a non-empty json array (max 26)' using errcode = '22023';
  end if;

  if p_replace then
    if exists (
      select 1 from public.workout_sessions s
      where s.user_id = v_user and s.status = 'em_andamento'
    ) then
      raise exception 'workout in progress' using errcode = 'PF014';
    end if;

    update public.workout_plans p set archived = true
    where p.user_id = v_user and not p.archived;
  end if;

  for v_plan in select value from jsonb_array_elements(p_plans) loop
    if jsonb_typeof(v_plan -> 'exercises') is distinct from 'array' then
      raise exception 'plan exercises must be a json array' using errcode = '22023';
    end if;

    v_exercises := '[]'::jsonb;
    for v_item in select value from jsonb_array_elements(v_plan -> 'exercises') loop
      v_new := v_item -> 'new_exercise';

      if v_new is null or jsonb_typeof(v_new) = 'null' then
        v_ex_id := (v_item ->> 'exercise_id')::bigint;
      else
        v_name := nullif(btrim(v_new ->> 'name'), '');
        v_equipment := nullif(btrim(v_new ->> 'equipment'), '');
        if v_name is null or char_length(v_name) > 60
           or nullif(btrim(v_new ->> 'muscle_group'), '') is null then
          raise exception 'invalid new exercise' using errcode = '22023';
        end if;

        select e.id into v_ex_id
        from public.exercises e
        where e.user_id = v_user
          and lower(e.name) = lower(v_name)
          and e.equipment is not distinct from v_equipment
        limit 1;

        if v_ex_id is null then
          insert into public.exercises (user_id, name, muscle_group, equipment, weight_increment)
          values (
            v_user,
            v_name,
            btrim(v_new ->> 'muscle_group'),
            v_equipment,
            case v_equipment
              when 'Halter' then 2
              when 'Barra W' then 2
              when 'Máquina' then 5
              when 'Peso corporal' then 1
              else 2.5
            end
          )
          returning id into v_ex_id;
        end if;
      end if;

      v_exercises := v_exercises || jsonb_build_array(jsonb_build_object(
        'exercise_id', v_ex_id,
        'target_sets', v_item -> 'target_sets',
        'target_reps', v_item -> 'target_reps',
        'rest_seconds', coalesce(v_item -> 'rest_seconds', '90'::jsonb),
        'notes', v_item -> 'notes'
      ));
    end loop;

    v_ids := v_ids || public.save_workout_plan(
      v_plan ->> 'title',
      v_exercises,
      null,
      (v_plan ->> 'weekday')::smallint
    );
  end loop;

  return v_ids;
end;
$$;

-- ---------------------------------------------------------------------
-- Uso da IA: o usuário só lê as próprias linhas. Gravar passa por
-- claim_ai_usage (security definer), senão daria para apagar o próprio
-- histórico e zerar o limite.
-- ---------------------------------------------------------------------
create table if not exists public.ai_usage (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('workout_import')),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_kind_created
  on public.ai_usage (user_id, kind, created_at desc);

alter table public.ai_usage enable row level security;

drop policy if exists read_own_ai_usage on public.ai_usage;
create policy read_own_ai_usage on public.ai_usage
  for select using (user_id = auth.uid());

revoke insert, update, delete on public.ai_usage from anon, authenticated;

-- Início de hoje em America/Sao_Paulo, como timestamptz
create or replace function public.ai_usage_today(p_kind text)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::int
  from public.ai_usage u
  where u.user_id = auth.uid()
    and u.kind = p_kind
    and u.created_at >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
$$;

-- ---------------------------------------------------------------------
-- Registra um uso da IA se ainda houver cota hoje. Retorna quantos usos
-- ainda restam depois deste. Erro PF030 se a cota acabou.
-- ---------------------------------------------------------------------
create or replace function public.claim_ai_usage(p_kind text, p_daily_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_used integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind is distinct from 'workout_import' or p_daily_limit is null or p_daily_limit not between 1 and 100 then
    raise exception 'invalid parameters' using errcode = '22023';
  end if;

  -- Serializa os pedidos do mesmo usuário: dois cliques juntos não furam a cota
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_kind, 0));

  select count(*)::int into v_used
  from public.ai_usage u
  where u.user_id = v_user
    and u.kind = p_kind
    and u.created_at >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');

  if v_used >= p_daily_limit then
    raise exception 'daily ai limit reached' using errcode = 'PF030';
  end if;

  insert into public.ai_usage (user_id, kind) values (v_user, p_kind);
  return p_daily_limit - v_used - 1;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões: só usuários logados
-- ---------------------------------------------------------------------
revoke execute on function public.save_workout_plan(text, jsonb, bigint, smallint) from public, anon;
revoke execute on function public.import_workout_plans(jsonb, boolean) from public, anon;
revoke execute on function public.ai_usage_today(text) from public, anon;
revoke execute on function public.claim_ai_usage(text, integer) from public, anon;

grant execute on function public.save_workout_plan(text, jsonb, bigint, smallint) to authenticated;
grant execute on function public.import_workout_plans(jsonb, boolean) to authenticated;
grant execute on function public.ai_usage_today(text) to authenticated;
grant execute on function public.claim_ai_usage(text, integer) to authenticated;
