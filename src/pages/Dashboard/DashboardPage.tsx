import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState, ErrorAlert, Loading, ScoreBadge, StatCard } from '@/components/ui'
import { DonutChart, ValueAreaChart } from '@/components/charts'
import { useSettings } from '@/context/SettingsContext'
import { useAsync } from '@/hooks/useAsync'
import { analysisService } from '@/services/analysis.service'
import { financeService } from '@/services/finance.service'
import { marketService } from '@/services/market.service'
import { portfolioService } from '@/services/portfolio.service'
import { computeCashFlow, computeEmergencyFund, computeInvestableCapital, computeNetWorth } from '@/utils/financeEngine'
import { fmtDate, fmtMoney, fmtPct, pnlClass } from '@/utils/format'
import { concentrationAlerts, distribution, portfolioRisk, valuePositions } from '@/utils/portfolioAnalyzer'

export default function DashboardPage() {
  const { settings, profile } = useSettings()
  const cur = profile?.base_currency ?? 'MXN'

  const { data, loading, error, reload } = useAsync(async () => {
    const [fin, positions, transactions, results] = await Promise.all([
      financeService.loadAll(), portfolioService.listPositions(), portfolioService.listTransactions(undefined, 8), analysisService.listLatest(),
    ])
    const assetIds = [...new Set(positions.map((p) => p.asset_id))]
    const [lastPrices, pricesByAsset] = await Promise.all([marketService.getLastPrices(assetIds), marketService.getPricesForAssets(assetIds, 400)])
    return { fin, positions, transactions, results, lastPrices, pricesByAsset }
  }, [])

  const calc = useMemo(() => {
    if (!data) return null
    const valued = valuePositions(data.positions, data.lastPrices)
    const invested = valued.reduce((s, v) => s + v.invested, 0)
    const value = valued.reduce((s, v) => s + (v.marketValue ?? v.invested), 0)
    const cf = computeCashFlow(data.fin.income, data.fin.expenses, data.fin.debts)
    const ef = computeEmergencyFund(settings, cf.monthlyExpenses, cf.monthlyDebtPayments)
    const nw = computeNetWorth(settings, value, data.fin.debts, data.fin.goals)
    const inv = computeInvestableCapital(settings, ef)
    const risk = portfolioRisk(valued, data.pricesByAsset)
    return {
      valued, invested, value, pnl: value - invested, cf, ef, nw, inv, risk,
      byAsset: distribution(valued, (p) => p.asset?.symbol ?? '?'), bySector: distribution(valued, (p) => p.asset?.sector ?? 'Sin sector'), byBroker: distribution(valued, (p) => p.broker?.name ?? 'Sin broker'),
      alerts: concentrationAlerts(valued, settings),
      opportunities: data.results.filter((r) => r.total_score >= 70 && !valued.some((v) => v.asset_id === r.asset_id)).slice(0, 5),
    }
  }, [data, settings])

  if (loading) return <Loading text="Cargando dashboard…" />
  if (error) return <ErrorAlert message={error} onRetry={reload} />
  if (!data || !calc) return null

  const netWorthHistory = calc.risk.history.map((h) => ({ date: h.date, value: h.value + calc.nw.liquidAssets + calc.nw.goalAssets - calc.nw.totalLiabilities }))

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 className="page-title">Dashboard</h1>
        <Link to="/recommend" className="btn btn-primary btn-sm"><i className="bi bi-stars me-1" />Quiero invertir</Link>
      </div>
      <div className="row g-3 mb-3">
        <div className="col-6 col-xl-2"><StatCard label="Patrimonio total" value={fmtMoney(calc.nw.netWorth, cur)} icon="bank" /></div>
        <div className="col-6 col-xl-2"><StatCard label="Capital invertido" value={fmtMoney(calc.invested, cur)} icon="cash" tone="secondary" /></div>
        <div className="col-6 col-xl-2"><StatCard label="Valor actual" value={fmtMoney(calc.value, cur)} icon="graph-up" tone="success" /></div>
        <div className="col-6 col-xl-2"><StatCard label="Ganancia / pérdida" value={<span className={pnlClass(calc.pnl)}>{fmtMoney(calc.pnl, cur)}</span>} hint={fmtPct(calc.invested > 0 ? calc.pnl / calc.invested : null)} icon="percent" tone={calc.pnl >= 0 ? 'success' : 'danger'} /></div>
        <div className="col-6 col-xl-2"><StatCard label="Disponible para invertir" value={fmtMoney(calc.inv.investable, cur)} icon="wallet2" tone="primary" /></div>
        <div className="col-6 col-xl-2"><StatCard label="Reserva de emergencia" value={calc.ef.dataMissing ? 'Sin datos' : fmtPct(calc.ef.coveredPct, 0)} hint={calc.ef.dataMissing ? 'Registra gastos' : `${fmtMoney(calc.ef.current, cur)} / ${fmtMoney(calc.ef.target, cur)}`} icon="shield-check" tone="warning" /></div>
      </div>

      {calc.cf.missing.length > 0 && <div className="alert alert-info small py-2"><i className="bi bi-info-circle me-2" />{calc.cf.missing.join(' · ')}. <Link to="/finance">Completa tus finanzas</Link> para cálculos precisos.</div>}

      <div className="row g-3 mb-3">
        <div className="col-lg-8">
          <Card title="Evolución del portafolio" subtitle="Composición actual valuada con precios históricos">
            {calc.risk.history.length ? <ValueAreaChart data={calc.risk.history} currency={cur} /> : <EmptyState icon="graph-up" title="Sin historial" text="Registra posiciones y sincroniza precios en Mercado para ver la evolución." />}
          </Card>
        </div>
        <div className="col-lg-4">
          <Card title="Alertas del portafolio">
            {calc.alerts.length === 0 ? <div className="text-muted small"><i className="bi bi-check-circle text-success me-1" />Sin alertas de concentración.</div> : calc.alerts.map((a, i) => <div key={i} className={`alert alert-${a.level} py-2 small mb-2`}>{a.message}</div>)}
            {calc.risk.volatility !== null && <div className="small text-muted mt-2">Volatilidad {fmtPct(calc.risk.volatility, 1)} · Drawdown {fmtPct(calc.risk.maxDrawdown, 1)}</div>}
          </Card>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-4"><Card title="Distribución de activos"><DonutChart data={calc.byAsset} currency={cur} height={220} /></Card></div>
        <div className="col-md-4"><Card title="Distribución por sector"><DonutChart data={calc.bySector} currency={cur} height={220} /></Card></div>
        <div className="col-md-4"><Card title="Distribución por broker"><DonutChart data={calc.byBroker} currency={cur} height={220} /></Card></div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-6">
          <Card title="Evolución del patrimonio" subtitle="Portafolio histórico + liquidez actual − pasivos">
            {netWorthHistory.length ? <ValueAreaChart data={netWorthHistory} currency={cur} height={220} color="#16a34a" /> : <div className="text-muted small">Sin datos suficientes.</div>}
          </Card>
        </div>
        <div className="col-lg-3">
          <Card title="Oportunidades de análisis" subtitle="Score ≥ 70 fuera del portafolio">
            {calc.opportunities.length === 0 ? <div className="small text-muted">Sin oportunidades. <Link to="/analysis">Ejecuta el análisis</Link>.</div> : (
              <ul className="list-unstyled mb-0">{calc.opportunities.map((r) => <li key={r.id} className="d-flex justify-content-between py-1 border-bottom"><Link to={`/market/${r.asset_id}`} className="text-decoration-none fw-semibold">{r.asset?.symbol}</Link><ScoreBadge score={r.total_score} /></li>)}</ul>
            )}
          </Card>
        </div>
        <div className="col-lg-3">
          <Card title="Últimas transacciones">
            {data.transactions.length === 0 ? <div className="small text-muted">Sin operaciones. <Link to="/investments">Registrar</Link>.</div> : (
              <ul className="list-unstyled mb-0 small">{data.transactions.map((t) => <li key={t.id} className="d-flex justify-content-between py-1 border-bottom"><span><span className={`badge me-1 ${t.transaction_type === 'BUY' ? 'text-bg-success' : t.transaction_type === 'SELL' ? 'text-bg-danger' : 'text-bg-light'}`}>{t.transaction_type}</span>{t.asset?.symbol ?? ''}</span><span className="text-muted">{fmtDate(t.transaction_date)}</span></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
