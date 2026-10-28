-- =====================================================================
-- Diário alimentar: registrar, ajustar e remover alimentos com os pontos
-- na mesma transação. Funções security invoker (rodam com o RLS de quem
-- chama).
--
-- Regras:
--   - Só hoje e ontem (em America/Sao_Paulo) aceitam mudanças. Dias mais
--     antigos ficam só para consulta, o que protege a sequência
--     (current_streak conta food_logs) e os pontos.
--   - Cada alimento registrado vale +5 (point_events.kind = 'alimento',
--     ref_id = food_logs.id). Remover o registro estorna os pontos dele.
--
-- Erros (SQLSTATE):
--   28000  não autenticado
--   22023  parâmetro inválido (gramas fora de 1–2000)
--   PF020  alimento inexistente ou não visível
--   PF021  dia fechado para edição (antes de ontem ou no futuro)
--   PF022  registro não encontrado
-- =====================================================================

-- A edição de quantidade precisa do alimento para recalcular a porção.
-- Coluna nova no fim: as colunas existentes e v_daily_nutrition continuam iguais.
create or replace view public.v_food_log_detail with (security_invoker = on) as
select fl.id, fl.user_id, fl.eaten_on, fl.meal, fl.logged_at, fl.grams,
       f.name,
       round(f.kcal_100g    * fl.grams / 100, 1) as kcal,
       round(f.protein_100g * fl.grams / 100, 1) as protein_g,
       round(f.carbs_100g   * fl.grams / 100, 1) as carbs_g,
       round(f.fat_100g     * fl.grams / 100, 1) as fat_g,
       fl.food_id
from public.food_logs fl
join public.foods f on f.id = fl.food_id;

-- ---------------------------------------------------------------------
-- Se o dia aceita mudanças: hoje ou ontem no fuso do app.
-- ---------------------------------------------------------------------
create or replace function public.food_day_is_open(p_day date)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_day between (now() at time zone 'America/Sao_Paulo')::date - 1
                   and (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- ---------------------------------------------------------------------
-- Registra um alimento numa refeição e dá os pontos. Retorna o id.
-- ---------------------------------------------------------------------
create or replace function public.log_food(
  p_food_id  bigint,
  p_meal     public.meal_type,
  p_grams    numeric,
  p_eaten_on date
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_log_id bigint;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_grams is null or p_grams < 1 or p_grams > 2000 then
    raise exception 'invalid grams' using errcode = '22023';
  end if;
  if not public.food_day_is_open(p_eaten_on) then
    raise exception 'day closed' using errcode = 'PF021';
  end if;

  -- O RLS de foods deixa passar só os globais e os do usuário
  perform 1 from public.foods f where f.id = p_food_id;
  if not found then
    raise exception 'food not found' using errcode = 'PF020';
  end if;

  insert into public.food_logs (user_id, food_id, eaten_on, meal, grams)
  values (v_user, p_food_id, p_eaten_on, p_meal, p_grams)
  returning id into v_log_id;

  insert into public.point_events (user_id, kind, points, ref_id)
  values (v_user, 'alimento', 5, v_log_id);

  return v_log_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Ajusta as gramas de um registro. Os pontos não mudam.
-- ---------------------------------------------------------------------
create or replace function public.update_food_log(p_log_id bigint, p_grams numeric)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_eaten_on date;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_grams is null or p_grams < 1 or p_grams > 2000 then
    raise exception 'invalid grams' using errcode = '22023';
  end if;

  select fl.eaten_on into v_eaten_on
  from public.food_logs fl
  where fl.id = p_log_id and fl.user_id = v_user
  for update;
  if not found then
    raise exception 'food log not found' using errcode = 'PF022';
  end if;
  if not public.food_day_is_open(v_eaten_on) then
    raise exception 'day closed' using errcode = 'PF021';
  end if;

  update public.food_logs fl set grams = p_grams where fl.id = p_log_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Remove um registro e estorna os pontos dele. Remover de novo não faz
-- nada.
-- ---------------------------------------------------------------------
create or replace function public.delete_food_log(p_log_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_eaten_on date;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select fl.eaten_on into v_eaten_on
  from public.food_logs fl
  where fl.id = p_log_id and fl.user_id = v_user
  for update;
  if not found then
    return; -- já removido
  end if;
  if not public.food_day_is_open(v_eaten_on) then
    raise exception 'day closed' using errcode = 'PF021';
  end if;

  delete from public.point_events pe
  where pe.user_id = v_user and pe.kind = 'alimento' and pe.ref_id = p_log_id;

  delete from public.food_logs fl where fl.id = p_log_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões: só usuários logados
-- ---------------------------------------------------------------------
revoke execute on function public.food_day_is_open(date) from public, anon;
revoke execute on function public.log_food(bigint, public.meal_type, numeric, date) from public, anon;
revoke execute on function public.update_food_log(bigint, numeric) from public, anon;
revoke execute on function public.delete_food_log(bigint) from public, anon;

grant execute on function public.food_day_is_open(date) to authenticated;
grant execute on function public.log_food(bigint, public.meal_type, numeric, date) to authenticated;
grant execute on function public.update_food_log(bigint, numeric) to authenticated;
grant execute on function public.delete_food_log(bigint) to authenticated;
