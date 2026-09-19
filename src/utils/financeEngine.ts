// Motor financiero: cálculos determinísticos de flujo, patrimonio y reserva.
import { FREQUENCIES } from '@/constants'
import type { AppSettings, Debt, Expense, FinancialGoal, IncomeSource } from '@/types'

const factor = (freq: string) => FREQUENCIES.find((f) => f.value === freq)?.monthlyFactor ?? 1

export const monthlyAmount = (amount: number, frequency: string) => amount * factor(frequency)

export interface CashFlowSummary {
  monthlyIncome: number
  monthlyExpenses: number
  monthlyDebtPayments: number
  freeCashFlow: number
  savingsRate: number | null
  missing: string[]
}

export function computeCashFlow(income: IncomeSource[], expenses: Expense[], debts: Debt[]): CashFlowSummary {
  const monthlyIncome = income.reduce((s, i) => s + monthlyAmount(Number(i.amount), i.frequency), 0)
  const monthlyExpenses = expenses.reduce((s, e) => s + monthlyAmount(Number(e.amount), e.frequency), 0)
  const monthlyDebtPayments = debts.reduce((s, d) => s + Number(d.monthly_payment || 0), 0)
  const freeCashFlow = monthlyIncome - monthlyExpenses - monthlyDebtPayments
  const missing: string[] = []
  if (income.length === 0) missing.push('No hay ingresos registrados')
  if (expenses.length === 0) missing.push('No hay gastos registrados')
  return {
    monthlyIncome, monthlyExpenses, monthlyDebtPayments, freeCashFlow,
    savingsRate: monthlyIncome > 0 ? freeCashFlow / monthlyIncome : null,
    missing,
  }
}

export interface NetWorthSummary {
  liquidAssets: number
  investedAssets: number
  goalAssets: number
  totalAssets: number
  totalLiabilities: number
  netWorth: number
}

export function computeNetWorth(settings: AppSettings | null, portfolioValue: number, debts: Debt[], goals: FinancialGoal[]): NetWorthSummary {
  const liquidAssets = Number(settings?.liquid_capital ?? 0) + Number(settings?.emergency_fund_current ?? 0)
  const goalAssets = goals.reduce((s, g) => s + Number(g.current_amount || 0), 0)
  const totalAssets = liquidAssets + portfolioValue + goalAssets
  const totalLiabilities = debts.reduce((s, d) => s + Number(d.remaining_amount || 0), 0)
  return { liquidAssets, investedAssets: portfolioValue, goalAssets, totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities }
}

export interface EmergencyFundSummary {
  monthsTarget: number
  target: number
  current: number
  coveredPct: number | null
  missing: number
  dataMissing: boolean
}

export function computeEmergencyFund(settings: AppSettings | null, monthlyExpenses: number, monthlyDebtPayments: number): EmergencyFundSummary {
  const months = Number(settings?.emergency_fund_months ?? 6)
  const base = monthlyExpenses + monthlyDebtPayments
  const target = base * months
  const current = Number(settings?.emergency_fund_current ?? 0)
  return {
    monthsTarget: months,
    target,
    current,
    coveredPct: target > 0 ? Math.min(current / target, 1) : null,
    missing: Math.max(target - current, 0),
    dataMissing: base === 0,
  }
}

export interface InvestableCapital {
  liquid: number
  reserveShortfall: number
  investable: number
  notes: string[]
}

/** Capital líquido - faltante de reserva = capital potencialmente invertible */
export function computeInvestableCapital(settings: AppSettings | null, ef: EmergencyFundSummary): InvestableCapital {
  const liquid = Number(settings?.liquid_capital ?? 0)
  const notes: string[] = []
  if (ef.dataMissing) notes.push('No hay gastos registrados: no es posible calcular la reserva de emergencia.')
  if (ef.missing > 0) notes.push(`La reserva de emergencia tiene un faltante de ${ef.missing.toFixed(2)}; se descuenta del capital líquido.`)
  const investable = Math.max(liquid - ef.missing, 0)
  return { liquid, reserveShortfall: ef.missing, investable, notes }
}
