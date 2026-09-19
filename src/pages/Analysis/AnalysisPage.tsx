import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState, ErrorAlert, Loading, ModelDisclaimer, ScoreBadge } from '@/components/ui'
import { ASSET_TYPES } from '@/constants'
import { useSettings } from '@/context/SettingsContext'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { analysisService } from '@/services/analysis.service'
import { marketService } from '@/services/market.service'
import { portfolioService } from '@/services/portfolio.service'
import type { AnalysisResult } from '@/types'
import { fmtDate, fmtNum, fmtPct } from '@/utils/format'
import { riskLabel } from '@/utils/scoring'

type SortKey = 'total_score' | 'momentum_score' | 'volatility' | 'revenue_growth' | 'valuation_score' | 'risk_score' | 'fundamental_score' | 'technical_score'
const SORTS: Array<{ key: SortKey; label: string; desc: boolean }> = [
  { key: 'total_score', label: 'Top Score', desc: true },
  { key: 'momentum_score', label: 'Mayor Momentum', desc: true },
  { key: 'volatility', label: 'Menor Volatilidad', desc: false },
  { key: 'revenue_growth', label: 'Mayor crecimiento (ingresos)', desc: true },
  { key: 'valuation_score', label: 'Mejor valoración', desc: true },
  { key: 'risk_score', label: 'Menor riesgo (score)', desc: true },
  { key: 'fundamental_score', label: 'Mejor fundamental', desc: true },
  { key: 'technical_score', label: 'Mejor técnico', desc: true },
]

