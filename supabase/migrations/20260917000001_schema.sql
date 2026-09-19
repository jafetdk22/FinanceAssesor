-- =====================================================================
-- Investment Intelligence Platform - Esquema base
-- =====================================================================
create extension if not exists "pgcrypto";

-- ---------- Helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- Perfiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  base_currency text not null default 'MXN',
  risk_profile text not null default 'MODERATE' check (risk_profile in ('CONSERVATIVE','MODERATE','AGGRESSIVE')),
  investment_horizon_years int not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Configuración de la app (por usuario) ----------
create table public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  emergency_fund_months numeric not null default 6,
  emergency_fund_current numeric not null default 0,
  liquid_capital numeric not null default 0,
  score_weights jsonb not null default '{"fundamental":35,"technical":30,"risk":20,"valuation":15,"momentum":0}',
  recommendation_positions int not null default 5,
  max_asset_concentration numeric not null default 25,
  max_sector_concentration numeric not null default 40,
  market_data_provider text not null default 'twelve_data' check (market_data_provider in ('alpha_vantage','twelve_data')),
  ai_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Auto-crear perfil y settings al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  insert into public.app_settings (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- Finanzas personales ----------
create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('SALARY','BUSINESS','INVESTMENTS','FREELANCE','OTHER')),
  amount numeric not null check (amount >= 0),
  frequency text not null default 'MONTHLY' check (frequency in ('ONCE','WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY','YEARLY')),
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('HOUSING','FOOD','TRANSPORT','UTILITIES','ENTERTAINMENT','EDUCATION','HEALTH','DEBT','OTHER')),
  amount numeric not null check (amount >= 0),
  frequency text not null default 'MONTHLY' check (frequency in ('ONCE','WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY','YEARLY')),
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  institution text,
  principal_amount numeric not null check (principal_amount >= 0),
  remaining_amount numeric not null check (remaining_amount >= 0),
  interest_rate numeric not null default 0,
  monthly_payment numeric not null default 0,
  due_date date,
  created_at timestamptz not null default now()
);

create table public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric not null check (target_amount > 0),
  current_amount numeric not null default 0,
  target_date date,
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH')),
  created_at timestamptz not null default now()
);

-- ---------- Brokers ----------
create table public.brokers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  country text,
  currency text not null default 'USD',
  type text not null default 'BROKER' check (type in ('BROKER','BANK','EXCHANGE','GOVERNMENT','OTHER')),
  commission_notes text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Activos (catálogo global, lectura para todos) ----------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  name text not null,
  asset_type text not null default 'STOCK' check (asset_type in ('STOCK','ETF','FUND','BOND','CETES','REIT','CRYPTO','OTHER')),
  market text,
  exchange text,
  country text,
  currency text not null default 'USD',
  sector text,
  industry text,
  isin text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (symbol, exchange)
);
create index assets_symbol_idx on public.assets (upper(symbol));

create table public.asset_prices (
  id bigint generated always as identity primary key,
  asset_id uuid not null references public.assets(id) on delete cascade,
  date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric not null,
  adjusted_close numeric,
  volume bigint,
  provider text not null,
  created_at timestamptz not null default now(),
  unique (asset_id, date, provider)
);
create index asset_prices_asset_date_idx on public.asset_prices (asset_id, date desc);

create table public.asset_fundamentals (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  as_of date not null,
  provider text not null,
  market_cap numeric,
  revenue numeric,
  revenue_growth numeric,
  eps numeric,
  eps_growth numeric,
  net_income numeric,
  free_cash_flow numeric,
  gross_margin numeric,
  operating_margin numeric,
  net_margin numeric,
  roe numeric,
  roa numeric,
  debt_to_equity numeric,
  current_ratio numeric,
  pe numeric,
  peg numeric,
  pb numeric,
  dividend_yield numeric,
  payout_ratio numeric,
  beta numeric,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (asset_id, as_of, provider)
);

-- ---------- Portafolios ----------
create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  risk_profile text not null default 'MODERATE' check (risk_profile in ('CONSERVATIVE','MODERATE','AGGRESSIVE')),
  target_horizon_years int not null default 5,
  base_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

