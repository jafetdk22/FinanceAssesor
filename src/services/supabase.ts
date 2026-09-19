import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  // Sólo variables públicas de Vite; los secretos de proveedores viven en las Edge Functions.
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env')
}

export const supabase = createClient(url ?? '', anon ?? '', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const isSupabaseConfigured = Boolean(url && anon)

/** Invoca una Edge Function y normaliza errores (rate limit, símbolo inválido, timeout...). */
export async function invokeFunction<T = unknown>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = error.message
    let code = 'API_ERROR'
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json()
        message = j.error ?? message
        code = j.code ?? code
      }
    } catch { /* ignore */ }
    const err = new Error(message) as Error & { code: string }
    err.code = code
    throw err
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    const err = new Error(String((data as { error: string }).error)) as Error & { code: string }
    err.code = String((data as { code?: string }).code ?? 'API_ERROR')
    throw err
  }
  return data as T
}
