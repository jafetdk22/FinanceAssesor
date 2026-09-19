import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState, ErrorAlert, Loading, ModelDisclaimer, ScoreBadge, StatCard } from '@/components/ui'
import { DonutChart } from '@/components/charts'
import AiExplainButton from '@/components/AiExplainButton'
import TransactionForm from '@/components/TransactionForm'
import { useSettings } from '@/context/SettingsContext'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { analysisService } from '@/services/analysis.service'
import { financeService } from '@/services/finance.service'
import { marketService } from '@/services/market.service'
import { portfolioService } from '@/services/portfolio.service'
import { recommendationService } from '@/services/recommendation.service'
import type { InvestmentTransaction, RecommendationItem } from '@/types'
import { computeCashFlow, computeEmergencyFund, computeInvestableCapital } from '@/utils/financeEngine'
import { fmtDate, fmtMoney, fmtNum } from '@/utils/format'
import { valuePositions } from '@/utils/portfolioAnalyzer'
import { recommend, type RecommendationOutput } from '@/utils/recommendationEngine'

const riskTone = (r?: string) => ({ Bajo: 'success', Medio: 'warning', Alto: 'danger' } as Record<string, string>)[r ?? ''] ?? 'secondary'

export default function RecommendationPage() {
  const { settings, profile } = useSettings()
  const toast = useToast()
  const [capital, setCapital] = useState(20000)
  const [portfolioId, setPortfolioId] = useState('')
  const [positions, setPositions] = useState(settings?.recommendation_positions ?? 5)
  const [out, setOut] = useState<RecommendationOutput | null>(null)
  const [busy, setBusy] = useState(false)
  const [tx, setTx] = useState<Partial<InvestmentTransaction> | null>(null)

  const { data, loading, error, reload } = useAsync(async () => {
    const [portfolios, brokers, assets, results, fin, history] = await Promise.all([
      portfolioService.listPortfolios(), portfolioService.listBrokers(), portfolioService.listAssets(), analysisService.listLatest(), financeService.loadAll(), recommendationService.list(),
    ])
    return { portfolios, brokers, assets, results, fin, history }
  }, [])

  const investable = useMemo(() => {
    if (!data) return null
    const cf = computeCashFlow(data.fin.income, data.fin.expenses, data.fin.debts)
    const ef = computeEmergencyFund(settings, cf.monthlyExpenses, cf.monthlyDebtPayments)
    return computeInvestableCapital(settings, ef)
  }, [data, settings])

  const run = async () => {
    if (!data) return
    if (capital <= 0) { toast.push('warning', 'Indica un capital mayor a 0'); return }
    if (!data.results.length) { toast.push('warning', 'No hay activos analizados. Ejecuta el análisis primero.'); return }
    setBusy(true)
    try {
      const pid = portfolioId || data.portfolios[0]?.id
      const posRows = pid ? await portfolioService.listPositions(pid) : []
      const assetIds = [...new Set([...posRows.map((p) => p.asset_id), ...data.results.map((r) => r.asset_id)])]
      const [lastPrices, pricesByAsset] = await Promise.all([marketService.getLastPrices(assetIds), marketService.getPricesForAssets(assetIds, 300)])
      const valued = valuePositions(posRows, lastPrices)
      const result = recommend({
        capital, profile, settings, valuedPositions: valued, pricesByAsset, positionsCount: positions,
        candidates: data.results.filter((r) => r.asset).map((r) => ({ asset: r.asset!, analysis: r })),
      })
      setOut(result)
      if (result.items.length) {
        await recommendationService.save(pid ?? null, result, { capital, positions, riskProfile: profile?.risk_profile, portfolioId: pid })
        reload()
      }
    } catch (e) { toast.push('danger', (e as Error).message) } finally { setBusy(false) }
  }

  if (loading) return <Loading />
  if (error) return <ErrorAlert message={error} onRetry={reload} />
  if (!data) return null

  return (
    <>
      <h1 className="page-title mb-3">Recomendación de inversión</h1>
      <div className="row g-3 mb-3">
        <div className="col-lg-4">
          <Card title="¿Cuánto quieres invertir?">
            <div className="mb-3"><label className="form-label small fw-semibold">Capital a invertir ({profile?.base_currency ?? 'MXN'})</label><input type="number" min={0} className="form-control form-control-lg" value={capital} onChange={(e) => setCapital(Number(e.target.value))} /></div>
            {investable && <div className="small text-muted mb-3">Capital potencialmente invertible según tus finanzas: <strong>{fmtMoney(investable.investable, profile?.base_currency)}</strong>{capital > investable.investable && <span className="text-warning d-block"><i className="bi bi-exclamation-triangle me-1" />El monto supera tu capital invertible calculado (reserva de emergencia considerada).</span>}</div>}
            <div className="mb-3"><label className="form-label small fw-semibold">Portafolio de referencia</label><select className="form-select" value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>{data.portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}{!data.portfolios.length && <option value="">Sin portafolio (sólo mercado)</option>}</select></div>
            <div className="mb-3"><label className="form-label small fw-semibold">Número de instrumentos</label><input type="number" min={1} max={10} className="form-control" value={positions} onChange={(e) => setPositions(Number(e.target.value))} /></div>
            <div className="small text-muted mb-3">Perfil: <strong>{profile?.risk_profile}</strong> · Horizonte: {profile?.investment_horizon_years} años · {data.results.length} activos analizados</div>
            <button className="btn btn-primary w-100" disabled={busy} onClick={run}>{busy ? 'Analizando…' : 'Generar propuesta'}</button>
          </Card>
        </div>
        <div className="col-lg-8">
          {!out ? <Card><EmptyState icon="stars" title="Genera una propuesta" text="El motor analiza tu situación financiera, el portafolio actual (concentración, correlación), los scores del mercado y propone una distribución diversificada." /></Card> : (
            <>
              <div className="row g-3 mb-3">
                <div className="col-6 col-md-3"><StatCard label="Capital analizado" value={fmtMoney(out.capitalAvailable, profile?.base_currency)} /></div>
                <div className="col-6 col-md-3"><StatCard label="Capital sugerido" value={fmtMoney(out.capitalSuggested, profile?.base_currency)} /></div>
                <div className="col-6 col-md-3"><StatCard label="Posiciones" value={out.items.length} /></div>
                <div className="col-6 col-md-3"><StatCard label="Score mínimo" value={out.summary.minScore} hint={out.summary.riskProfile} /></div>
              </div>
              {out.summary.notes.map((n, i) => <div key={i} className="alert alert-warning small py-2">{n}</div>)}
              {out.items.length > 0 && (
                <Card title="Distribución propuesta" subtitle={out.summary.method} actions={<AiExplainButton kind="recommendation" payload={{ capital: out.capitalAvailable, riskProfile: out.summary.riskProfile, method: out.summary.method, items: out.items.map((i) => ({ symbol: i.asset?.symbol, sector: i.sector, amount: i.amount, weight: i.weight, score: i.score, risk: i.risk, reasons: i.reasons })) }} />}>
                  <div className="row"><div className="col-md-5"><DonutChart data={out.items.map((i) => ({ key: i.asset?.symbol ?? '', value: i.amount, weight: i.weight / 100 }))} currency={profile?.base_currency} height={220} /></div>
                    <div className="col-md-7"><div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Instrumento</th><th className="text-end">Monto</th><th className="text-end">%</th><th className="text-end">Cant. est.</th><th className="text-center">Score</th><th>Riesgo</th></tr></thead>
                      <tbody>{out.items.map((i) => <tr key={i.asset_id}><td><Link to={`/market/${i.asset_id}`} className="fw-bold text-decoration-none">{i.asset?.symbol}</Link><div className="small text-muted">{i.sector}</div></td><td className="text-end">{fmtMoney(i.amount, profile?.base_currency)}</td><td className="text-end">{i.weight.toFixed(1)}%</td><td className="text-end">{fmtNum(i.estimated_quantity, 4)}</td><td className="text-center"><ScoreBadge score={i.score} /></td><td><span className={`badge text-bg-${riskTone(i.risk)}`}>{i.risk}</span></td></tr>)}</tbody></table></div></div></div>
                  <div className="row g-3 mt-1">{out.items.map((i) => <ItemCard key={i.asset_id} item={i} cur={profile?.base_currency} onRegister={() => setTx({ portfolio_id: portfolioId || data.portfolios[0]?.id, asset_id: i.asset_id, transaction_type: 'BUY', quantity: i.estimated_quantity ?? 0, price: i.asset ? (i.amount / (i.estimated_quantity || 1)) : 0, currency: i.asset?.currency })} />)}</div>
                  <div className="mt-3"><ModelDisclaimer text="Esta propuesta es una salida del modelo cuantitativo configurado (scores, correlación, volatilidad y límites de concentración). No es una garantía de rendimiento ni asesoría financiera. Tú decides qué ejecutar." /></div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {data.history.length > 0 && (
        <Card title="Propuestas anteriores">
          <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>Fecha</th><th className="text-end">Capital</th><th>Instrumentos</th><th>Modelo</th></tr></thead>
            <tbody>{data.history.map((h) => <tr key={h.id}><td>{fmtDate(h.created_at.slice(0, 10))}</td><td className="text-end">{fmtMoney(Number(h.capital_available), profile?.base_currency)}</td><td>{h.items?.map((i) => <span key={i.id} className={`badge me-1 ${i.executed ? 'text-bg-success' : 'text-bg-light border'}`}>{i.asset?.symbol} {Number(i.weight).toFixed(0)}%</span>)}</td><td className="small text-muted">{h.model_version}</td></tr>)}</tbody></table></div>
        </Card>
      )}
      {tx && <TransactionForm show onClose={() => setTx(null)} onSaved={() => toast.push('success', 'Compra registrada. El portafolio se actualizó.')} initial={tx} portfolios={data.portfolios} brokers={data.brokers} assets={data.assets} />}
    </>
  )
}

function ItemCard({ item, cur, onRegister }: { item: RecommendationItem; cur?: string; onRegister: () => void }) {
  return (
    <div className="col-md-6"><div className="border rounded p-3 h-100">
      <div className="d-flex justify-content-between align-items-start"><div><strong>{item.asset?.symbol}</strong> <span className="text-muted small">{item.asset?.name}</span></div><ScoreBadge score={item.score} /></div>
      <div className="small my-1">Monto: <strong>{fmtMoney(item.amount, cur)}</strong> · Peso: <strong>{item.weight.toFixed(1)}%</strong> · Sector: {item.sector ?? '—'} · Riesgo: {item.risk}</div>
      <div className="small fw-semibold mt-2">Motivos:</div>
      <ul className="small mb-2">{item.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
      <button className="btn btn-sm btn-outline-success" onClick={onRegister}><i className="bi bi-cart-plus me-1" />Registrar compra</button>
    </div></div>
  )
}
