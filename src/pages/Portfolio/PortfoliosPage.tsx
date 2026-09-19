import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, ConfirmButton, EmptyState, ErrorAlert, Field, Loading, Modal } from '@/components/ui'
import { CURRENCIES, RISK_PROFILES } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { marketService } from '@/services/market.service'
import { portfolioService } from '@/services/portfolio.service'
import type { Portfolio } from '@/types'
import { fmtMoney, fmtPct, pnlClass } from '@/utils/format'
import { valuePositions } from '@/utils/portfolioAnalyzer'

const EMPTY: Partial<Portfolio> = { name: '', description: '', risk_profile: 'MODERATE', target_horizon_years: 5, base_currency: 'USD' }

export default function PortfoliosPage() {
  const toast = useToast()
  const [modal, setModal] = useState<Partial<Portfolio> | null>(null)
  const [busy, setBusy] = useState(false)
  const { data, loading, error, reload } = useAsync(async () => {
    const [portfolios, positions] = await Promise.all([portfolioService.listPortfolios(), portfolioService.listPositions()])
    const prices = await marketService.getLastPrices([...new Set(positions.map((p) => p.asset_id))])
    const valued = valuePositions(positions, prices)
    return portfolios.map((p) => {
      const mine = valued.filter((v) => v.portfolio_id === p.id)
      const invested = mine.reduce((s, v) => s + v.invested, 0)
      const value = mine.reduce((s, v) => s + (v.marketValue ?? v.invested), 0)
      return { ...p, positions: mine.length, invested, value, pnl: value - invested, pnlPct: invested > 0 ? value / invested - 1 : null }
    })
  }, [])

  const save = async () => {
    if (!modal?.name?.trim()) { toast.push('warning', 'Nombre requerido'); return }
    setBusy(true)
    try { await portfolioService.savePortfolio(modal); setModal(null); reload(); toast.push('success', 'Portafolio guardado') }
    catch (e) { toast.push('danger', (e as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 className="page-title">Portafolios</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ ...EMPTY })}><i className="bi bi-plus-lg me-1" />Nuevo portafolio</button>
      </div>
      {loading && <Loading />}
      <ErrorAlert message={error} onRetry={reload} />
      {data && data.length === 0 && <Card><EmptyState icon="briefcase" title="Sin portafolios" text="Crea portafolios como Largo plazo, Crecimiento, Dividendos o Conservador." /></Card>}
      <div className="row g-3">
        {data?.map((p) => (
          <div className="col-md-6 col-xl-4" key={p.id}>
            <div className="card shadow-sm border-0 h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div><Link to={`/portfolios/${p.id}`} className="fw-bold fs-6 text-decoration-none">{p.name}</Link><div className="small text-muted">{p.description}</div></div>
                  <span className="badge text-bg-light">{RISK_PROFILES.find((r) => r.value === p.risk_profile)?.label}</span>
                </div>
                <div className="row mt-3 g-2 small">
                  <div className="col-6"><div className="text-muted">Invertido</div><div className="fw-semibold">{fmtMoney(p.invested, p.base_currency)}</div></div>
                  <div className="col-6"><div className="text-muted">Valor actual</div><div className="fw-semibold">{fmtMoney(p.value, p.base_currency)}</div></div>
                  <div className="col-6"><div className="text-muted">G/P</div><div className={`fw-semibold ${pnlClass(p.pnl)}`}>{fmtMoney(p.pnl, p.base_currency)} ({fmtPct(p.pnlPct)})</div></div>
                  <div className="col-6"><div className="text-muted">Posiciones</div><div className="fw-semibold">{p.positions} · {p.target_horizon_years} años</div></div>
                </div>
              </div>
              <div className="card-footer bg-white d-flex justify-content-between">
                <Link to={`/portfolios/${p.id}`} className="btn btn-sm btn-outline-primary">Ver detalle</Link>
                <span><button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setModal({ ...p })}><i className="bi bi-pencil" /></button>
                  <ConfirmButton onConfirm={async () => { try { await portfolioService.deletePortfolio(p.id); reload() } catch (e) { toast.push('danger', (e as Error).message) } }} /></span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Modal show={!!modal} title={modal?.id ? 'Editar portafolio' : 'Nuevo portafolio'} onClose={() => setModal(null)}
        footer={<><button className="btn btn-light" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy} onClick={save}>Guardar</button></>}>
        {modal && (
          <div className="row">
            <Field label="Nombre" col="col-12"><input className="form-control" value={modal.name ?? ''} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></Field>
            <Field label="Descripción" col="col-12"><input className="form-control" value={modal.description ?? ''} onChange={(e) => setModal({ ...modal, description: e.target.value })} /></Field>
            <Field label="Perfil de riesgo"><select className="form-select" value={modal.risk_profile} onChange={(e) => setModal({ ...modal, risk_profile: e.target.value as Portfolio['risk_profile'] })}>{RISK_PROFILES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Field>
            <Field label="Horizonte (años)"><input type="number" min={1} className="form-control" value={modal.target_horizon_years} onChange={(e) => setModal({ ...modal, target_horizon_years: Number(e.target.value) })} /></Field>
            <Field label="Moneda base"><select className="form-select" value={modal.base_currency} onChange={(e) => setModal({ ...modal, base_currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          </div>
        )}
      </Modal>
    </>
  )
}
