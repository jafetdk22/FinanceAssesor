import { useEffect, useMemo, useState } from 'react'
import { Field, Modal } from '@/components/ui'
import { CURRENCIES, TRANSACTION_TYPES } from '@/constants'
import { useToast } from '@/hooks/useToast'
import { portfolioService } from '@/services/portfolio.service'
import type { Asset, Broker, InvestmentTransaction, Portfolio, TransactionType } from '@/types'
import { today } from '@/utils/format'
import AssetPicker from './AssetPicker'

const NEEDS_ASSET: TransactionType[] = ['BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'TRANSFER']
const NEEDS_QTY: TransactionType[] = ['BUY', 'SELL', 'SPLIT', 'TRANSFER']
const NEEDS_PRICE: TransactionType[] = ['BUY', 'SELL', 'TRANSFER']

export default function TransactionForm({ show, onClose, onSaved, initial, portfolios, brokers, assets }: {
  show: boolean; onClose: () => void; onSaved: () => void; initial?: Partial<InvestmentTransaction>
  portfolios: Portfolio[]; brokers: Broker[]; assets: Asset[]
}) {
  const toast = useToast()
  const [tx, setTx] = useState<Partial<InvestmentTransaction>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setTx({ transaction_type: 'BUY', quantity: 0, price: 0, amount: 0, commission: 0, currency: 'USD', transaction_date: today(), portfolio_id: portfolios[0]?.id, broker_id: brokers[0]?.id ?? null, ...initial })
  }, [initial, show, portfolios, brokers])

  const type = (tx.transaction_type ?? 'BUY') as TransactionType
  const computedAmount = useMemo(() => (NEEDS_PRICE.includes(type) ? Number(tx.quantity || 0) * Number(tx.price || 0) : Number(tx.amount || 0)), [tx, type])

  const save = async () => {
    if (!tx.portfolio_id) { toast.push('warning', 'Selecciona un portafolio'); return }
    if (NEEDS_ASSET.includes(type) && !tx.asset_id) { toast.push('warning', 'Selecciona un activo'); return }
    if (NEEDS_QTY.includes(type) && Number(tx.quantity) <= 0) { toast.push('warning', 'La cantidad debe ser mayor a 0'); return }
    if (NEEDS_PRICE.includes(type) && Number(tx.price) <= 0) { toast.push('warning', 'El precio debe ser mayor a 0'); return }
    setBusy(true)
    try {
      await portfolioService.saveTransaction({ ...tx, amount: computedAmount, asset_id: NEEDS_ASSET.includes(type) ? tx.asset_id : null })
      toast.push('success', 'Transacción registrada'); onSaved(); onClose()
    } catch (e) { toast.push('danger', (e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal show={show} title={tx.id ? 'Editar transacción' : 'Registrar transacción'} onClose={onClose} size="modal-lg"
      footer={<><button className="btn btn-light" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={busy} onClick={save}>Guardar</button></>}>
      <div className="row">
        <Field label="Tipo"><select className="form-select" value={type} onChange={(e) => setTx({ ...tx, transaction_type: e.target.value as TransactionType })}>{TRANSACTION_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Fecha"><input type="date" className="form-control" value={tx.transaction_date ?? ''} onChange={(e) => setTx({ ...tx, transaction_date: e.target.value })} /></Field>
        <Field label="Portafolio"><select className="form-select" value={tx.portfolio_id ?? ''} onChange={(e) => setTx({ ...tx, portfolio_id: e.target.value })}>{portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Broker"><select className="form-select" value={tx.broker_id ?? ''} onChange={(e) => setTx({ ...tx, broker_id: e.target.value || null })}><option value="">—</option>{brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        {NEEDS_ASSET.includes(type) && (
          <Field label="Activo" col="col-12"><AssetPicker assets={assets} value={tx.asset_id ?? null} onChange={(a) => setTx({ ...tx, asset_id: a?.id ?? null, currency: a?.currency ?? tx.currency })} /></Field>
        )}
        {NEEDS_QTY.includes(type) && <Field label={type === 'SPLIT' ? 'Factor de split (ej. 2 para 2:1)' : 'Cantidad'}><input type="number" min={0} step="any" className="form-control" value={tx.quantity ?? 0} onChange={(e) => setTx({ ...tx, quantity: Number(e.target.value) })} /></Field>}
        {NEEDS_PRICE.includes(type) && <Field label="Precio unitario"><input type="number" min={0} step="any" className="form-control" value={tx.price ?? 0} onChange={(e) => setTx({ ...tx, price: Number(e.target.value) })} /></Field>}
        {!NEEDS_PRICE.includes(type) && type !== 'SPLIT' && <Field label="Monto"><input type="number" min={0} step="any" className="form-control" value={tx.amount ?? 0} onChange={(e) => setTx({ ...tx, amount: Number(e.target.value) })} /></Field>}
        <Field label="Comisión"><input type="number" min={0} step="any" className="form-control" value={tx.commission ?? 0} onChange={(e) => setTx({ ...tx, commission: Number(e.target.value) })} /></Field>
        <Field label="Moneda"><select className="form-select" value={tx.currency} onChange={(e) => setTx({ ...tx, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        {NEEDS_PRICE.includes(type) && <Field label="Total"><input className="form-control" readOnly value={computedAmount.toFixed(2)} /></Field>}
        <Field label="Notas" col="col-12"><input className="form-control" value={tx.notes ?? ''} onChange={(e) => setTx({ ...tx, notes: e.target.value })} /></Field>
      </div>
      <div className="form-text">Las posiciones se reconstruyen automáticamente a partir del ledger de transacciones.</div>
    </Modal>
  )
}
