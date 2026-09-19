import { useState } from 'react'
import { Card, EmptyState, ErrorAlert, Field, Loading, ModelDisclaimer, StatCard } from '@/components/ui'
import { ValueAreaChart } from '@/components/charts'
import AssetPicker from '@/components/AssetPicker'
import { useSettings } from '@/context/SettingsContext'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { marketService } from '@/services/market.service'
import { portfolioService } from '@/services/portfolio.service'
import { backtestService } from '@/services/recommendation.service'
import { runBacktest, type BacktestConfig, type BacktestResult, type Strategy } from '@/utils/backtesting'
import { fmtDate, fmtMoney, fmtNum, fmtPct } from '@/utils/format'

const STRATEGIES: Array<{ value: Strategy; label: string; desc: string }> = [
  { value: 'BUY_AND_HOLD', label: 'Buy & Hold (pesos iguales)', desc: 'Compra todos los activos seleccionados con pesos iguales y rebalancea mensualmente con las aportaciones.' },
  { value: 'SCORE_THRESHOLD', label: 'Score técnico > umbral', desc: 'Cada mes mantiene sólo los activos cuyo score técnico/riesgo/momentum (calculado con datos hasta esa fecha) supera el umbral.' },
  { value: 'SMA_TREND', label: 'Tendencia SMA 200', desc: 'Cada mes mantiene sólo los activos cuyo precio está por encima de su SMA 200.' },
]