-- Posiciones: snapshot derivado del ledger de transacciones.
-- Se recalculan con recompute_positions(); el ledger es la fuente de verdad.
create table public.portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  broker_id uuid references public.brokers(id) on delete set null,
  asset_id uuid not null references public.assets(id) on delete restrict,
  quantity numeric not null default 0,
  average_price numeric not null default 0,
  currency text not null default 'USD',
  updated_at timestamptz not null default now()
);
create unique index portfolio_positions_unique_idx
  on public.portfolio_positions (portfolio_id, asset_id, coalesce(broker_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  broker_id uuid references public.brokers(id) on delete set null,
  asset_id uuid references public.assets(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('BUY','SELL','DIVIDEND','INTEREST','FEE','DEPOSIT','WITHDRAWAL','SPLIT','TRANSFER')),
  quantity numeric not null default 0,
  price numeric not null default 0,
  amount numeric not null default 0,
  commission numeric not null default 0,
  currency text not null default 'USD',
  transaction_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
create index inv_tx_portfolio_idx on public.investment_transactions (portfolio_id, transaction_date);

-- Reconstrucción de posiciones a partir del ledger (fuente de verdad)
create or replace function public.recompute_positions(p_portfolio_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  grp record;
  tx record;
  v_qty numeric;
  v_cost numeric;
begin
  if not exists (select 1 from portfolios where id = p_portfolio_id and user_id = auth.uid()) then
    raise exception 'not allowed';
  end if;

  delete from portfolio_positions where portfolio_id = p_portfolio_id;

  for grp in
    select broker_id, asset_id, min(currency) as currency
    from investment_transactions
    where portfolio_id = p_portfolio_id and asset_id is not null
    group by broker_id, asset_id
  loop
    v_qty := 0; v_cost := 0;
    for tx in
      select * from investment_transactions
      where portfolio_id = p_portfolio_id and asset_id = grp.asset_id
        and broker_id is not distinct from grp.broker_id
      order by transaction_date, created_at
    loop
      if tx.transaction_type = 'BUY' then
        v_cost := v_cost + tx.quantity * tx.price + tx.commission;
        v_qty := v_qty + tx.quantity;
      elsif tx.transaction_type = 'SELL' then
        if v_qty > 0 then
          v_cost := v_cost - (v_cost / v_qty) * tx.quantity;
        end if;
        v_qty := v_qty - tx.quantity;
      elsif tx.transaction_type = 'SPLIT' and tx.quantity > 0 then
        -- quantity = factor del split (ej. 2 para 2:1)
        v_qty := v_qty * tx.quantity;
      elsif tx.transaction_type = 'TRANSFER' then
        v_qty := v_qty + tx.quantity;
        v_cost := v_cost + tx.quantity * tx.price;
      end if;
    end loop;

    if v_qty > 0 then
      insert into portfolio_positions (portfolio_id, broker_id, asset_id, quantity, average_price, currency)
      values (p_portfolio_id, grp.broker_id, grp.asset_id, v_qty, v_cost / v_qty, grp.currency);
    end if;
  end loop;
end $$;

-- Recalcular automáticamente al cambiar el ledger
create or replace function public.trg_recompute_positions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_positions(old.portfolio_id);
  else
    perform public.recompute_positions(new.portfolio_id);
    if tg_op = 'UPDATE' and new.portfolio_id <> old.portfolio_id then
      perform public.recompute_positions(old.portfolio_id);
    end if;
  end if;
  return null;
end $$;

create trigger investment_transactions_recompute
  after insert or update or delete on public.investment_transactions
  for each row execute procedure public.trg_recompute_positions();

-- ---------- Análisis ----------
create table public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  analysis_date date not null default current_date,
  fundamental_score numeric,
  technical_score numeric,
  risk_score numeric,
  valuation_score numeric,
  momentum_score numeric,
  total_score numeric not null,
  model_version text not null,
  weights jsonb not null,
  explanation jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, asset_id, analysis_date, model_version)
);

create table public.analysis_metrics (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analysis_results(id) on delete cascade,
  metric text not null,
  value numeric,
  category text,
  unique (analysis_id, metric)
);

-- ---------- Recomendaciones ----------
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete set null,
  capital_available numeric not null,
  capital_suggested numeric not null,
  positions_count int not null,
  model_version text not null,
  inputs jsonb not null default '{}',
  summary jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.recommendation_items (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  amount numeric not null,
  weight numeric not null,
  estimated_quantity numeric,
  score numeric,
  reasons jsonb not null default '[]',
  executed boolean not null default false
);

-- ---------- Backtests ----------
create table public.backtests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  config jsonb not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------- Notificaciones (arquitectura preparada, sin envío externo) ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('PORTFOLIO_CHANGE','PRICE_DROP','SCORE_CHANGE','DIVIDEND','CONCENTRATION','DATA_UPDATE')),
  title text not null,
  body text,
  payload jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Triggers updated_at ----------
create trigger profiles_updated before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger settings_updated before update on public.app_settings for each row execute procedure public.set_updated_at();
create trigger positions_updated before update on public.portfolio_positions for each row execute procedure public.set_updated_at();

-- ---------- Vista: cobertura de precios por activo ----------
create view public.asset_price_coverage with (security_invoker = true) as
  select asset_id, min(date) as from_date, max(date) as to_date, count(*) as bars
  from public.asset_prices group by asset_id;
