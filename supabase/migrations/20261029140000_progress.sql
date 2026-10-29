-- =====================================================================
-- Aba Progresso: evolução de carga, calendário de treinos e volume por
-- grupo muscular. Só leitura, funções security invoker (RLS de quem
-- chama), período de no máximo 366 dias até hoje (America/Sao_Paulo).
--
-- Dia de um treino = dia (em America/Sao_Paulo) em que ele foi concluído,
-- a mesma regra de current_streak e activity_days.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Carga por exercício e semana (segunda a domingo): maior carga e maior
-- 1RM estimado (Epley: kg × (1 + reps/30); com 1 rep, a própria carga).
-- Só séries concluídas com carga e pelo menos 1 rep, de treinos concluídos.
-- ---------------------------------------------------------------------
create or replace function public.load_progress(p_from date)
returns table (exercise_id bigint, name text, week_start date, max_kg numeric, best_e1rm numeric, sets integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.id,
         e.name,
         date_trunc('week', ws.finished_at at time zone 'America/Sao_Paulo')::date as week_start,
         max(ss.weight_kg),
         round(max(case when ss.reps = 1 then ss.weight_kg else ss.weight_kg * (1 + ss.reps / 30.0) end), 1),
         count(*)::int
  from public.session_sets ss
  join public.workout_sessions ws on ws.id = ss.session_id
  join public.exercises e on e.id = ss.exercise_id
  where ws.user_id = auth.uid()
    and ws.status = 'concluido'
    and ws.finished_at is not null
    and ss.status = 'concluida'
    and ss.reps > 0
    and ss.weight_kg > 0
    and (ws.finished_at at time zone 'America/Sao_Paulo')::date
        >= greatest(p_from, (now() at time zone 'America/Sao_Paulo')::date - 366)
  group by e.id, e.name, 3
  order by 3, e.name;
$$;

-- ---------------------------------------------------------------------
-- Um dia por linha, de p_from até hoje: volume, treinos, duração, fichas
-- feitas ("A" ou "A+C") e se teve alimentação registrada.
-- ---------------------------------------------------------------------
create or replace function public.training_calendar(p_from date)
returns table (
  day        date,
  volume_kg  numeric,
  sessions   integer,
  duration_s integer,
  plans      text,
  food       boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with days as (
    select g::date as day
    from generate_series(
      greatest(p_from, (now() at time zone 'America/Sao_Paulo')::date - 366),
      (now() at time zone 'America/Sao_Paulo')::date,
      interval '1 day'
    ) as g
  ),
  done as (
    select ws.id,
           (ws.finished_at at time zone 'America/Sao_Paulo')::date as day,
           nullif(wp.code, '') as code,
           extract(epoch from ws.finished_at - ws.started_at) as duration_s
    from public.workout_sessions ws
    left join public.workout_plans wp on wp.id = ws.plan_id
    where ws.user_id = auth.uid()
      and ws.status = 'concluido'
      and ws.finished_at is not null
      and (ws.finished_at at time zone 'America/Sao_Paulo')::date >= (select min(day) from days)
  ),
  volume as (
    select ss.session_id, sum(ss.weight_kg * ss.reps) as volume_kg
    from public.session_sets ss
    where ss.session_id in (select id from done) and ss.status = 'concluida'
    group by ss.session_id
  )
  select days.day,
         coalesce(sum(volume.volume_kg), 0),
         count(done.id)::int,
         coalesce(sum(done.duration_s), 0)::int,
         string_agg(distinct done.code, '+' order by done.code),
         exists (
           select 1 from public.food_logs fl
           where fl.user_id = auth.uid() and fl.eaten_on = days.day
         )
  from days
  left join done on done.day = days.day
  left join volume on volume.session_id = done.id
  group by days.day
  order by days.day;
$$;

-- ---------------------------------------------------------------------
-- Volume (kg × reps) e séries por grupo muscular desde p_from.
-- ---------------------------------------------------------------------
create or replace function public.muscle_volume(p_from date)
returns table (muscle_group text, volume_kg numeric, sets integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.muscle_group, sum(ss.weight_kg * ss.reps), count(*)::int
  from public.session_sets ss
  join public.workout_sessions ws on ws.id = ss.session_id
  join public.exercises e on e.id = ss.exercise_id
  where ws.user_id = auth.uid()
    and ws.status = 'concluido'
    and ws.finished_at is not null
    and ss.status = 'concluida'
    and (ws.finished_at at time zone 'America/Sao_Paulo')::date
        >= greatest(p_from, (now() at time zone 'America/Sao_Paulo')::date - 366)
  group by e.muscle_group
  order by 2 desc, 1;
$$;

-- ---------------------------------------------------------------------
-- Permissões: só usuários logados
-- ---------------------------------------------------------------------
revoke execute on function public.load_progress(date) from public, anon;
revoke execute on function public.training_calendar(date) from public, anon;
revoke execute on function public.muscle_volume(date) from public, anon;

grant execute on function public.load_progress(date) to authenticated;
grant execute on function public.training_calendar(date) to authenticated;
grant execute on function public.muscle_volume(date) to authenticated;
