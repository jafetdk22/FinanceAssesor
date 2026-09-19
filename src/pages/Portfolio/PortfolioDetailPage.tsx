import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, EmptyState, ErrorAlert, Loading, ModelDisclaimer, StatCard } from '@/components/ui'
import { DonutChart, ValueAreaChart } from '@/components/charts'
import TransactionForm from '@/components/TransactionForm'
import AiExplainButton from '@/components/AiExplainButton'
import { useSettings } from '@/context/SettingsContext'
import { useAsync } from '@/hooks/useAsync'
import { marketService } from '@/services/market.service'
import { portfolioService } from '@/services/portfolio.service'
import { fmtDate, fmtMoney, fmtNum, fmtPct, pnlClass } from '@/utils/format'
import { concentrationAlerts, distribution, hhi, portfolioRisk, valuePositions } from '@/utils/portfolioAnalyzer'

export default function PortfolioDetailPage() {
  const { id } = useParams()
  const { settings } = useSettings()
  const [showTx, setShowTx] = useState(false)
  const [tab, setTab] = useState<'positions' | 'composition' | 'risk'>('positions')

  const { data, loading, error, reload } = useAsync(async () => {
    const [portfolios, positions, brokers, assets] = await Promise.all([
      portfolioService.listPortfolios(), portfolioService.listPositions(id), portfolioService.listBrokers(), portfolioService.listAssets(),
    ])
    const portfolio = portfolios.find((p) => p.id === id)
    if (!portfolio) throw new Error('Portafolio no encontrado')
    const assetIds = [...new Set(positions.map((p) => p.asset_id))]
    const [lastPrices, pricesByAsset] = await Promise.all([marketService.getLastPrices(assetIds), marketService.getPricesForAssets(assetIds, 600)])
    return { portfolio, portfolios, positions, brokers, assets, lastPrices, pricesByAsset }
  }, [id])

  const analysis = useMemo(() => {
    if (!data) return null
    const valued = valuePositions(data.positions, data.lastPrices)
    return {
      valued,
      invested: valued.reduce((s, v) => s + v.invested, 0),
      value: valued.reduce((s, v) => s + (v.marketValue ?? v.invested), 0),
      byAsset: distribution(valued, (p) => p.asset?.symbol ?? '?'),
      bySector: distribution(valued, (p) => p.asset?.sector ?? 'Sin sector'),
      byCountry: distribution(valued, (p) => p.asset?.country ?? 'Sin país'),
      byCurrency: distribution(valued, (p) => p.currency),
      byBroker: distribution(valued, (p) => p.broker?.name ?? 'Sin broker'),
      byType: distribution(valued, (p) => p.asset?.asset_type ?? 'OTHER'),
      alerts: concentrationAlerts(valued, settings),
      hhi: hhi(valued),
      risk: portfolioRisk(valued, data.pricesByAsset),
    }
  }, [data, settings])

  if (loading) return <Loading />
  if (error) return <ErrorAlert message={error} onRetry={reload} />
  if (!data || !analysis) return null
  const cur = data.portfolio.base_currency
  const pnl = analysis.value - analysis.invested

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div><Link to="/portfolios" className="small text-decoration-none"><i className="bi bi-arrow-left" /> Portafolios</Link><h1 className="page-title">{data.portfolio.name}</h1></div>
        <div className="d-flex gap-2">
          <AiExplainButton kind="portfolio" label="Explicar portafolio con IA" payload={{ portfolio: data.portfolio.name, distribution: { sector: analysis.bySector, country: analysis.byCountry, currency: analysis.byCurrency, type: analysis.byType }, hhi: analysis.hhi, volatility: analysis.risk.volatility, maxDrawdown: analysis.risk.maxDrawdown, avgCorrelation: analysis.risk.avgCorrelation, alerts: analysis.alerts.map((a) => a.message) }} />
          <button className="btn btn-primary btn-sm" onClick={() => setShowTx(true)}><i className="bi bi-plus-lg me-1" />Registrar operación</button>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-6 col-lg-3"><StatCard label="Capital invertido" value={fmtMoney(analysis.invested, cur)} icon="cash" /></div>
        <div className="col-6 col-lg-3"><StatCard label="Valor actual" value={fmtMoney(analysis.value, cur)} icon="graph-up" tone="success" /></div>
        <div className="col-6 col-lg-3"><StatCard label="Ganancia / pérdida" value={<span className={pnlClass(pnl)}>{fmtMoney(pnl, cur)}</span>} hint={fmtPct(analysis.invested > 0 ? pnl / analysis.invested : null)} icon="percent" tone={pnl >= 0 ? 'success' : 'danger'} /></div>
        <div className="col-6 col-lg-3"><StatCard label="Posiciones" value={analysis.valued.length} hint={`HHI ${analysis.hhi.toFixed(2)}`} icon="collection" tone="secondary" /></div>
      </div>

      {analysis.alerts.length > 0 && (
        <div className="mb-3">{analysis.alerts.map((a, i) => <div key={i} className={`alert alert-${a.level} py-2 small mb-2`}><i className="bi bi-exclamation-triangle me-2" />{a.message}</div>)}</div>
      )}

      <ul className="nav nav-pills mb-3">
        {(['positions', 'composition', 'risk'] as const).map((t) => <li key={t} className="nav-item"><button className={`nav-link ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{{ positions: 'Posiciones', composition: 'Composición', risk: 'Riesgo' }[t]}</button></li>)}
      </ul>

      {tab === 'positions' && (
        <Card>
          {analysis.valued.length === 0 ? <EmptyState icon="briefcase" title="Sin posiciones" text="Registra compras para reconstruir tus posiciones." action={<button className="btn btn-primary btn-sm" onClick={() => setShowTx(true)}>Registrar compra</button>} /> : (
            <div className="table-responsive"><table className="table table-hover align-middle">
              <thead><tr><th>Activo</th><th>Broker</th><th className="text-end">Cantidad</th><th className="text-end">Precio prom.</th><th className="text-end">Precio actual</th><th className="text-end">Invertido</th><th className="text-end">Valor</th><th className="text-end">G/P</th><th className="text-end">G/P %</th><th className="text-end">Peso</th></tr></thead>
              <tbody>{analysis.valued.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/market/${p.asset_id}`} className="fw-semibold text-decoration-none">{p.asset?.symbol}</Link><div className="small text-muted">{p.asset?.name}</div></td>
                  <td className="small">{p.broker?.name ?? '—'}</td>
                  <td className="text-end">{fmtNum(Number(p.quantity), 4)}</td>
                  <td className="text-end">{fmtMoney(Number(p.average_price), p.currency)}</td>
                  <td className="text-end">{p.lastPrice !== null ? <>{fmtMoney(p.lastPrice, p.currency)}<div className="small text-muted">{fmtDate(p.lastPriceDate)}</div></> : <span className="badge text-bg-warning">Sin precio</span>}</td>
                  <td className="text-end">{fmtMoney(p.invested, p.currency)}</td>
                  <td className="text-end fw-semibold">{fmtMoney(p.marketValue, p.currency)}</td>
                  <td className={`text-end ${pnlClass(p.pnl)}`}>{fmtMoney(p.pnl, p.currency)}</td>
                  <td className={`text-end ${pnlClass(p.pnlPct)}`}>{fmtPct(p.pnlPct)}</td>
                  <td className="text-end">{fmtPct(p.weight, 1)}</td>
                </tr>
              ))}</tbody></table></div>
          )}
        </Card>
      )}

      {tab === 'composition' && (
        <div className="row g-3">
          {[['Por activo', analysis.byAsset], ['Por sector', analysis.bySector], ['Por país', analysis.byCountry], ['Por moneda', analysis.byCurrency], ['Por broker', analysis.byBroker], ['Por tipo de activo', analysis.byType]].map(([t, d]) => (
            <div className="col-md-6 col-xl-4" key={t as string}><Card title={t as string}><DonutChart data={d as typeof analysis.byAsset} currency={cur} height={220} /></Card></div>
          ))}
        </div>
      )}

      {tab === 'risk' && (
        <div className="row g-3">
          <div className="col-lg-8">
            <Card title="Evolución del valor (composición actual)" subtitle={analysis.risk.days ? `${analysis.risk.days} días con datos comunes` : undefined}>
              {analysis.risk.history.length ? <ValueAreaChart data={analysis.risk.history} currency={cur} /> : <EmptyState icon="graph-down" title="Sin datos suficientes" text="Sincroniza históricos de precios de los activos en Mercado." />}
            </Card>
          </div>
          <div className="col-lg-4">
            <Card title="Métricas de riesgo">
              <div className="table-responsive"><table className="table table-sm mb-2"><tbody>
                <tr><td>Volatilidad anualizada</td><td className="text-end fw-semibold">{fmtPct(analysis.risk.volatility, 1)}</td></tr>
                <tr><td>Máximo drawdown</td><td className="text-end fw-semibold text-danger">{fmtPct(analysis.risk.maxDrawdown, 1)}</td></tr>
                <tr><td>Correlación promedio</td><td className="text-end fw-semibold">{fmtNum(analysis.risk.avgCorrelation, 2)}</td></tr>
                <tr><td>Concentración (HHI)</td><td className="text-end fw-semibold">{analysis.hhi.toFixed(3)}</td></tr>
                <tr><td>Equivalente posiciones efectivas</td><td className="text-end fw-semibold">{analysis.hhi > 0 ? (1 / analysis.hhi).toFixed(1) : '—'}</td></tr>
              </tbody></table></div>
              <ModelDisclaimer text="Métricas calculadas con precios históricos reales y la composición actual del portafolio." />
            </Card>
          </div>
          {analysis.risk.correlationMatrix.symbols.length > 1 && (
            <div className="col-12"><Card title="Matriz de correlación (retornos diarios)">
              <div className="table-responsive"><table className="table table-sm table-bordered mb-0" style={{ width: 'auto' }}>
                <thead><tr><th /> {analysis.risk.correlationMatrix.symbols.map((s) => <th key={s} className="corr-cell">{s}</th>)}</tr></thead>
                <tbody>{analysis.risk.correlationMatrix.matrix.map((row, i) => (
                  <tr key={i}><th className="small">{analysis.risk.correlationMatrix.symbols[i]}</th>
                    {row.map((c, j) => <td key={j} className="corr-cell" style={{ background: c === null ? '#f8f9fa' : `rgba(${c > 0 ? '220,38,38' : '37,99,235'},${Math.abs(c) * 0.6})` }}>{c === null ? '—' : c.toFixed(2)}</td>)}</tr>
                ))}</tbody></table></div>
            </Card></div>
          )}
        </div>
      )}

      <TransactionForm show={showTx} onClose={() => setShowTx(false)} onSaved={reload} initial={{ portfolio_id: id }} portfolios={data.portfolios} brokers={data.brokers} assets={data.assets} />
    </>
  )
}
