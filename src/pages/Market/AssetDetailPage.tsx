import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, EmptyState, ErrorAlert, Loading, ModelDisclaimer, ScoreBadge, ScoreBar, StatCard } from '@/components/ui'
import { OscillatorChart, PriceChart } from '@/components/charts'
import AiExplainButton from '@/components/AiExplainButton'
import { useSettings } from '@/context/SettingsContext'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { analysisService } from '@/services/analysis.service'
import { marketService } from '@/services/market.service'
import { portfolioService } from '@/services/portfolio.service'
import { fmtCompact, fmtDate, fmtMoney, fmtNum, fmtPct } from '@/utils/format'
import { computeTechnicalSnapshot, indicatorSeries } from '@/utils/indicators'
import { riskLabel } from '@/utils/scoring'

export default function AssetDetailPage() {
  const { id } = useParams()
  const { settings } = useSettings()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [range, setRange] = useState(252)

  const { data, loading, error, reload } = useAsync(async () => {
    const assets = await portfolioService.listAssets()
    const asset = assets.find((a) => a.id === id)
    if (!asset) throw new Error('Activo no encontrado')
    const [prices, fundamentals, analysis, history] = await Promise.all([
      marketService.getPrices(asset.id, 1500), marketService.getFundamentals(asset.id), analysisService.getLatestForAsset(asset.id), analysisService.history(asset.id),
    ])
    return { asset, prices, fundamentals, analysis, history }
  }, [id])

  const tech = useMemo(() => (data ? computeTechnicalSnapshot(data.prices) : null), [data])
  const series = useMemo(() => (data ? indicatorSeries(data.prices).slice(-range) : []), [data, range])

  const analyze = async () => {
    if (!data || !settings) return
    setBusy(true)
    try {
      const r = await analysisService.analyzeAsset(data.asset, settings.score_weights)
      r.warnings.forEach((w) => toast.push('warning', w))
      toast.push('success', `Score ${r.output.total.toFixed(0)} calculado`); reload()
    } catch (e) { toast.push('danger', (e as Error).message) } finally { setBusy(false) }
  }
  const syncAll = async () => {
    if (!data) return
    setBusy(true)
    try {
      await marketService.syncPrices(data.asset.id, data.prices.length === 0)
      try { await marketService.syncFundamentals(data.asset.id) } catch (e) { toast.push('warning', 'Fundamentales: ' + (e as Error).message) }
      toast.push('success', 'Datos sincronizados'); reload()
    } catch (e) { toast.push('danger', (e as Error).message) } finally { setBusy(false) }
  }

  if (loading) return <Loading />
  if (error) return <ErrorAlert message={error} onRetry={reload} />
  if (!data) return null
  const { asset, fundamentals: f, analysis: an } = data
  const cur = asset.currency

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <Link to="/market" className="small text-decoration-none"><i className="bi bi-arrow-left" /> Mercado</Link>
          <h1 className="page-title">{asset.symbol} <small className="text-muted fw-normal fs-6">{asset.name}</small></h1>
          <div className="small text-muted">{asset.asset_type} · {asset.exchange} · {asset.sector ?? 'Sin sector'} · {asset.country}</div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {an && <AiExplainButton kind="asset" payload={{ symbol: asset.symbol, name: asset.name, sector: asset.sector, scores: { total: an.total_score, fundamental: an.fundamental_score, technical: an.technical_score, risk: an.risk_score, valuation: an.valuation_score, momentum: an.momentum_score }, weights: an.weights, positives: an.explanation.positives, negatives: an.explanation.negatives, metrics: an.explanation.metrics }} />}
          <button className="btn btn-sm btn-outline-primary" disabled={busy} onClick={syncAll}><i className="bi bi-cloud-download me-1" />Sincronizar datos</button>
          <button className="btn btn-sm btn-primary" disabled={busy || data.prices.length < 30} onClick={analyze}><i className="bi bi-calculator me-1" />Calcular score</button>
        </div>
      </div>

      {data.prices.length === 0 && <Card><EmptyState icon="cloud-download" title="Sin datos históricos" text="Sincroniza los precios desde el proveedor configurado para calcular indicadores." action={<button className="btn btn-primary btn-sm" disabled={busy} onClick={syncAll}>Sincronizar ahora</button>} /></Card>}

      {tech && (
        <>
          <div className="row g-3 mb-3">
            <div className="col-6 col-lg-3"><StatCard label="Último cierre" value={fmtMoney(tech.lastClose, cur)} hint={fmtDate(tech.lastDate)} icon="currency-dollar" /></div>
            <div className="col-6 col-lg-3"><StatCard label="Score" value={<ScoreBadge score={an?.total_score} />} hint={an ? `${fmtDate(an.analysis_date)} · ${an.model_version}` : 'Sin calcular'} icon="award" tone="success" /></div>
            <div className="col-6 col-lg-3"><StatCard label="Rendimiento 1 año" value={<span className={(tech.return1y ?? 0) >= 0 ? 'text-success' : 'text-danger'}>{fmtPct(tech.return1y, 1)}</span>} hint={`Vol. ${fmtPct(tech.volatility, 1)}`} icon="graph-up-arrow" tone="primary" /></div>
            <div className="col-6 col-lg-3"><StatCard label="Riesgo" value={riskLabel(an?.risk_score ?? null)} hint={`Drawdown ${fmtPct(tech.maxDrawdown, 1)}`} icon="shield-exclamation" tone="warning" /></div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-lg-8">
              <Card title="Precio e indicadores" actions={<div className="btn-group btn-group-sm">{[[63, '3M'], [126, '6M'], [252, '1A'], [756, '3A'], [5000, 'Todo']].map(([v, l]) => <button key={v} className={`btn btn-outline-secondary ${range === v ? 'active' : ''}`} onClick={() => setRange(v as number)}>{l}</button>)}</div>}>
                <PriceChart data={series} />
                <div className="row mt-2">
                  <div className="col-md-6"><div className="small fw-semibold text-muted">RSI 14</div><OscillatorChart data={series} keys={[{ key: 'rsi', name: 'RSI' }]} height={140} /></div>
                  <div className="col-md-6"><div className="small fw-semibold text-muted">MACD</div><OscillatorChart data={series} keys={[{ key: 'macdHist', name: 'Hist', bar: true, color: '#94a3b8' }, { key: 'macd', name: 'MACD' }, { key: 'macdSignal', name: 'Señal', color: '#f59e0b' }]} height={140} /></div>
                </div>
              </Card>
            </div>
            <div className="col-lg-4">
              <Card title="Indicadores técnicos" subtitle={`${tech.bars} días de datos`}>
                <div className="table-responsive"><table className="table table-sm small mb-0"><tbody>
                  {[['SMA 20 / 50 / 200', `${fmtNum(tech.sma20)} / ${fmtNum(tech.sma50)} / ${fmtNum(tech.sma200)}`], ['EMA 20 / 50 / 200', `${fmtNum(tech.ema20)} / ${fmtNum(tech.ema50)} / ${fmtNum(tech.ema200)}`],
                    ['RSI 14', fmtNum(tech.rsi14, 1)], ['MACD / Señal', `${fmtNum(tech.macd, 3)} / ${fmtNum(tech.macdSignal, 3)}`], ['Bollinger %B', fmtNum(tech.bbPct, 2)], ['ATR 14 (%)', fmtPct(tech.atrPct, 2)], ['ADX 14', fmtNum(tech.adx14, 1)],
                    ['OBV tendencia', tech.obvTrend === null ? '—' : tech.obvTrend > 0 ? 'Alza' : tech.obvTrend < 0 ? 'Baja' : 'Plano'],
                    ['Momentum 1M / 3M / 6M / 12M', `${fmtPct(tech.momentum1m, 1)} / ${fmtPct(tech.momentum3m, 1)} / ${fmtPct(tech.momentum6m, 1)} / ${fmtPct(tech.momentum12m, 1)}`],
                    ['Volatilidad anual', fmtPct(tech.volatility, 1)], ['Máx. drawdown (1A)', fmtPct(tech.maxDrawdown, 1)], ['Sharpe (rf 4%)', fmtNum(tech.sharpe, 2)], ['Beta', fmtNum(tech.beta ?? f?.beta, 2)], ['Dist. a máx. 52s', fmtPct(tech.distToHigh52w, 1)],
                  ].map(([k, v]) => <tr key={k as string}><td className="text-muted">{k}</td><td className="text-end fw-semibold">{v}</td></tr>)}
                </tbody></table></div>
              </Card>
            </div>
          </div>
        </>
      )}

      <div className="row g-3 mb-3">
        <div className="col-lg-6">
          <Card title="Fundamentales" subtitle={f ? `${f.provider} · ${fmtDate(f.as_of)}` : undefined}>
            {!f ? <EmptyState icon="file-earmark-bar-graph" title="Sin fundamentales" text="Sincroniza los datos; algunos activos (ETFs, CETES) no tienen fundamentales." /> : (
              <div className="row small">
                {[['Market cap', fmtCompact(f.market_cap)], ['Revenue (TTM)', fmtCompact(f.revenue)], ['Revenue growth', fmtPct(f.revenue_growth, 1)], ['EPS', fmtNum(f.eps)], ['EPS growth', fmtPct(f.eps_growth, 1)], ['Net income', fmtCompact(f.net_income)],
                  ['Free cash flow', fmtCompact(f.free_cash_flow)], ['Gross margin', fmtPct(f.gross_margin, 1)], ['Operating margin', fmtPct(f.operating_margin, 1)], ['Net margin', fmtPct(f.net_margin, 1)], ['ROE', fmtPct(f.roe, 1)], ['ROA', fmtPct(f.roa, 1)],
                  ['Debt/Equity', fmtNum(f.debt_to_equity)], ['Current ratio', fmtNum(f.current_ratio)], ['P/E', fmtNum(f.pe, 1)], ['PEG', fmtNum(f.peg)], ['P/B', fmtNum(f.pb)], ['Dividend yield', fmtPct(f.dividend_yield, 2)], ['Payout ratio', fmtPct(f.payout_ratio, 1)],
                ].map(([k, v]) => <div className="col-6 col-md-4 mb-2" key={k as string}><div className="text-muted">{k}</div><div className="fw-semibold">{v}</div></div>)}
              </div>
            )}
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Explicación del score" subtitle={an ? `Modelo ${an.model_version} · pesos ${Object.entries(an.weights).map(([k, v]) => `${k} ${v}%`).join(', ')}` : undefined}>
            {!an ? <EmptyState icon="calculator" title="Sin score" text="Calcula el score con los datos disponibles." /> : (
              <>
                <div className="d-flex align-items-center gap-3 mb-3"><span className="display-6 fw-bold">{an.total_score.toFixed(0)}</span><span className="text-muted">/ 100</span></div>
                <ScoreBar label="Fundamental" score={an.fundamental_score} /><ScoreBar label="Técnico" score={an.technical_score} /><ScoreBar label="Riesgo" score={an.risk_score} /><ScoreBar label="Valuación" score={an.valuation_score} /><ScoreBar label="Momentum" score={an.momentum_score} />
                <div className="row mt-3">
                  <div className="col-md-6"><div className="small fw-semibold text-success mb-1">Factores positivos</div><ul className="small mb-2">{an.explanation.positives.map((p, i) => <li key={i}>+ {p.label} <span className="text-muted">({p.detail})</span></li>)}{!an.explanation.positives.length && <li className="text-muted">Ninguno</li>}</ul></div>
                  <div className="col-md-6"><div className="small fw-semibold text-danger mb-1">Factores negativos</div><ul className="small mb-2">{an.explanation.negatives.map((p, i) => <li key={i}>− {p.label} <span className="text-muted">({p.detail})</span></li>)}{!an.explanation.negatives.length && <li className="text-muted">Ninguno</li>}</ul></div>
                </div>
                {an.explanation.missing.length > 0 && <div className="alert alert-warning small py-2">Datos faltantes: {an.explanation.missing.join(', ')}</div>}
                <details className="small"><summary className="cursor-pointer">Ver metodología completa (reglas y puntos)</summary>
                  {Object.entries(an.explanation.categories).map(([cat, c]) => (
                    <div key={cat} className="mt-2"><div className="fw-semibold text-capitalize">{cat}: {c.score === null ? 'sin datos' : c.score.toFixed(1)}</div>
                      <div className="table-responsive"><table className="table table-sm mb-0"><tbody>{c.components.map((x) => <tr key={x.metric}><td>{x.metric}</td><td>{x.value === null ? '—' : fmtNum(x.value, 3)}</td><td className="text-end">{x.points}/{x.max}</td><td className="text-muted">{x.rule}</td></tr>)}</tbody></table></div></div>
                  ))}
                </details>
                <div className="mt-2"><ModelDisclaimer /></div>
              </>
            )}
          </Card>
        </div>
      </div>
      {data.history.length > 1 && (
        <Card title="Historial de scores"><div className="d-flex gap-2 flex-wrap">{data.history.map((h) => <span key={h.id} className="badge text-bg-light border">{fmtDate(h.analysis_date)}: <strong>{h.total_score.toFixed(0)}</strong></span>)}</div></Card>
      )}
    </>
  )
}
