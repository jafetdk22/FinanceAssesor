import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState, ErrorAlert, Field, Loading, Modal } from '@/components/ui'
import { ASSET_TYPES, CURRENCIES } from '@/constants'
import { useSettings } from '@/context/SettingsContext'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { marketService, type SymbolSearchResult } from '@/services/market.service'
import { portfolioService } from '@/services/portfolio.service'
import type { Asset } from '@/types'
import { fmtDate } from '@/utils/format'

const EMPTY: Partial<Asset> = { symbol: '', name: '', asset_type: 'STOCK', market: 'US', exchange: '', country: 'US', currency: 'USD', sector: '', industry: '' }

export default function MarketPage() {
  const toast = useToast()
  const { settings } = useSettings()
  const [q, setQ] = useState('')
  const [modal, setModal] = useState<Partial<Asset> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState<{ q: string; results: SymbolSearchResult[] | null; busy: boolean }>({ q: '', results: null, busy: false })

  const { data, loading, error, reload } = useAsync(async () => {
    const [assets, coverage] = await Promise.all([portfolioService.listAssets(), marketService.getPriceCoverage()])
    return { assets, coverage }
  }, [])

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return (data?.assets ?? []).filter((a) => !s || a.symbol.toLowerCase().includes(s) || a.name.toLowerCase().includes(s) || (a.sector ?? '').toLowerCase().includes(s))
  }, [data, q])

  const sync = async (a: Asset, full = false) => {
    setBusy(a.id)
    try {
      const r = await marketService.syncPrices(a.id, full)
      toast.push('success', `${r.symbol}: ${r.bars} barras (${r.provider})`)
      reload()
    } catch (e) {
      const err = e as Error & { code?: string }
      toast.push(err.code === 'RATE_LIMIT' ? 'warning' : 'danger', err.code === 'RATE_LIMIT' ? 'Límite de peticiones del proveedor alcanzado. Intenta más tarde.' : err.message)
    } finally { setBusy(null) }
  }

  const syncFund = async (a: Asset) => {
    setBusy(a.id)
    try { const r = await marketService.syncFundamentals(a.id); toast.push('success', `${r.symbol}: fundamentales actualizados`) }
    catch (e) { const err = e as Error & { code?: string }; toast.push(err.code === 'NO_DATA' ? 'warning' : 'danger', err.message) }
    finally { setBusy(null) }
  }

  const doSearch = async () => {
    if (!search.q.trim()) return
    setSearch((s) => ({ ...s, busy: true, results: null }))
    try { const results = await marketService.searchSymbols(search.q); setSearch((s) => ({ ...s, results, busy: false })) }
    catch (e) { toast.push('danger', (e as Error).message); setSearch((s) => ({ ...s, busy: false })) }
  }

  const saveAsset = async () => {
    if (!modal?.symbol?.trim() || !modal.name?.trim()) { toast.push('warning', 'Símbolo y nombre son obligatorios'); return }
    try { await portfolioService.saveAsset(modal); toast.push('success', 'Activo guardado'); setModal(null); reload() }
    catch (e) { toast.push('danger', (e as Error).message) }
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 className="page-title">Mercado · Catálogo de activos</h1>
        <div className="d-flex gap-2">
          <span className="badge text-bg-light align-self-center">Proveedor: {settings?.market_data_provider ?? '—'}</span>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({ ...EMPTY })}><i className="bi bi-plus-lg me-1" />Agregar activo</button>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-8">
          <Card>
            <div className="d-flex gap-2 mb-3">
              <input className="form-control" placeholder="Filtrar catálogo por símbolo, nombre o sector…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {loading && <Loading />}
            <ErrorAlert message={error} onRetry={reload} />
            {data && filtered.length === 0 && <EmptyState icon="search" title="Sin activos" />}
            {data && filtered.length > 0 && (
              <div className="table-responsive"><table className="table table-hover align-middle">
                <thead><tr><th>Símbolo</th><th>Nombre</th><th>Tipo</th><th>Sector</th><th>Datos históricos</th><th /></tr></thead>
                <tbody>{filtered.map((a) => {
                  const c = data.coverage.get(a.id)
                  return (
                    <tr key={a.id}>
                      <td><Link to={`/market/${a.id}`} className="fw-bold text-decoration-none">{a.symbol}</Link></td>
                      <td><div>{a.name}</div><small className="text-muted">{a.exchange} · {a.currency}</small></td>
                      <td><span className="badge text-bg-light">{a.asset_type}</span></td>
                      <td className="small">{a.sector ?? '—'}</td>
                      <td className="small">{c ? <><span className="text-success"><i className="bi bi-check-circle me-1" />{c.bars} días</span><div className="text-muted">{fmtDate(c.from)} → {fmtDate(c.to)}</div></> : <span className="text-muted">Sin datos</span>}</td>
                      <td className="text-end text-nowrap">
                        <button className="btn btn-sm btn-outline-primary me-1" disabled={busy === a.id} onClick={() => sync(a, !c)} title="Sincronizar precios">{busy === a.id ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-cloud-download" />}</button>
                        <button className="btn btn-sm btn-outline-secondary me-1" disabled={busy === a.id} onClick={() => syncFund(a)} title="Sincronizar fundamentales"><i className="bi bi-file-earmark-bar-graph" /></button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setModal({ ...a })} title="Editar"><i className="bi bi-pencil" /></button>
                      </td>
                    </tr>
                  )
                })}</tbody></table></div>
            )}
          </Card>
        </div>
        <div className="col-lg-4">
          <Card title="Buscar símbolo en el proveedor">
            <div className="input-group mb-2">
              <input className="form-control" placeholder="Ej. AAPL, Vanguard…" value={search.q} onChange={(e) => setSearch({ ...search, q: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
              <button className="btn btn-outline-primary" disabled={search.busy} onClick={doSearch}>{search.busy ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-search" />}</button>
            </div>
            {search.results && search.results.length === 0 && <div className="small text-muted">Sin resultados.</div>}
            {search.results && search.results.length > 0 && (
              <div className="list-group list-group-flush" style={{ maxHeight: 400, overflowY: 'auto' }}>
                {search.results.map((r, i) => (
                  <button key={i} className="list-group-item list-group-item-action small" onClick={() => setModal({ ...EMPTY, symbol: r.symbol, name: r.name, exchange: r.exchange ?? '', currency: r.currency ?? 'USD', country: r.country ?? '', asset_type: /etf/i.test(r.type ?? '') ? 'ETF' : 'STOCK' })}>
                    <strong>{r.symbol}</strong> {r.name}<div className="text-muted">{r.exchange} · {r.currency} · {r.type}</div>
                  </button>
                ))}
              </div>
            )}
            <div className="form-text mt-2">La búsqueda se realiza en el backend (Edge Function). El sector/industria se completan manualmente si el proveedor no los entrega.</div>
          </Card>
        </div>
      </div>

      <Modal show={!!modal} title={modal?.id ? 'Editar activo' : 'Nuevo activo'} onClose={() => setModal(null)}
        footer={<><button className="btn btn-light" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" onClick={saveAsset}>Guardar</button></>}>
        {modal && (
          <div className="row">
            <Field label="Símbolo"><input className="form-control text-uppercase" value={modal.symbol ?? ''} onChange={(e) => setModal({ ...modal, symbol: e.target.value })} /></Field>
            <Field label="Tipo"><select className="form-select" value={modal.asset_type} onChange={(e) => setModal({ ...modal, asset_type: e.target.value as Asset['asset_type'] })}>{ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Nombre" col="col-12"><input className="form-control" value={modal.name ?? ''} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></Field>
            <Field label="Exchange"><input className="form-control" value={modal.exchange ?? ''} onChange={(e) => setModal({ ...modal, exchange: e.target.value })} /></Field>
            <Field label="Mercado"><input className="form-control" value={modal.market ?? ''} onChange={(e) => setModal({ ...modal, market: e.target.value })} /></Field>
            <Field label="País"><input className="form-control" value={modal.country ?? ''} onChange={(e) => setModal({ ...modal, country: e.target.value })} /></Field>
            <Field label="Moneda"><select className="form-select" value={modal.currency} onChange={(e) => setModal({ ...modal, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Sector"><input className="form-control" value={modal.sector ?? ''} onChange={(e) => setModal({ ...modal, sector: e.target.value })} /></Field>
            <Field label="Industria"><input className="form-control" value={modal.industry ?? ''} onChange={(e) => setModal({ ...modal, industry: e.target.value })} /></Field>
            <Field label="ISIN"><input className="form-control" value={modal.isin ?? ''} onChange={(e) => setModal({ ...modal, isin: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </>
  )
}
