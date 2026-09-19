import { useState } from 'react'
import { Card, ConfirmButton, EmptyState, ErrorAlert, Field, Loading, Modal } from '@/components/ui'
import { BROKER_TYPES, CURRENCIES } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { portfolioService } from '@/services/portfolio.service'
import type { Broker } from '@/types'

const EMPTY: Partial<Broker> = { name: '', country: '', currency: 'USD', type: 'BROKER', commission_notes: '', notes: '', active: true }
const SUGGESTIONS = ['GBM', 'Interactive Brokers', 'Bursanet', 'Cetesdirecto', 'Charles Schwab', 'Trading 212']

export default function BrokersPage() {
  const { data, loading, error, reload } = useAsync(() => portfolioService.listBrokers(), [])
  const [modal, setModal] = useState<Partial<Broker> | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const save = async () => {
    if (!modal?.name?.trim()) { toast.push('warning', 'El nombre es obligatorio'); return }
    setBusy(true)
    try { await portfolioService.saveBroker(modal); toast.push('success', 'Broker guardado'); setModal(null); reload() }
    catch (e) { toast.push('danger', (e as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 className="page-title">Brokers</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ ...EMPTY })}><i className="bi bi-plus-lg me-1" />Nuevo broker</button>
      </div>
      {loading && <Loading />}
      <ErrorAlert message={error} onRetry={reload} />
      {data && (
        <Card>
          {data.length === 0 ? (
            <EmptyState icon="building" title="Sin brokers registrados" text="Registra las casas de bolsa o instituciones donde tienes tus inversiones. Las posiciones se registran manualmente; no se asume ninguna integración automática."
              action={<div className="d-flex gap-2 flex-wrap justify-content-center">{SUGGESTIONS.map((s) => <button key={s} className="btn btn-sm btn-outline-primary" onClick={() => setModal({ ...EMPTY, name: s })}>{s}</button>)}</div>} />
          ) : (
            <div className="table-responsive"><table className="table table-hover align-middle">
              <thead><tr><th>Nombre</th><th>País</th><th>Moneda</th><th>Tipo</th><th>Comisiones</th><th>Estado</th><th /></tr></thead>
              <tbody>{data.map((b) => (
                <tr key={b.id}>
                  <td className="fw-semibold">{b.name}</td><td>{b.country}</td><td>{b.currency}</td><td><span className="badge text-bg-light">{b.type}</span></td>
                  <td className="small text-muted">{b.commission_notes}</td>
                  <td>{b.active ? <span className="badge text-bg-success">Activo</span> : <span className="badge text-bg-secondary">Inactivo</span>}</td>
                  <td className="text-end"><button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setModal({ ...b })}><i className="bi bi-pencil" /></button>
                    <ConfirmButton onConfirm={async () => { try { await portfolioService.deleteBroker(b.id); reload() } catch (e) { toast.push('danger', 'No se puede eliminar: ' + (e as Error).message) } }} /></td>
                </tr>
              ))}</tbody></table></div>
          )}
        </Card>
      )}
      <Modal show={!!modal} title={modal?.id ? 'Editar broker' : 'Nuevo broker'} onClose={() => setModal(null)}
        footer={<><button className="btn btn-light" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy} onClick={save}>Guardar</button></>}>
        {modal && (
          <div className="row">
            <Field label="Nombre" col="col-12"><input className="form-control" list="broker-suggestions" value={modal.name ?? ''} onChange={(e) => setModal({ ...modal, name: e.target.value })} /><datalist id="broker-suggestions">{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist></Field>
            <Field label="País"><input className="form-control" value={modal.country ?? ''} onChange={(e) => setModal({ ...modal, country: e.target.value })} /></Field>
            <Field label="Moneda"><select className="form-select" value={modal.currency} onChange={(e) => setModal({ ...modal, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Tipo"><select className="form-select" value={modal.type} onChange={(e) => setModal({ ...modal, type: e.target.value })}>{BROKER_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Activo"><div className="form-check form-switch mt-2"><input className="form-check-input" type="checkbox" checked={!!modal.active} onChange={(e) => setModal({ ...modal, active: e.target.checked })} /></div></Field>
            <Field label="Notas de comisiones" col="col-12"><input className="form-control" value={modal.commission_notes ?? ''} onChange={(e) => setModal({ ...modal, commission_notes: e.target.value })} /></Field>
            <Field label="Notas" col="col-12"><textarea className="form-control" rows={2} value={modal.notes ?? ''} onChange={(e) => setModal({ ...modal, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </>
  )
}
