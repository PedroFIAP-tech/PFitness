-- =====================================================================
-- PFitness — Schema do banco (Supabase / PostgreSQL)
-- Fase 1: treino + alimentação + gamificação básica
-- Rodar no SQL Editor do Supabase (de cima pra baixo)
-- =====================================================================

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type goal_type      as enum ('ganhar_massa', 'perder_gordura', 'manter');
create type sex_type       as enum ('masculino', 'feminino', 'outro');
create type session_status as enum ('em_andamento', 'concluido', 'cancelado');
create type set_status     as enum ('concluida', 'pulada');
create type meal_type      as enum ('cafe', 'almoco', 'lanche', 'jantar', 'ceia');
create type point_kind     as enum ('serie', 'pr', 'treino_concluido', 'alimento', 'conquista', 'bonus');

-- ---------------------------------------------------------------------
-- USUÁRIO
-- ---------------------------------------------------------------------
-- Perfil ligado ao auth.users do Supabase (1:1)
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  birth_date  date,
  sex         sex_type,
  height_cm   smallint check (height_cm between 100 and 250),
  goal        goal_type not null default 'manter',
  created_at  timestamptz not null default now()
);

-- Metas diárias com histórico (a vigente é a de valid_from mais recente)
create table daily_goals (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  kcal        smallint not null check (kcal > 0),
  protein_g   smallint not null check (protein_g >= 0),
  carbs_g     smallint not null check (carbs_g >= 0),
  fat_g       smallint not null check (fat_g >= 0),
  valid_from  date not null default current_date,
  unique (user_id, valid_from)
);

-- Peso corporal (1 registro por dia)
create table weight_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  weight_kg   numeric(5,2) not null check (weight_kg between 20 and 400),
  logged_on   date not null default current_date,
  unique (user_id, logged_on)
);

-- ---------------------------------------------------------------------
-- TREINO
-- ---------------------------------------------------------------------
-- Biblioteca de exercícios. user_id null = exercício global; preenchido = criado pelo usuário
create table exercises (
  id                bigint generated always as identity primary key,
  user_id           uuid references profiles(id) on delete cascade,
  name              text not null,
  muscle_group      text not null,           -- Peito, Costas, Pernas, Ombros, Bíceps, Tríceps, Abdômen
  equipment         text,                    -- Barra, Halter, Máquina, Polia, Peso corporal
  weight_increment  numeric(4,2) not null default 2.5,  -- passo da roleta de kg
  created_at        timestamptz not null default now()
);

-- Fichas (Treino A, B, C, D...)
create table workout_plans (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  code        varchar(2) not null,           -- A, B, C...
  title       text not null,                 -- Peito e Tríceps
  position    smallint not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, code)
);

-- Exercícios dentro de uma ficha
create table plan_exercises (
  id            bigint generated always as identity primary key,
  plan_id       bigint not null references workout_plans(id) on delete cascade,
  exercise_id   bigint not null references exercises(id),
  position      smallint not null,
  target_sets   smallint not null check (target_sets between 1 and 20),
  target_reps   smallint not null check (target_reps between 1 and 100),
  rest_seconds  smallint not null default 90,
  unique (plan_id, position)
);

-- Uma execução de treino
create table workout_sessions (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references profiles(id) on delete cascade,
  plan_id      bigint references workout_plans(id) on delete set null,
  plan_title   text,                          -- snapshot do nome (se a ficha mudar depois)
  status       session_status not null default 'em_andamento',
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);

-- Cada série registrada
create table session_sets (
  id            bigint generated always as identity primary key,
  session_id    bigint not null references workout_sessions(id) on delete cascade,
  exercise_id   bigint not null references exercises(id),
  set_number    smallint not null,
  weight_kg     numeric(6,2) not null default 0,
  reps          smallint not null default 0,
  status        set_status not null,
  is_pr         boolean not null default false, -- snapshot: era PR no momento em que foi feita
  completed_at  timestamptz not null default now(),
  unique (session_id, exercise_id, set_number)
);

