-- =====================================================================
-- Aba Hoje: recorde de sequência, atividade e pontos por dia. Só leitura,
-- funções security invoker (rodam com o RLS de quem chama).
--
-- Regra do dia ativo (a mesma de current_streak): o dia conta se teve
-- treino concluído OU alimentação registrada, em America/Sao_Paulo.
-- Ao mudar essa regra, mude current_streak e longest_streak juntas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Maior sequência de dias ativos de todo o histórico (até hoje).
-- Mesmas CTEs de current_streak; aqui vale o maior grupo, não o último.
-- ---------------------------------------------------------------------
create or replace function public.longest_streak(p_user uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  with active_days as (
    select (finished_at at time zone 'America/Sao_Paulo')::date as d
    from public.workout_sessions
    where user_id = p_user and status = 'concluido'
    union
    select eaten_on from public.food_logs where user_id = p_user
  ),
  numbered as (
    select d, d - (row_number() over (order by d))::int as grp
    from active_days
    where d <= (now() at time zone 'America/Sao_Paulo')::date
  )
  select coalesce(max(len), 0)::int
  from (select count(*) as len from numbered group by grp) as groups;
$$;

-- ---------------------------------------------------------------------
-- Um dia por linha, de p_from até hoje (no máximo 366 dias): se teve
-- treino concluído e se teve alimentação registrada.
-- ---------------------------------------------------------------------
create or replace function public.activity_days(p_from date)
returns table (day date, workout boolean, food boolean)
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
  )
  select days.day,
         exists (
           select 1 from public.workout_sessions ws
           where ws.user_id = auth.uid()
             and ws.status = 'concluido'
             and (ws.finished_at at time zone 'America/Sao_Paulo')::date = days.day
         ),
         exists (
           select 1 from public.food_logs fl
           where fl.user_id = auth.uid() and fl.eaten_on = days.day
         )
  from days
  order by days.day;
$$;

-- ---------------------------------------------------------------------
-- Pontos ganhos por dia (pelo horário do evento), de p_from até hoje
-- (no máximo 366 dias). Dias sem pontos vêm com 0.
-- ---------------------------------------------------------------------
create or replace function public.points_by_day(p_from date)
returns table (day date, points integer)
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
  )
  select days.day, coalesce(sum(pe.points), 0)::int
  from days
  left join public.point_events pe
    on pe.user_id = auth.uid()
   and (pe.created_at at time zone 'America/Sao_Paulo')::date = days.day
  group by days.day
  order by days.day;
$$;

-- ---------------------------------------------------------------------
-- Permissões: só usuários logados
-- ---------------------------------------------------------------------
revoke execute on function public.longest_streak(uuid) from public, anon;
revoke execute on function public.activity_days(date) from public, anon;
revoke execute on function public.points_by_day(date) from public, anon;

grant execute on function public.longest_streak(uuid) to authenticated;
grant execute on function public.activity_days(date) to authenticated;
grant execute on function public.points_by_day(date) to authenticated;
