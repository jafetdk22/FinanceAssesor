-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.income_sources enable row level security;
alter table public.expenses enable row level security;
alter table public.debts enable row level security;
alter table public.financial_goals enable row level security;
alter table public.brokers enable row level security;
alter table public.assets enable row level security;
alter table public.asset_prices enable row level security;
alter table public.asset_fundamentals enable row level security;
alter table public.portfolios enable row level security;
alter table public.portfolio_positions enable row level security;
alter table public.investment_transactions enable row level security;
alter table public.analysis_results enable row level security;
alter table public.analysis_metrics enable row level security;
alter table public.recommendations enable row level security;
alter table public.recommendation_items enable row level security;
alter table public.backtests enable row level security;
alter table public.notifications enable row level security;

-- Perfil / settings
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own settings" on public.app_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tablas con user_id
create policy "own income" on public.income_sources for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own expenses" on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own debts" on public.debts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own goals" on public.financial_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own brokers" on public.brokers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own portfolios" on public.portfolios for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions" on public.investment_transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own analysis" on public.analysis_results for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recommendations" on public.recommendations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own backtests" on public.backtests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notifications" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Posiciones: a través del portafolio
create policy "positions via portfolio" on public.portfolio_positions for all
  using (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid()));

create policy "metrics via analysis" on public.analysis_metrics for all
  using (exists (select 1 from public.analysis_results a where a.id = analysis_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.analysis_results a where a.id = analysis_id and a.user_id = auth.uid()));

create policy "items via recommendation" on public.recommendation_items for all
  using (exists (select 1 from public.recommendations r where r.id = recommendation_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.recommendations r where r.id = recommendation_id and r.user_id = auth.uid()));

-- Catálogo de activos y datos de mercado: compartidos (no contienen datos personales).
-- Lectura para usuarios autenticados; alta de activos por usuarios autenticados;
-- precios y fundamentales sólo los escriben las Edge Functions (service role, omite RLS).
create policy "assets read" on public.assets for select to authenticated using (true);
create policy "assets insert" on public.assets for insert to authenticated with check (true);
create policy "assets update own" on public.assets for update to authenticated using (created_by = auth.uid());
create policy "prices read" on public.asset_prices for select to authenticated using (true);
create policy "fundamentals read" on public.asset_fundamentals for select to authenticated using (true);
