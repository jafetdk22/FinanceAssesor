import { useMemo, useState } from 'react'
import { Card, ConfirmButton, EmptyState, ErrorAlert, Field, Loading, Modal, StatCard } from '@/components/ui'
import { DonutChart } from '@/components/charts'
import { EXPENSE_CATEGORIES, FREQUENCIES, INCOME_CATEGORIES, PRIORITIES } from '@/constants'
import { useSettings } from '@/context/SettingsContext'
import { useAsync } from '@/hooks/useAsync'
import { useToast } from '@/hooks/useToast'
import { financeService } from '@/services/finance.service'
import { portfolioService } from '@/services/portfolio.service'
import { marketService } from '@/services/market.service'
import type { Debt, Expense, FinancialGoal, IncomeSource } from '@/types'
import { computeCashFlow, computeEmergencyFund, computeInvestableCapital, computeNetWorth, monthlyAmount } from '@/utils/financeEngine'
import { fmtDate, fmtMoney, fmtPct, today } from '@/utils/format'
import { valuePositions } from '@/utils/portfolioAnalyzer'

type Tab = 'summary' | 'income' | 'expenses' | 'debts' | 'goals' | 'reserve'

export default function FinancePage() {
  const { settings, profile, saveSettings } = useSettings()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('summary')
  const cur = profile?.base_currency ?? 'MXN'

  const { data, loading, error, reload } = useAsync(async () => {
    const [f, positions] = await Promise.all([financeService.loadAll(), portfolioService.listPositions()])
    const lastPrices = await marketService.getLastPrices([...new Set(positions.map((p) => p.asset_id))])
    const valued = valuePositions(positions, lastPrices)
    return { ...f, portfolioValue: valued.reduce((s, v) => s + (v.marketValue ?? v.invested), 0) }
  }, [])

  const calc = useMemo(() => {
    if (!data) return null
    const cf = computeCashFlow(data.income, data.expenses, data.debts)
    const ef = computeEmergencyFund(settings, cf.monthlyExpenses, cf.monthlyDebtPayments)
    const nw = computeNetWorth(settings, data.portfolioValue, data.debts, data.goals)
    const inv = computeInvestableCapital(settings, ef)
    return { cf, ef, nw, inv }
  }, [data, settings])

  const [modal, setModal] = useState<{ kind: Tab; row: Record<string, unknown> } | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!modal) return
    setBusy(true)
    try {
      const r = modal.row
      if (modal.kind === 'income') await financeService.saveIncome(r as Partial<IncomeSource>)
      if (modal.kind === 'expenses') await financeService.saveExpense(r as Partial<Expense>)
      if (modal.kind === 'debts') await financeService.saveDebt(r as Partial<Debt>)
      if (modal.kind === 'goals') await financeService.saveGoal(r as Partial<FinancialGoal>)
      toast.push('success', 'Guardado'); setModal(null); reload()
    } catch (e) { toast.push('danger', (e as Error).message) } finally { setBusy(false) }
  }
  const del = async (kind: Tab, id: string) => {
    try {
      if (kind === 'income') await financeService.deleteIncome(id)
      if (kind === 'expenses') await financeService.deleteExpense(id)
      if (kind === 'debts') await financeService.deleteDebt(id)
      if (kind === 'goals') await financeService.deleteGoal(id)
      reload()
    } catch (e) { toast.push('danger', (e as Error).message) }
  }
  const setRow = (k: string, v: unknown) => setModal((m) => (m ? { ...m, row: { ...m.row, [k]: v } } : m))

  if (loading) return <Loading />
  if (error) return <ErrorAlert message={error} onRetry={reload} />
  if (!data || !calc) return null

  const tabs: Array<[Tab, string]> = [['summary', 'Resumen'], ['income', 'Ingresos'], ['expenses', 'Gastos'], ['debts', 'Deudas'], ['goals', 'Metas'], ['reserve', 'Reserva y liquidez']]
  const newBtn = (kind: Tab, row: Record<string, unknown>) => <button className="btn btn-sm btn-primary" onClick={() => setModal({ kind, row })}><i className="bi bi-plus-lg me-1" />Nuevo</button>

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 className="page-title">Finanzas personales</h1>
      </div>
      <ul className="nav nav-pills mb-3 flex-wrap">
        {tabs.map(([k, l]) => <li key={k} className="nav-item"><button className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button></li>)}
      </ul>

      {tab === 'summary' && (
        <>
          {calc.cf.missing.length > 0 && <div className="alert alert-warning small"><i className="bi bi-exclamation-circle me-2" />{calc.cf.missing.join(' · ')}. Los cálculos pueden estar incompletos.</div>}
          <div className="row g-3 mb-3">
            <div className="col-6 col-lg-3"><StatCard label="Ingreso mensual" value={fmtMoney(calc.cf.monthlyIncome, cur)} icon="cash-stack" tone="success" /></div>
            <div className="col-6 col-lg-3"><StatCard label="Gastos mensuales" value={fmtMoney(calc.cf.monthlyExpenses, cur)} icon="cart" tone="warning" /></div>
            <div className="col-6 col-lg-3"><StatCard label="Pagos de deuda" value={fmtMoney(calc.cf.monthlyDebtPayments, cur)} icon="credit-card" tone="danger" /></div>
            <div className="col-6 col-lg-3"><StatCard label="Flujo libre mensual" value={<span className={calc.cf.freeCashFlow >= 0 ? 'text-success' : 'text-danger'}>{fmtMoney(calc.cf.freeCashFlow, cur)}</span>} hint={calc.cf.savingsRate !== null ? `Tasa de ahorro ${fmtPct(calc.cf.savingsRate, 1)}` : 'Sin ingresos'} icon="piggy-bank" tone="primary" /></div>
          </div>
          <div className="row g-3">
            <div className="col-lg-6">
              <Card title="Patrimonio neto">
                <div className="table-responsive"><table className="table table-sm mb-0">
                  <tbody>
                    <tr><td>Capital líquido + reserva</td><td className="text-end">{fmtMoney(calc.nw.liquidAssets, cur)}</td></tr>
                    <tr><td>Inversiones (valor actual)</td><td className="text-end">{fmtMoney(calc.nw.investedAssets, cur)}</td></tr>
                    <tr><td>Ahorro en metas</td><td className="text-end">{fmtMoney(calc.nw.goalAssets, cur)}</td></tr>
                    <tr className="table-light fw-semibold"><td>Activos</td><td className="text-end">{fmtMoney(calc.nw.totalAssets, cur)}</td></tr>
                    <tr><td>Pasivos (deudas)</td><td className="text-end text-danger">-{fmtMoney(calc.nw.totalLiabilities, cur)}</td></tr>
                    <tr className="table-primary fw-bold"><td>Patrimonio neto</td><td className="text-end">{fmtMoney(calc.nw.netWorth, cur)}</td></tr>
                  </tbody>
                </table></div>
                <div className="form-text mt-2">El valor de inversiones usa el último precio disponible; posiciones sin precio se valúan al costo. Las inversiones se muestran en su moneda nominal sin conversión.</div>
              </Card>
            </div>
            <div className="col-lg-6">
              <Card title="Gastos por categoría">
                <DonutChart currency={cur} data={EXPENSE_CATEGORIES.map((c) => ({ key: c.label, value: data.expenses.filter((e) => e.category === c.value).reduce((s, e) => s + monthlyAmount(Number(e.amount), e.frequency), 0) })).filter((x) => x.value > 0).map((x, _, arr) => ({ ...x, weight: x.value / arr.reduce((s, y) => s + y.value, 0) }))} />
              </Card>
            </div>
          </div>
        </>
      )}

      {tab === 'income' && (
        <Card title="Ingresos" actions={newBtn('income', { name: '', category: 'SALARY', amount: 0, frequency: 'MONTHLY', date: today() })}>
          {data.income.length === 0 ? <EmptyState icon="cash-stack" title="Sin ingresos registrados" text="Registra tu salario, negocio u otras fuentes." /> : (
            <div className="table-responsive"><table className="table table-hover align-middle">
              <thead><tr><th>Nombre</th><th>Categoría</th><th>Frecuencia</th><th className="text-end">Monto</th><th className="text-end">Mensual</th><th /></tr></thead>
              <tbody>{data.income.map((r) => (
                <tr key={r.id}><td>{r.name}</td><td>{INCOME_CATEGORIES.find((c) => c.value === r.category)?.label}</td><td>{FREQUENCIES.find((f) => f.value === r.frequency)?.label}</td>
                  <td className="text-end">{fmtMoney(Number(r.amount), cur)}</td><td className="text-end fw-semibold">{fmtMoney(monthlyAmount(Number(r.amount), r.frequency), cur)}</td>
                  <td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setModal({ kind: 'income', row: { ...r } })}><i className="bi bi-pencil" /></button><ConfirmButton onConfirm={() => del('income', r.id)} /></td></tr>
              ))}</tbody></table></div>
          )}
        </Card>
      )}

      {tab === 'expenses' && (
        <Card title="Gastos" actions={newBtn('expenses', { name: '', category: 'HOUSING', amount: 0, frequency: 'MONTHLY', date: today() })}>
          {data.expenses.length === 0 ? <EmptyState icon="cart" title="Sin gastos registrados" /> : (
            <div className="table-responsive"><table className="table table-hover align-middle">
              <thead><tr><th>Nombre</th><th>Categoría</th><th>Frecuencia</th><th className="text-end">Monto</th><th className="text-end">Mensual</th><th /></tr></thead>
              <tbody>{data.expenses.map((r) => (
                <tr key={r.id}><td>{r.name}</td><td>{EXPENSE_CATEGORIES.find((c) => c.value === r.category)?.label}</td><td>{FREQUENCIES.find((f) => f.value === r.frequency)?.label}</td>
                  <td className="text-end">{fmtMoney(Number(r.amount), cur)}</td><td className="text-end fw-semibold">{fmtMoney(monthlyAmount(Number(r.amount), r.frequency), cur)}</td>
                  <td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setModal({ kind: 'expenses', row: { ...r } })}><i className="bi bi-pencil" /></button><ConfirmButton onConfirm={() => del('expenses', r.id)} /></td></tr>
              ))}</tbody></table></div>
          )}
        </Card>
      )}

      {tab === 'debts' && (
        <Card title="Deudas" actions={newBtn('debts', { name: '', institution: '', principal_amount: 0, remaining_amount: 0, interest_rate: 0, monthly_payment: 0 })}>
          {data.debts.length === 0 ? <EmptyState icon="credit-card" title="Sin deudas registradas" /> : (
            <div className="table-responsive"><table className="table table-hover align-middle">
              <thead><tr><th>Nombre</th><th>Institución</th><th className="text-end">Principal</th><th className="text-end">Restante</th><th className="text-end">Tasa</th><th className="text-end">Pago mensual</th><th>Vence</th><th /></tr></thead>
              <tbody>{data.debts.map((r) => (
                <tr key={r.id}><td>{r.name}</td><td>{r.institution}</td><td className="text-end">{fmtMoney(Number(r.principal_amount), cur)}</td><td className="text-end fw-semibold">{fmtMoney(Number(r.remaining_amount), cur)}</td>
                  <td className="text-end">{Number(r.interest_rate).toFixed(2)}%</td><td className="text-end">{fmtMoney(Number(r.monthly_payment), cur)}</td><td>{fmtDate(r.due_date)}</td>
                  <td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setModal({ kind: 'debts', row: { ...r } })}><i className="bi bi-pencil" /></button><ConfirmButton onConfirm={() => del('debts', r.id)} /></td></tr>
              ))}</tbody></table></div>
          )}
        </Card>
      )}

      {tab === 'goals' && (
        <Card title="Metas financieras" actions={newBtn('goals', { name: '', target_amount: 0, current_amount: 0, priority: 'MEDIUM' })}>
          {data.goals.length === 0 ? <EmptyState icon="bullseye" title="Sin metas" /> : (
            <div className="row g-3">{data.goals.map((g) => {
              const pct = Number(g.target_amount) > 0 ? Math.min(Number(g.current_amount) / Number(g.target_amount), 1) : 0
              return (
                <div className="col-md-6 col-xl-4" key={g.id}><div className="card border h-100"><div className="card-body">
                  <div className="d-flex justify-content-between"><h6 className="fw-semibold">{g.name}</h6><span className={`badge text-bg-${g.priority === 'HIGH' ? 'danger' : g.priority === 'MEDIUM' ? 'warning' : 'secondary'}`}>{PRIORITIES.find((p) => p.value === g.priority)?.label}</span></div>
                  <div className="small text-muted">{fmtMoney(Number(g.current_amount), cur)} de {fmtMoney(Number(g.target_amount), cur)} · {fmtDate(g.target_date)}</div>
                  <div className="progress my-2" style={{ height: 8 }}><div className="progress-bar" style={{ width: `${pct * 100}%` }} /></div>
                  <div className="d-flex justify-content-between"><span className="small">{(pct * 100).toFixed(0)}%</span>
                    <span><button className="btn btn-sm btn-outline-secondary me-1" onClick={() => setModal({ kind: 'goals', row: { ...g } })}><i className="bi bi-pencil" /></button><ConfirmButton onConfirm={() => del('goals', g.id)} /></span></div>
                </div></div></div>
              )
            })}</div>
          )}
        </Card>
      )}

      {tab === 'reserve' && (
        <div className="row g-3">
          <div className="col-lg-5">
            <Card title="Reserva de emergencia y liquidez">
              <ReserveForm initial={{ months: Number(settings?.emergency_fund_months ?? 6), current: Number(settings?.emergency_fund_current ?? 0), liquid: Number(settings?.liquid_capital ?? 0) }}
                onSave={async (v) => { try { await saveSettings({ emergency_fund_months: v.months, emergency_fund_current: v.current, liquid_capital: v.liquid }); toast.push('success', 'Guardado') } catch (e) { toast.push('danger', (e as Error).message) } }} cur={cur} />
            </Card>
          </div>
          <div className="col-lg-7">
            <Card title="Cálculo de la reserva">
              {calc.ef.dataMissing ? <div className="alert alert-warning small">Registra tus gastos mensuales para calcular la reserva objetivo.</div> : (
                <>
                  <p className="small text-muted mb-2">({fmtMoney(calc.cf.monthlyExpenses, cur)} gastos + {fmtMoney(calc.cf.monthlyDebtPayments, cur)} deudas) × {calc.ef.monthsTarget} meses</p>
                  <div className="row g-3 mb-3">
                    <div className="col-6 col-md-3"><StatCard label="Reserva objetivo" value={fmtMoney(calc.ef.target, cur)} /></div>
                    <div className="col-6 col-md-3"><StatCard label="Reserva actual" value={fmtMoney(calc.ef.current, cur)} /></div>
                    <div className="col-6 col-md-3"><StatCard label="Cubierto" value={fmtPct(calc.ef.coveredPct, 0)} /></div>
                    <div className="col-6 col-md-3"><StatCard label="Faltante" value={fmtMoney(calc.ef.missing, cur)} /></div>
                  </div>
                  <div className="progress mb-3" style={{ height: 10 }}><div className={`progress-bar ${(calc.ef.coveredPct ?? 0) >= 1 ? 'bg-success' : 'bg-warning'}`} style={{ width: `${(calc.ef.coveredPct ?? 0) * 100}%` }} /></div>
                </>
              )}
              <h6 className="fw-semibold mt-3">Capital potencialmente invertible</h6>
              <div className="table-responsive"><table className="table table-sm mb-2"><tbody>
                <tr><td>Capital líquido</td><td className="text-end">{fmtMoney(calc.inv.liquid, cur)}</td></tr>
                <tr><td>− Faltante de reserva</td><td className="text-end text-danger">-{fmtMoney(calc.inv.reserveShortfall, cur)}</td></tr>
                <tr className="table-success fw-bold"><td>= Invertible</td><td className="text-end">{fmtMoney(calc.inv.investable, cur)}</td></tr>
              </tbody></table></div>
              {calc.inv.notes.map((n, i) => <div key={i} className="form-text">{n}</div>)}
            </Card>
          </div>
        </div>
      )}

      <Modal show={!!modal} title={modal?.row.id ? 'Editar' : 'Nuevo registro'} onClose={() => setModal(null)}
        footer={<><button className="btn btn-light" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy} onClick={save}>Guardar</button></>}>
        {modal && (
          <div className="row">
            <Field label="Nombre" col="col-12"><input className="form-control" value={String(modal.row.name ?? '')} onChange={(e) => setRow('name', e.target.value)} /></Field>
            {(modal.kind === 'income' || modal.kind === 'expenses') && (
              <>
                <Field label="Categoría"><select className="form-select" value={String(modal.row.category)} onChange={(e) => setRow('category', e.target.value)}>{(modal.kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
                <Field label="Frecuencia"><select className="form-select" value={String(modal.row.frequency)} onChange={(e) => setRow('frequency', e.target.value)}>{FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></Field>
                <Field label={`Monto (${cur})`}><input type="number" min={0} step="0.01" className="form-control" value={Number(modal.row.amount)} onChange={(e) => setRow('amount', Number(e.target.value))} /></Field>
                <Field label="Fecha"><input type="date" className="form-control" value={String(modal.row.date ?? '')} onChange={(e) => setRow('date', e.target.value)} /></Field>
                <Field label="Notas" col="col-12"><input className="form-control" value={String(modal.row.notes ?? '')} onChange={(e) => setRow('notes', e.target.value)} /></Field>
              </>
            )}
            {modal.kind === 'debts' && (
              <>
                <Field label="Institución"><input className="form-control" value={String(modal.row.institution ?? '')} onChange={(e) => setRow('institution', e.target.value)} /></Field>
                <Field label="Tasa de interés anual (%)"><input type="number" step="0.01" className="form-control" value={Number(modal.row.interest_rate)} onChange={(e) => setRow('interest_rate', Number(e.target.value))} /></Field>
                <Field label="Monto principal"><input type="number" min={0} step="0.01" className="form-control" value={Number(modal.row.principal_amount)} onChange={(e) => setRow('principal_amount', Number(e.target.value))} /></Field>
                <Field label="Monto restante"><input type="number" min={0} step="0.01" className="form-control" value={Number(modal.row.remaining_amount)} onChange={(e) => setRow('remaining_amount', Number(e.target.value))} /></Field>
                <Field label="Pago mensual"><input type="number" min={0} step="0.01" className="form-control" value={Number(modal.row.monthly_payment)} onChange={(e) => setRow('monthly_payment', Number(e.target.value))} /></Field>
                <Field label="Fecha de vencimiento"><input type="date" className="form-control" value={String(modal.row.due_date ?? '')} onChange={(e) => setRow('due_date', e.target.value || null)} /></Field>
              </>
            )}
            {modal.kind === 'goals' && (
              <>
                <Field label="Monto objetivo"><input type="number" min={0} step="0.01" className="form-control" value={Number(modal.row.target_amount)} onChange={(e) => setRow('target_amount', Number(e.target.value))} /></Field>
                <Field label="Monto actual"><input type="number" min={0} step="0.01" className="form-control" value={Number(modal.row.current_amount)} onChange={(e) => setRow('current_amount', Number(e.target.value))} /></Field>
                <Field label="Fecha objetivo"><input type="date" className="form-control" value={String(modal.row.target_date ?? '')} onChange={(e) => setRow('target_date', e.target.value || null)} /></Field>
                <Field label="Prioridad"><select className="form-select" value={String(modal.row.priority)} onChange={(e) => setRow('priority', e.target.value)}>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></Field>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

function ReserveForm({ initial, onSave, cur }: { initial: { months: number; current: number; liquid: number }; onSave: (v: { months: number; current: number; liquid: number }) => Promise<void>; cur: string }) {
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  return (
    <div className="row">
      <Field label="Meses de reserva deseados" col="col-12"><input type="number" min={0} max={36} className="form-control" value={v.months} onChange={(e) => setV({ ...v, months: Number(e.target.value) })} /></Field>
      <Field label={`Reserva actual (${cur})`} col="col-12" help="Dinero apartado específicamente como fondo de emergencia."><input type="number" min={0} step="0.01" className="form-control" value={v.current} onChange={(e) => setV({ ...v, current: Number(e.target.value) })} /></Field>
      <Field label={`Capital líquido disponible (${cur})`} col="col-12" help="Efectivo/cuentas que podrías destinar a inversión (sin contar la reserva)."><input type="number" min={0} step="0.01" className="form-control" value={v.liquid} onChange={(e) => setV({ ...v, liquid: Number(e.target.value) })} /></Field>
      <div className="col-12"><button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); await onSave(v); setBusy(false) }}>Guardar</button></div>
    </div>
  )
}
