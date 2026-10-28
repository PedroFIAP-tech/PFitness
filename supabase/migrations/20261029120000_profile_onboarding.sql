-- =====================================================================
-- Perfil + onboarding + metas calculadas + conquistas.
--
-- Erros (SQLSTATE):
--   28000  não autenticado
--   22023  parâmetro inválido
--   23514  valor fora dos checks das tabelas (peso, altura…)
-- =====================================================================

-- "Lanche da manhã". O valor novo não é usado nesta migration (regra do
-- Postgres para ADD VALUE dentro de uma transação).
alter type public.meal_type add value if not exists 'lanche_manha' before 'almoco';

-- ---------------------------------------------------------------------
-- Colunas novas
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists activity_level text
    check (activity_level in ('sedentaria', 'moderada', 'ativa')),
  add column if not exists workouts_per_week smallint
    check (workouts_per_week between 1 and 7),
  add column if not exists dietary_restrictions text[] not null default '{}'
    check (dietary_restrictions <@ array['vegetariano', 'sem_lactose', 'sem_gluten']),
  -- [{ "meal": "cafe", "time": "07:00" }, ...] na ordem do usuário
  add column if not exists meal_plan jsonb
    check (meal_plan is null or jsonb_typeof(meal_plan) = 'array'),
  -- null: onboarding ainda não feito
  add column if not exists onboarded_at timestamptz,
  -- "Ignorar" da sugestão de meta adaptativa
  add column if not exists goal_suggestion_dismissed_at timestamptz;

-- De onde veio a meta: padrão do cadastro, calculada no onboarding ou editada à mão
alter table public.daily_goals
  add column if not exists source text not null default 'padrao'
    check (source in ('padrao', 'calculado', 'personalizado'));

-- ---------------------------------------------------------------------
-- Metas de hoje (America/Sao_Paulo). Um registro por dia: editar de novo
-- no mesmo dia substitui; os dias anteriores ficam no histórico.
-- ---------------------------------------------------------------------
create or replace function public.set_daily_goals(
  p_kcal      integer,
  p_protein_g integer,
  p_carbs_g   integer,
  p_fat_g     integer,
  p_source    text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kcal not between 800 and 6000
     or p_protein_g not between 0 and 600
     or p_carbs_g not between 0 and 1000
     or p_fat_g not between 0 and 400
     or p_source not in ('calculado', 'personalizado') then
    raise exception 'invalid goals' using errcode = '22023';
  end if;

  insert into public.daily_goals (user_id, kcal, protein_g, carbs_g, fat_g, valid_from, source)
  values (v_user, p_kcal, p_protein_g, p_carbs_g, p_fat_g,
          (now() at time zone 'America/Sao_Paulo')::date, p_source)
  on conflict (user_id, valid_from) do update
    set kcal = excluded.kcal,
        protein_g = excluded.protein_g,
        carbs_g = excluded.carbs_g,
        fat_g = excluded.fat_g,
        source = excluded.source;
end;
$$;

-- ---------------------------------------------------------------------
-- Peso de hoje (um registro por dia; registrar de novo substitui).
-- ---------------------------------------------------------------------
create or replace function public.log_weight(p_weight_kg numeric)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.weight_logs (user_id, weight_kg, logged_on)
  values (v_user, round(p_weight_kg, 1), (now() at time zone 'America/Sao_Paulo')::date)
  on conflict (user_id, logged_on) do update set weight_kg = excluded.weight_kg;
end;
$$;

-- ---------------------------------------------------------------------
-- Onboarding (e "Refazer"): perfil, peso do dia e metas numa transação.
--
-- p_meal_plan: [{ "meal": "cafe", "time": "07:00" }, ...] (3 a 6, sem repetir)
-- ---------------------------------------------------------------------
create or replace function public.save_onboarding(
  p_sex               public.sex_type,
  p_birth_date        date,
  p_height_cm         integer,
  p_weight_kg         numeric,
  p_goal              public.goal_type,
  p_activity_level    text,
  p_workouts_per_week integer,
  p_meal_plan         jsonb,
  p_restrictions      text[],
  p_kcal              integer,
  p_protein_g         integer,
  p_carbs_g           integer,
  p_fat_g             integer,
  p_goals_source      text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_item  jsonb;
  v_meals text[] := '{}';
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- 13 a 100 anos
  if p_birth_date is null
     or p_birth_date > v_today - interval '13 years'
     or p_birth_date < v_today - interval '100 years' then
    raise exception 'invalid birth date' using errcode = '22023';
  end if;

  if jsonb_typeof(p_meal_plan) is distinct from 'array'
     or jsonb_array_length(p_meal_plan) not between 3 and 6 then
    raise exception 'meal plan must have 3 to 6 meals' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_meal_plan) loop
    -- O cast valida a refeição contra o enum meal_type
    perform (v_item ->> 'meal')::public.meal_type;
    if coalesce(v_item ->> 'time', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or (v_item ->> 'meal') = any (v_meals) then
      raise exception 'invalid meal plan' using errcode = '22023';
    end if;
    v_meals := v_meals || (v_item ->> 'meal');
  end loop;

  update public.profiles p
  set sex = p_sex,
      birth_date = p_birth_date,
      height_cm = p_height_cm,
      goal = p_goal,
      activity_level = p_activity_level,
      workouts_per_week = p_workouts_per_week,
      meal_plan = p_meal_plan,
      dietary_restrictions = coalesce(p_restrictions, '{}'),
      onboarded_at = now()
  where p.id = v_user;

  perform public.log_weight(p_weight_kg);
  perform public.set_daily_goals(p_kcal, p_protein_g, p_carbs_g, p_fat_g, p_goals_source);
end;
$$;

-- ---------------------------------------------------------------------
-- Conquistas: calcula o progresso de cada uma com os dados reais, grava
-- as que bateram a meta em user_achievements e devolve tudo.
-- Uma conquista desbloqueada continua desbloqueada.
-- ---------------------------------------------------------------------
create or replace function public.sync_achievements()
returns table (achievement_id text, progress numeric, target numeric, unlocked_at timestamptz)
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
         ua.unlocked_at
  from public.achievements a
  left join public.user_achievements ua
    on ua.achievement_id = a.id and ua.user_id = v_user;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões: só usuários logados
-- ---------------------------------------------------------------------
revoke execute on function public.set_daily_goals(integer, integer, integer, integer, text) from public, anon;
revoke execute on function public.log_weight(numeric) from public, anon;
revoke execute on function public.save_onboarding(public.sex_type, date, integer, numeric, public.goal_type, text, integer, jsonb, text[], integer, integer, integer, integer, text) from public, anon;
revoke execute on function public.sync_achievements() from public, anon;

grant execute on function public.set_daily_goals(integer, integer, integer, integer, text) to authenticated;
grant execute on function public.log_weight(numeric) to authenticated;
grant execute on function public.save_onboarding(public.sex_type, date, integer, numeric, public.goal_type, text, integer, jsonb, text[], integer, integer, integer, integer, text) to authenticated;
grant execute on function public.sync_achievements() to authenticated;
