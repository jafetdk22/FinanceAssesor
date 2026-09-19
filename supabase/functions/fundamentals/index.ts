// Edge Function: fundamentals
// { asset_id } -> obtiene fundamentales del proveedor y los guarda en asset_fundamentals
import { corsHeaders, json, errorResponse, getClients, getUserProvider } from '../_shared/http.ts'
import { getProvider } from '../_shared/providers.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user, admin, userId } = await getClients(req)
    const body = await req.json()
    if (!body.asset_id) return json({ error: 'asset_id requerido' }, 400)

    const provider = getProvider(body.provider ?? (await getUserProvider(user, userId)))
    if (!provider.getFundamentals) return json({ error: 'El proveedor no soporta fundamentales' }, 400)

    const { data: asset } = await user.from('assets').select('id, symbol, asset_type').eq('id', body.asset_id).single()
    if (!asset) return json({ error: 'Activo no encontrado' }, 404)

    const f = await provider.getFundamentals(asset.symbol)
    if (!f) return json({ error: 'Sin datos fundamentales disponibles para este activo', code: 'NO_DATA' }, 404)

    const { raw, ...fields } = f
    const { error } = await admin.from('asset_fundamentals')
      .upsert({ ...fields, raw, asset_id: asset.id, provider: provider.name }, { onConflict: 'asset_id,as_of,provider' })
    if (error) throw error
    console.log(`[fundamentals] ${asset.symbol} actualizado (${provider.name})`)
    return json({ symbol: asset.symbol, provider: provider.name, fundamentals: fields })
  } catch (e) {
    return errorResponse(e, 'fundamentals')
  }
})
