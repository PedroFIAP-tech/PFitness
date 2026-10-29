-- =====================================================================
-- Conquista nova: seen_at marca quando o usuário viu o desbloqueio (a
-- medalha girando no resumo do treino ou no Perfil). Desbloqueada e
-- seen_at null = conquista nova. As que já existiam contam como vistas.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_achievements' and column_name = 'seen_at'
  ) then
    alter table public.user_achievements add column seen_at timestamptz;
    update public.user_achievements set seen_at = unlocked_at;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- sync_achievements passa a devolver seen_at (o tipo de retorno muda,
-- então a função é recriada). O cálculo é o mesmo de antes.
-- ---------------------------------------------------------------------
drop function if exists public.sync_achievements();

create function public.sync_achievements()
returns table (achievement_id text, progress numeric, target numeric, unlocked_at timestamptz, seen_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user           uuid := auth.uid();
  v_sessions       integer;
  v_streak         integer;
  v_max_kg         numeric;
  v_prs            integer;
  v_max_volume     numeric;
  v_protein_streak integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select count(*) into v_sessions
  from public.workout_sessions ws
  where ws.user_id = v_user and ws.status = 'concluido';

  v_streak := public.longest_streak(v_user);

  select coalesce(max(ss.weight_kg), 0), count(*) filter (where ss.is_pr)
  into v_max_kg, v_prs
  from public.session_sets ss
  join public.workout_sessions ws on ws.id = ss.session_id
  where ws.user_id = v_user and ws.status = 'concluido'
    and ss.status = 'concluida' and ss.reps > 0;

  select coalesce(max(volume), 0) into v_max_volume
  from (
    select sum(ss.weight_kg * ss.reps) as volume
    from public.session_sets ss
    join public.workout_sessions ws on ws.id = ss.session_id
    where ws.user_id = v_user and ws.status = 'concluido' and ss.status = 'concluida'
    group by ws.id
  ) as per_session;

  -- Maior sequência de dias com proteína >= meta vigente no dia
  with goal_days as (
    select n.eaten_on as d
    from public.v_daily_nutrition n
    cross join lateral (
      select g.protein_g
      from public.daily_goals g
      where g.user_id = v_user
      order by (g.valid_from <= n.eaten_on) desc,
               case when g.valid_from <= n.eaten_on then g.valid_from end desc,
               g.valid_from asc
      limit 1
    ) as goal
    where n.user_id = v_user
      and n.eaten_on <= (now() at time zone 'America/Sao_Paulo')::date
      and n.protein_g >= goal.protein_g
  ),
  numbered as (
    select d, d - (row_number() over (order by d))::int as grp from goal_days
  )
  select coalesce(max(len), 0)::int into v_protein_streak
  from (select count(*) as len from numbered group by grp) as groups;

  insert into public.user_achievements (user_id, achievement_id)
  select v_user, a.id
  from public.achievements a
  where (case a.id
           when 'primeiro_treino' then v_sessions
           when 'treinos_50'      then v_sessions
           when 'treinos_100'     then v_sessions
           when 'streak_7'        then v_streak
           when 'streak_30'       then v_streak
           when 'clube_100'       then v_max_kg
           when 'pr_10'           then v_prs
           when 'volume_10t'      then v_max_volume
           when 'proteina_7'      then v_protein_streak
           else 0
         end) >= a.target
  on conflict do nothing;

  return query
  select a.id,
         (case a.id
            when 'primeiro_treino' then v_sessions
            when 'treinos_50'      then v_sessions
            when 'treinos_100'     then v_sessions
            when 'streak_7'        then v_streak
            when 'streak_30'       then v_streak
            when 'clube_100'       then v_max_kg
            when 'pr_10'           then v_prs
            when 'volume_10t'      then v_max_volume
            when 'proteina_7'      then v_protein_streak
            else 0
          end)::numeric,
         a.target,
         ua.unlocked_at,
         ua.seen_at
  from public.achievements a
  left join public.user_achievements ua
    on ua.achievement_id = a.id and ua.user_id = v_user;
end;
$$;

revoke execute on function public.sync_achievements() from public, anon;
grant execute on function public.sync_achievements() to authenticated;
