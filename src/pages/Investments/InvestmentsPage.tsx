import { useState } from 'react'
import { Card, ConfirmButton, EmptyState, ErrorAlert, Loading } from '@/components/ui'
import TransactionForm from '@/components/TransactionForm'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { portfolioService } from '@/services/portfolio.service'
import type { InvestmentTransaction } from '@/types'
import { fmtDate, fmtMoney, fmtNum } from '@/utils/format'

const TYPE_TONE: Record<string, string> = { BUY: 'success', SELL: 'danger', DIVIDEND: 'info', INTEREST: 'info', FEE: 'warning', DEPOSIT: 'primary', WITHDRAWAL: 'secondary', SPLIT: 'dark', TRANSFER: 'light' }

export default function InvestmentsPage() {
  const toast = useToast()
  const [filter, setFilter] = useState('')
  const [modal, setModal] = useState<{ show: boolean; initial?: Partial<InvestmentTransaction> }>({ show: false })
  const { data, loading, error, reload } = useAsync(async () => {
    const [transactions, portfolios, brokers, assets] = await Promise.all([
      portfolioService.listTransactions(filter || undefined), portfolioService.listPortfolios(), portfolioService.listBrokers(), portfolioService.listAssets(),
    ])
    return { transactions, portfolios, brokers, assets }
  }, [filter])

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 className="page-title">Inversiones · Ledger de transacciones</h1>
        <div className="d-flex gap-2">
          <select className="form-select form-select-sm" style={{ maxWidth: 200 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Todos los portafolios</option>{data?.portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" disabled={!data?.portfolios.length} onClick={() => setModal({ show: true })}><i className="bi bi-plus-lg me-1" />Registrar</button>
        </div>
      </div>
      {data && data.portfolios.length === 0 && <div className="alert alert-info small">Primero crea un portafolio para registrar operaciones.</div>}
      {loading && <Loading />}
      <ErrorAlert message={error} onRetry={reload} />
      {data && (
        <Card>
          {data.transactions.length === 0 ? <EmptyState icon="arrow-left-right" title="Sin transacciones" text="Registra compras, ventas, dividendos, depósitos y más. Las posiciones se reconstruyen a partir de este historial." /> : (
            <div className="table-responsive"><table className="table table-hover align-middle">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Activo</th><th>Portafolio</th><th>Broker</th><th className="text-end">Cantidad</th><th className="text-end">Precio</th><th className="text-end">Monto</th><th className="text-end">Comisión</th><th /></tr></thead>
              <tbody>{data.transactions.map((t) => (
                <tr key={t.id}>
                  <td>{fmtDate(t.transaction_date)}</td>
                  <td><span className={`badge text-bg-${TYPE_TONE[t.transaction_type] ?? 'light'}`}>{t.transaction_type}</span></td>
                  <td className="fw-semibold">{t.asset?.symbol ?? '—'}</td>
                  <td className="small">{data.portfolios.find((p) => p.id === t.portfolio_id)?.name}</td>
                  <td className="small">{t.broker?.name ?? '—'}</td>
                  <td className="text-end">{t.quantity ? fmtNum(Number(t.quantity), 4) : '—'}</td>
                  <td className="text-end">{t.price ? fmtMoney(Number(t.price), t.currency) : '—'}</td>
                  <td className="text-end fw-semibold">{fmtMoney(Number(t.amount), t.currency)}</td>
                  <td className="text-end">{fmtMoney(Number(t.commission), t.currency)}</td>
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setModal({ show: true, initial: t })}><i className="bi bi-pencil" /></button>
                    <ConfirmButton onConfirm={async () => { try { await portfolioService.deleteTransaction(t.id); reload() } catch (e) { toast.push('danger', (e as Error).message) } }} />
                  </td>
                </tr>
              ))}</tbody></table></div>
          )}
        </Card>
      )}
      {data && <TransactionForm show={modal.show} initial={modal.initial} onClose={() => setModal({ show: false })} onSaved={reload} portfolios={data.portfolios} brokers={data.brokers} assets={data.assets} />}
    </>
  )
}
