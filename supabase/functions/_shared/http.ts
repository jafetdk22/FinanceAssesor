import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { ProviderError } from './providers.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

export function errorResponse(e: unknown, context: string) {
  console.error(`[${context}]`, e)
  if (e instanceof ProviderError) {
    const status = e.code === 'RATE_LIMIT' ? 429 : e.code === 'INVALID_SYMBOL' || e.code === 'NO_DATA' ? 404 : e.code === 'TIMEOUT' ? 504 : 502
    return json({ error: e.message, code: e.code }, status)
  }
  return json({ error: (e as Error).message ?? 'Error interno', code: 'INTERNAL' }, 500)
}

/** Cliente con el JWT del usuario (respeta RLS) + cliente service role para escribir datos de mercado. */
export async function getClients(req: Request): Promise<{ user: SupabaseClient; admin: SupabaseClient; userId: string }> {
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const auth = req.headers.get('Authorization') ?? ''
  const user = createClient(url, anon, { global: { headers: { Authorization: auth } } })
  const { data, error } = await user.auth.getUser()
  if (error || !data.user) throw new Error('No autenticado')
  const admin = createClient(url, service)
  return { user, admin, userId: data.user.id }
}

export async function getUserProvider(user: SupabaseClient, userId: string): Promise<string> {
  const { data } = await user.from('app_settings').select('market_data_provider').eq('user_id', userId).maybeSingle()
  return data?.market_data_provider ?? 'twelve_data'
}
