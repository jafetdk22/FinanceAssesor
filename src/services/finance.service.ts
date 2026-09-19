import { supabase } from './supabase'
import type { AppSettings, Debt, Expense, FinancialGoal, IncomeSource, Profile } from '@/types'

type Table = 'income_sources' | 'expenses' | 'debts' | 'financial_goals'

async function list<T>(table: Table): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as T[]
}
async function upsert<T extends { id?: string }>(table: Table, row: Partial<T>): Promise<T> {
  const { data: u } = await supabase.auth.getUser()
  const payload = { ...row, user_id: u.user?.id }
  const q = row.id ? supabase.from(table).update(payload).eq('id', row.id) : supabase.from(table).insert(payload)
  const { data, error } = await q.select().single()
  if (error) throw error
  return data as T
}
async function remove(table: Table, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

export const financeService = {
  listIncome: () => list<IncomeSource>('income_sources'),
  saveIncome: (r: Partial<IncomeSource>) => upsert<IncomeSource>('income_sources', r),
  deleteIncome: (id: string) => remove('income_sources', id),
  listExpenses: () => list<Expense>('expenses'),
  saveExpense: (r: Partial<Expense>) => upsert<Expense>('expenses', r),
  deleteExpense: (id: string) => remove('expenses', id),
  listDebts: () => list<Debt>('debts'),
  saveDebt: (r: Partial<Debt>) => upsert<Debt>('debts', r),
  deleteDebt: (id: string) => remove('debts', id),
  listGoals: () => list<FinancialGoal>('financial_goals'),
  saveGoal: (r: Partial<FinancialGoal>) => upsert<FinancialGoal>('financial_goals', r),
  deleteGoal: (id: string) => remove('financial_goals', id),

  async getProfile(): Promise<Profile | null> {
    const { data, error } = await supabase.from('profiles').select('*').maybeSingle()
    if (error) throw error
    return data
  },
  async saveProfile(p: Partial<Profile>): Promise<Profile> {
    const { data: u } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('profiles').upsert({ ...p, id: u.user!.id }).select().single()
    if (error) throw error
    return data
  },
  async getSettings(): Promise<AppSettings | null> {
    const { data, error } = await supabase.from('app_settings').select('*').maybeSingle()
    if (error) throw error
    return data
  },
  async saveSettings(s: Partial<AppSettings>): Promise<AppSettings> {
    const { data: u } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('app_settings').upsert({ ...s, user_id: u.user!.id }).select().single()
    if (error) throw error
    return data
  },
  async loadAll() {
    const [income, expenses, debts, goals, profile, settings] = await Promise.all([
      financeService.listIncome(), financeService.listExpenses(), financeService.listDebts(), financeService.listGoals(),
      financeService.getProfile(), financeService.getSettings(),
    ])
    return { income, expenses, debts, goals, profile, settings }
  },
}