export default function AnalysisPage() {
  const { settings } = useSettings()
  const toast = useToast()
  const [sort, setSort] = useState<SortKey>('total_score')
  const [filters, setFilters] = useState({ market: '', country: '', sector: '', industry: '', type: '', minScore: 0, maxRisk: 'Alto' })
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  const { data, loading, error, reload } = useAsync(async () => {
    const [results, assets, coverage] = await Promise.all([analysisService.listLatest(), portfolioService.listAssets(), marketService.getPriceCoverage()])
    return { results, assets, coverage }
  }, [])

  const metric = (r: AnalysisResult, k: SortKey): number | null => {
    if (k === 'volatility' || k === 'revenue_growth') return r.explanation?.metrics?.[k] ?? null
    return r[k]
  }

  const rows = useMemo(() => {
    if (!data) return []
    const s = SORTS.find((x) => x.key === sort)!
    const riskOrder = { Bajo: 0, Medio: 1, Alto: 2, 'N/D': 3 }
    return data.results.filter((r) => {
      const a = r.asset
      if (!a) return false
      if (filters.market && a.market !== filters.market) return false
      if (filters.country && a.country !== filters.country) return false
      if (filters.sector && a.sector !== filters.sector) return false
      if (filters.industry && a.industry !== filters.industry) return false
      if (filters.type && a.asset_type !== filters.type) return false
      if (r.total_score < filters.minScore) return false
      if (riskOrder[riskLabel(r.risk_score)] > riskOrder[filters.maxRisk as keyof typeof riskOrder]) return false
      return true
    }).sort((a, b) => {
      const va = metric(a, sort), vb = metric(b, sort)
      if (va === null) return 1
      if (vb === null) return -1
      return s.desc ? vb - va : va - vb
    })
  }, [data, filters, sort])

  const uniq = (k: 'market' | 'country' | 'sector' | 'industry') => [...new Set((data?.assets ?? []).map((a) => a[k]).filter(Boolean))] as string[]

  const analyzeAll = async () => {
    if (!data || !settings) return
    const withData = data.assets.filter((a) => (data.coverage.get(a.id)?.bars ?? 0) >= 30)
    if (!withData.length) { toast.push('warning', 'Ningún activo tiene datos históricos suficientes. Sincroniza en Mercado.'); return }
    setBusy(true)
    let ok = 0
    for (let i = 0; i < withData.length; i++) {
      setProgress(`${i + 1}/${withData.length} · ${withData[i].symbol}`)
      try { await analysisService.analyzeAsset(withData[i], settings.score_weights); ok++ } catch (e) { console.error(e) }
    }
    setBusy(false); setProgress('')
    toast.push('success', `${ok} activos analizados`); reload()
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 className="page-title">Market Ranking</h1>
        <div className="d-flex gap-2">
          <Link to="/analysis/compare" className="btn btn-sm btn-outline-primary"><i className="bi bi-columns-gap me-1" />Comparar acciones</Link>
          <button className="btn btn-sm btn-primary" disabled={busy} onClick={analyzeAll}>{busy ? <><span className="spinner-border spinner-border-sm me-1" />{progress}</> : <><i className="bi bi-calculator me-1" />Analizar todos los activos con datos</>}</button>
        </div>
      </div>
      {loading && <Loading />}
      <ErrorAlert message={error} onRetry={reload} />
      {data && (
        <>
          <Card className="mb-3">
            <div className="row g-2 align-items-end">
              <div className="col-6 col-md-3 col-xl-2"><label className="form-label small">Criterio</label><select className="form-select form-select-sm" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>{SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
              {(['market', 'country', 'sector', 'industry'] as const).map((k) => (
                <div className="col-6 col-md-3 col-xl-2" key={k}><label className="form-label small text-capitalize">{{ market: 'Mercado', country: 'País', sector: 'Sector', industry: 'Industria' }[k]}</label>
                  <select className="form-select form-select-sm" value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}><option value="">Todos</option>{uniq(k).map((v) => <option key={v}>{v}</option>)}</select></div>
              ))}
              <div className="col-6 col-md-2 col-xl-1"><label className="form-label small">Tipo</label><select className="form-select form-select-sm" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="">Todos</option>{ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div className="col-6 col-md-2 col-xl-1"><label className="form-label small">Score mín.</label><input type="number" min={0} max={100} className="form-control form-control-sm" value={filters.minScore} onChange={(e) => setFilters({ ...filters, minScore: Number(e.target.value) })} /></div>
              <div className="col-6 col-md-2 col-xl-1"><label className="form-label small">Riesgo máx.</label><select className="form-select form-select-sm" value={filters.maxRisk} onChange={(e) => setFilters({ ...filters, maxRisk: e.target.value })}>{['Bajo', 'Medio', 'Alto'].map((r) => <option key={r}>{r}</option>)}</select></div>
            </div>
            <div className="small text-muted mt-2">Ordenando por: <strong>{SORTS.find((s) => s.key === sort)?.label}</strong> · {rows.length} resultados</div>
          </Card>
          <Card>
            {data.results.length === 0 ? <EmptyState icon="clipboard-data" title="Sin análisis" text="Sincroniza datos de mercado y ejecuta el análisis para generar scores." /> : rows.length === 0 ? <EmptyState icon="funnel" title="Sin resultados con estos filtros" /> : (
              <div className="table-responsive"><table className="table table-hover align-middle">
                <thead><tr><th>#</th><th>Activo</th><th>Sector</th><th className="text-center">Score</th><th className="text-center">Fund.</th><th className="text-center">Técn.</th><th className="text-center">Riesgo</th><th className="text-center">Valuac.</th><th className="text-center">Mom.</th><th className="text-end">Volat.</th><th className="text-end">Crec. ing.</th><th>Riesgo</th><th>Fecha</th></tr></thead>
                <tbody>{rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td><Link to={`/market/${r.asset_id}`} className="fw-bold text-decoration-none">{r.asset?.symbol}</Link><div className="small text-muted">{r.asset?.name}</div></td>
                    <td className="small">{r.asset?.sector ?? '—'}</td>
                    <td className="text-center"><ScoreBadge score={r.total_score} /></td>
                    <td className="text-center">{fmtNum(r.fundamental_score, 0)}</td><td className="text-center">{fmtNum(r.technical_score, 0)}</td><td className="text-center">{fmtNum(r.risk_score, 0)}</td><td className="text-center">{fmtNum(r.valuation_score, 0)}</td><td className="text-center">{fmtNum(r.momentum_score, 0)}</td>
                    <td className="text-end">{fmtPct(r.explanation?.metrics?.volatility, 1)}</td>
                    <td className="text-end">{fmtPct(r.explanation?.metrics?.revenue_growth, 1)}</td>
                    <td><span className={`badge text-bg-${{ Bajo: 'success', Medio: 'warning', Alto: 'danger', 'N/D': 'secondary' }[riskLabel(r.risk_score)]}`}>{riskLabel(r.risk_score)}</span></td>
                    <td className="small text-muted">{fmtDate(r.analysis_date)}</td>
                  </tr>
                ))}</tbody></table></div>
            )}
            <div className="mt-3"><ModelDisclaimer /></div>
          </Card>
        </>
      )}
    </>
  )
}