-- ---------------------------------------------------------------------
-- ALIMENTAÇÃO
-- ---------------------------------------------------------------------
-- Base de alimentos (valores por 100 g). user_id null = base global (TACO)
create table foods (
  id              bigint generated always as identity primary key,
  user_id         uuid references profiles(id) on delete cascade,
  name            text not null,
  kcal_100g       numeric(6,1) not null,
  protein_100g    numeric(5,1) not null,
  carbs_100g      numeric(5,1) not null,
  fat_100g        numeric(5,1) not null,
  default_grams   smallint not null default 100,
  source          text default 'TACO'
);

-- Cada alimento consumido (a "refeição" é o agrupamento por data + meal_type)
create table food_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  food_id     bigint not null references foods(id),
  eaten_on    date not null default current_date,
  meal        meal_type not null,
  grams       numeric(6,1) not null check (grams > 0),
  logged_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- GAMIFICAÇÃO
-- ---------------------------------------------------------------------
-- Extrato de pontos (XP total = soma)
create table point_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        point_kind not null,
  points      integer not null,
  ref_id      bigint,                        -- id da série / sessão / food_log que gerou
  created_at  timestamptz not null default now()
);

-- Catálogo de conquistas
create table achievements (
  id           text primary key,             -- 'streak_7', 'clube_100'...
  name         text not null,
  description  text not null,
  target       numeric not null,             -- meta (7 dias, 100 kg, 50 treinos...)
  badge_code   text not null,                -- texto do hexágono: '7', '100', '10t'
  badge_unit   text not null                 -- 'DIAS', 'KG', 'TREINOS'
);