export default function BacktestingPage() {
  const { settings } = useSettings()
  const toast = useToast()
  const { data, loading, error, reload } = useAsync(async () => {
    const [assets, coverage, history] = await Promise.all([portfolioService.listAssets(), marketService.getPriceCoverage(), backtestService.list()])
    return { assets: assets.filter((a) => (coverage.get(a.id)?.bars ?? 0) >= 60), coverage, history }
  }, [])
  const [cfg, setCfg] = useState({ initialCapital: 100000, periodicContribution: 10000, startDate: '2020-01-01', endDate: new Date().toISOString().slice(0, 10), strategy: 'BUY_AND_HOLD' as Strategy, scoreThreshold: 60, commissionPct: 0.25 })
  const [selected, setSelected] = useState<(string | null)[]>([null, null, null])
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    const ids = selected.filter(Boolean) as string[]
    if (!ids.length) { toast.push('warning', 'Selecciona al menos un activo'); return }
    if (!data) return
    setBusy(true)
    try {
      const prices = await marketService.getPricesForAssets(ids, 5000)
      const config: BacktestConfig = { ...cfg, commissionPct: cfg.commissionPct / 100, assetIds: ids, weights: settings?.score_weights ?? { fundamental: 0, technical: 40, risk: 30, valuation: 0, momentum: 30 } }
      const r = runBacktest(config, prices, new Map(data.assets.map((a) => [a.id, a.symbol])))
      setResult(r)
      r.warnings.forEach((w) => toast.push('warning', w))
      const { equity, ...summary } = r
      void equity
      await backtestService.save(`${cfg.strategy} · ${ids.map((i) => data.assets.find((a) => a.id === i)?.symbol).join(', ')}`, config, summary)
      reload()
    } catch (e) { toast.push('danger', (e as Error).message) } finally { setBusy(false) }
  }

  if (loading) return <Loading />
  if (error) return <ErrorAlert message={error} onRetry={reload} />
  if (!data) return null

  return (
    <>
      <h1 className="page-title mb-3">Backtesting</h1>
      <div className="alert alert-warning small"><i className="bi bi-exclamation-triangle me-2" />El rendimiento histórico no garantiza resultados futuros. Las simulaciones usan precios de cierre reales sin considerar impuestos, slippage ni tipo de cambio.</div>
      <div className="row g-3 mb-3">
        <div className="col-lg-4">
          <Card title="Configuración">
            {data.assets.length === 0 && <div className="alert alert-info small">No hay activos con ≥ 60 días de históricos. Sincroniza en Mercado.</div>}
            <div className="row">
              <Field label="Capital inicial" col="col-6"><input type="number" className="form-control" value={cfg.initialCapital} onChange={(e) => setCfg({ ...cfg, initialCapital: Number(e.target.value) })} /></Field>
              <Field label="Aportación mensual" col="col-6"><input type="number" className="form-control" value={cfg.periodicContribution} onChange={(e) => setCfg({ ...cfg, periodicContribution: Number(e.target.value) })} /></Field>
              <Field label="Fecha inicial" col="col-6"><input type="date" className="form-control" value={cfg.startDate} onChange={(e) => setCfg({ ...cfg, startDate: e.target.value })} /></Field>
              <Field label="Fecha final" col="col-6"><input type="date" className="form-control" value={cfg.endDate} onChange={(e) => setCfg({ ...cfg, endDate: e.target.value })} /></Field>
              <Field label="Estrategia" col="col-12" help={STRATEGIES.find((s) => s.value === cfg.strategy)?.desc}><select className="form-select" value={cfg.strategy} onChange={(e) => setCfg({ ...cfg, strategy: e.target.value as Strategy })}>{STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
              {cfg.strategy === 'SCORE_THRESHOLD' && <Field label="Umbral de score" col="col-6"><input type="number" min={0} max={100} className="form-control" value={cfg.scoreThreshold} onChange={(e) => setCfg({ ...cfg, scoreThreshold: Number(e.target.value) })} /></Field>}
              <Field label="Comisión (%)" col="col-6"><input type="number" step="0.01" className="form-control" value={cfg.commissionPct} onChange={(e) => setCfg({ ...cfg, commissionPct: Number(e.target.value) })} /></Field>
              <div className="col-12 mb-2"><label className="form-label small fw-semibold">Activos (con históricos)</label>
                {selected.map((v, i) => <div className="d-flex gap-1 mb-1" key={i}><div className="flex-grow-1"><AssetPicker assets={data.assets} value={v} onChange={(a) => setSelected(selected.map((x, j) => (j === i ? a?.id ?? null : x)))} /></div>{selected.length > 1 && <button className="btn btn-outline-secondary" onClick={() => setSelected(selected.filter((_, j) => j !== i))}><i className="bi bi-x" /></button>}</div>)}
                {selected.length < 10 && <button className="btn btn-sm btn-link p-0" onClick={() => setSelected([...selected, null])}>+ Agregar activo</button>}
              </div>
              <div className="col-12"><button className="btn btn-primary w-100" disabled={busy} onClick={run}>{busy ? 'Simulando…' : 'Ejecutar backtest'}</button></div>
            </div>
          </Card>
        </div>
        <div className="col-lg-8">
          {!result ? <Card><EmptyState icon="clock-history" title="Sin resultados" text="Configura y ejecuta una simulación." /></Card> : (
            <>
              <div className="row g-3 mb-3">
                <div className="col-6 col-md-3"><StatCard label="Capital aportado" value={fmtMoney(result.contributed, 'USD')} /></div>
                <div className="col-6 col-md-3"><StatCard label="Valor final" value={fmtMoney(result.finalValue, 'USD')} /></div>
                <div className="col-6 col-md-3"><StatCard label="Rendimiento" value={<span className={result.totalReturn >= 0 ? 'text-success' : 'text-danger'}>{fmtPct(result.totalReturn, 1)}</span>} /></div>
                <div className="col-6 col-md-3"><StatCard label="CAGR" value={fmtPct(result.cagr, 2)} /></div>
                <div className="col-6 col-md-3"><StatCard label="Máx. drawdown" value={<span className="text-danger">{fmtPct(result.maxDrawdown, 1)}</span>} /></div>
                <div className="col-6 col-md-3"><StatCard label="Volatilidad" value={fmtPct(result.volatility, 1)} /></div>
                <div className="col-6 col-md-3"><StatCard label="Sharpe" value={fmtNum(result.sharpe, 2)} /></div>
                <div className="col-6 col-md-3"><StatCard label="Operaciones" value={result.trades} hint={`Comisiones ${fmtMoney(result.commissionsPaid, 'USD')}`} /></div>
              </div>
              <Card title="Evolución del capital"><ValueAreaChart data={result.equity} currency="USD" extraKey="contributed" extraLabel="Aportado" height={300} /><div className="mt-2"><ModelDisclaimer text="Los montos se muestran en la moneda nominal de los activos (sin conversión). El CAGR es una aproximación sobre el capital total aportado." /></div></Card>
            </>
          )}
        </div>
      </div>
      {data.history.length > 0 && (
        <Card title="Simulaciones anteriores">
          <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Fecha</th><th>Nombre</th><th className="text-end">Aportado</th><th className="text-end">Final</th><th className="text-end">Rend.</th><th className="text-end">CAGR</th><th className="text-end">MDD</th></tr></thead>
            <tbody>{data.history.map((h) => { const r = h.results as { contributed: number; finalValue: number; totalReturn: number; cagr: number | null; maxDrawdown: number }; return <tr key={h.id}><td>{fmtDate(h.created_at.slice(0, 10))}</td><td className="small">{h.name}</td><td className="text-end">{fmtMoney(r.contributed, 'USD')}</td><td className="text-end">{fmtMoney(r.finalValue, 'USD')}</td><td className="text-end">{fmtPct(r.totalReturn, 1)}</td><td className="text-end">{fmtPct(r.cagr, 2)}</td><td className="text-end">{fmtPct(r.maxDrawdown, 1)}</td></tr> })}</tbody></table></div>
        </Card>
      )}
    </>
  )
}