create table user_achievements (
  user_id         uuid not null references profiles(id) on delete cascade,
  achievement_id  text not null references achievements(id),
  unlocked_at     timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ---------------------------------------------------------------------
-- ÍNDICES
-- ---------------------------------------------------------------------
create index on daily_goals (user_id, valid_from desc);
create index on weight_logs (user_id, logged_on desc);
create index on workout_plans (user_id);
create index on plan_exercises (plan_id);
create index on workout_sessions (user_id, started_at desc);
create index on session_sets (exercise_id, completed_at desc);
create index on food_logs (user_id, eaten_on);
create index on point_events (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- VIEWS (cálculos que as telas usam)
-- ---------------------------------------------------------------------
-- Melhor carga por exercício (chip "PR 42,5 kg")
create view v_exercise_best with (security_invoker = on) as
select ws.user_id, ss.exercise_id, max(ss.weight_kg) as best_kg
from session_sets ss
join workout_sessions ws on ws.id = ss.session_id
where ss.status = 'concluida' and ss.reps > 0
group by ws.user_id, ss.exercise_id;

-- Séries da última sessão concluída de cada exercício ("última 40 × 10")
create view v_exercise_last with (security_invoker = on) as
with last_session as (
  select distinct on (ws.user_id, ss.exercise_id)
         ws.user_id, ss.exercise_id, ss.session_id
  from session_sets ss
  join workout_sessions ws on ws.id = ss.session_id
  where ws.status = 'concluido' and ss.status = 'concluida'
  order by ws.user_id, ss.exercise_id, ws.started_at desc
)
select ls.user_id, ls.exercise_id, ss.set_number, ss.weight_kg, ss.reps
from last_session ls
join session_sets ss on ss.session_id = ls.session_id
                    and ss.exercise_id = ls.exercise_id
                    and ss.status = 'concluida';

-- Totais de nutrição por dia e refeição
create view v_food_log_detail with (security_invoker = on) as
select fl.id, fl.user_id, fl.eaten_on, fl.meal, fl.logged_at, fl.grams,
       f.name,
       round(f.kcal_100g    * fl.grams / 100, 1) as kcal,
       round(f.protein_100g * fl.grams / 100, 1) as protein_g,
       round(f.carbs_100g   * fl.grams / 100, 1) as carbs_g,
       round(f.fat_100g     * fl.grams / 100, 1) as fat_g
from food_logs fl
join foods f on f.id = fl.food_id;

create view v_daily_nutrition with (security_invoker = on) as
select user_id, eaten_on,
       sum(kcal) as kcal, sum(protein_g) as protein_g,
       sum(carbs_g) as carbs_g, sum(fat_g) as fat_g
from v_food_log_detail
group by user_id, eaten_on;

-- XP total e nível (800 XP por nível)
create view v_user_xp with (security_invoker = on) as
select user_id,
       sum(points)                        as xp,
       floor(sum(points) / 800)::int + 1  as level
from point_events
group by user_id;

-- ---------------------------------------------------------------------
-- STREAK (calculada, não salva)
-- Regra: o dia conta se teve treino concluído OU alimentação registrada.
-- Hoje ainda sem atividade não quebra a sequência.
-- ---------------------------------------------------------------------
create or replace function current_streak(p_user uuid)
returns integer
language sql stable
as $$
  with active_days as (
    select (finished_at at time zone 'America/Sao_Paulo')::date as d
    from workout_sessions
    where user_id = p_user and status = 'concluido'
    union
    select eaten_on from food_logs where user_id = p_user
  ),
  numbered as (
    select d, d - (row_number() over (order by d))::int as grp
    from active_days
    where d <= (now() at time zone 'America/Sao_Paulo')::date
  ),
  last_group as (
    select grp, max(d) as last_day, count(*) as len
    from numbered
    group by grp
    order by max(d) desc
    limit 1
  )
  select coalesce(
    (select len::int from last_group
     where last_day >= (now() at time zone 'America/Sao_Paulo')::date - 1),
    0);
$$;

-- ---------------------------------------------------------------------
-- RLS (cada usuário só enxerga os próprios dados)
-- ---------------------------------------------------------------------
alter table profiles          enable row level security;
alter table daily_goals       enable row level security;
alter table weight_logs       enable row level security;
alter table exercises         enable row level security;
alter table workout_plans     enable row level security;
alter table plan_exercises    enable row level security;
alter table workout_sessions  enable row level security;
alter table session_sets      enable row level security;
alter table foods             enable row level security;
alter table food_logs         enable row level security;
alter table point_events      enable row level security;
alter table achievements      enable row level security;
alter table user_achievements enable row level security;

create policy own_profile on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy own_rows on daily_goals       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on weight_logs       for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on workout_plans     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on workout_sessions  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on food_logs         for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on point_events      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on user_achievements for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Globais (user_id null) visíveis pra todos; próprios editáveis
create policy read_exercises  on exercises for select using (user_id is null or user_id = auth.uid());
create policy write_exercises on exercises for all    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy read_foods      on foods     for select using (user_id is null or user_id = auth.uid());
create policy write_foods     on foods     for all    using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy read_achievements on achievements for select using (true);

-- Tabelas filhas: acesso via dono da ficha / sessão
create policy own_plan_exercises on plan_exercises for all
  using (exists (select 1 from workout_plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from workout_plans p where p.id = plan_id and p.user_id = auth.uid()));

create policy own_session_sets on session_sets for all
  using (exists (select 1 from workout_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from workout_sessions s where s.id = session_id and s.user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- SEED (dados iniciais globais)
-- ---------------------------------------------------------------------
insert into exercises (name, muscle_group, equipment, weight_increment) values
  ('Supino reto com barra',        'Peito',   'Barra',         2.5),
  ('Supino inclinado c/ halteres', 'Peito',   'Halter',        2),
  ('Crucifixo na máquina',         'Peito',   'Máquina',       5),
  ('Crossover polia alta',         'Peito',   'Polia',         2.5),
  ('Tríceps na corda',             'Tríceps', 'Polia',         2.5),
  ('Tríceps francês',              'Tríceps', 'Halter',        2),
  ('Mergulho nas paralelas',       'Tríceps', 'Peso corporal', 2.5),
  ('Puxada frontal',               'Costas',  'Polia',         5),
  ('Remada curvada',               'Costas',  'Barra',         2.5),
  ('Remada baixa',                 'Costas',  'Polia',         5),
  ('Pulldown braço reto',          'Costas',  'Polia',         2.5),
  ('Levantamento terra',           'Costas',  'Barra',         5),
  ('Rosca direta',                 'Bíceps',  'Barra W',       2),
  ('Rosca martelo',                'Bíceps',  'Halter',        2),
  ('Agachamento livre',            'Pernas',  'Barra',         5),
  ('Leg press 45°',                'Pernas',  'Máquina',       10),
  ('Cadeira extensora',            'Pernas',  'Máquina',       5),
  ('Mesa flexora',                 'Pernas',  'Máquina',       5),
  ('Stiff',                        'Pernas',  'Barra',         5),
  ('Panturrilha em pé',            'Pernas',  'Máquina',       5),
  ('Desenvolvimento militar',      'Ombros',  'Barra',         2.5),
  ('Elevação lateral',             'Ombros',  'Halter',        1),
  ('Crucifixo invertido',          'Ombros',  'Máquina',       5),
  ('Encolhimento',                 'Ombros',  'Halter',        2),
  ('Abdominal infra',              'Abdômen', 'Peso corporal', 1),
  ('Prancha isométrica',           'Abdômen', 'Peso corporal', 1);

insert into foods (name, kcal_100g, protein_100g, carbs_100g, fat_100g, default_grams) values
  ('Ovo inteiro',              143, 12.6,  0.7,   9.5, 100),
  ('Pão francês',              289,  8.0, 58.6,   3.1,  50),
  ('Aveia em flocos',          394, 13.9, 66.6,   8.5,  40),
  ('Banana prata',              98,  1.3, 26.0,   0.1,  90),
  ('Whey protein',             400, 80.0,  8.0,   6.0,  30),
  ('Arroz branco cozido',      128,  2.5, 28.1,   0.2, 150),
  ('Feijão carioca cozido',     76,  4.8, 13.6,   0.5, 100),
  ('Peito de frango grelhado', 159, 32.0,  0.0,   2.5, 150),
  ('Patinho moído',            219, 35.9,  0.0,   7.3, 150),
  ('Batata-doce cozida',        77,  0.6, 18.4,   0.1, 200),
  ('Brócolis cozido',           25,  2.1,  4.4,   0.5,  80),
  ('Azeite de oliva',          884,  0.0,  0.0, 100.0,  10),
  ('Iogurte natural',           51,  4.1,  1.9,   3.0, 170),
  ('Pasta de amendoim',        588, 25.0, 20.0,  50.0,  20),
  ('Tilápia grelhada',         128, 26.0,  0.0,   2.7, 150),
  ('Macarrão cozido',          158,  5.8, 30.9,   0.9, 150),
  ('Queijo minas frescal',     264, 17.4,  3.2,  20.2,  30),
  ('Leite desnatado',           35,  3.4,  5.0,   0.1, 200),
  ('Maçã',                      56,  0.3, 15.2,   0.1, 130),
  ('Salmão grelhado',          211, 23.9,  0.0,  12.1, 150),
  ('Tapioca (goma)',           240,  0.0, 60.0,   0.0,  50),
  ('Granola',                  421, 10.0, 66.0,  13.0,  40);

insert into achievements (id, name, description, target, badge_code, badge_unit) values
  ('primeiro_treino', 'Primeiro passo',  'Concluiu o primeiro treino.',                     1,   '01',  'TREINO'),
  ('streak_7',        'Semana de ferro', '7 dias consistentes em sequência.',               7,   '7',   'DIAS'),
  ('streak_30',       'Mês blindado',    '30 dias consistentes em sequência.',              30,  '30',  'DIAS'),
  ('clube_100',       'Clube dos 100',   'Levantou 100 kg em um exercício.',                100, '100', 'KG'),
  ('pr_10',           'Caçador de PR',   'Bateu 10 recordes pessoais.',                     10,  '10',  'PRs'),
  ('treinos_50',      'Meio centenário', '50 treinos concluídos.',                          50,  '50',  'TREINOS'),
  ('treinos_100',     'Centurião',       '100 treinos concluídos.',                         100, '100', 'TREINOS'),
  ('proteina_7',      'Proteína em dia', 'Bateu a meta de proteína 7 dias seguidos.',       7,   '7×',  'PROTEÍNA'),
  ('volume_10t',      'Dez toneladas',   'Movimentou 10.000 kg em um único treino.',        10000, '10t', 'VOLUME');
