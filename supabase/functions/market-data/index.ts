// Edge Function: market-data
// Acciones:
//   { action: 'sync', asset_id, full?: boolean }   -> descarga precios históricos y los guarda en asset_prices
//   { action: 'search', query }                     -> busca símbolos en el proveedor
import { corsHeaders, json, errorResponse, getClients, getUserProvider } from '../_shared/http.ts'
import { getProvider } from '../_shared/providers.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user, admin, userId } = await getClients(req)
    const body = await req.json()
    const providerName = body.provider ?? (await getUserProvider(user, userId))
    const provider = getProvider(providerName)

    if (body.action === 'search') {
      if (!body.query || typeof body.query !== 'string') return json({ error: 'query requerido' }, 400)
      if (!provider.searchSymbol) return json({ error: 'El proveedor no soporta búsqueda' }, 400)
      const results = await provider.searchSymbol(body.query.trim())
      return json({ results })
    }

    if (body.action === 'sync') {
      if (!body.asset_id) return json({ error: 'asset_id requerido' }, 400)
      const { data: asset, error } = await user.from('assets').select('id, symbol').eq('id', body.asset_id).single()
      if (error || !asset) return json({ error: 'Activo no encontrado' }, 404)

      // Si ya hay datos, descargar sólo lo compacto salvo que se pida full
      const { data: last } = await admin.from('asset_prices').select('date').eq('asset_id', asset.id).eq('provider', provider.name)
        .order('date', { ascending: false }).limit(1).maybeSingle()
      const outputSize: 'compact' | 'full' = body.full || !last ? 'full' : 'compact'

      const bars = await provider.getDailyPrices(asset.symbol, outputSize)
      const rows = bars.map((b) => ({ ...b, asset_id: asset.id, provider: provider.name }))

      // Upsert en lotes para evitar duplicados (asset_id + date + provider)
      let inserted = 0
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500)
        const { error: upErr } = await admin.from('asset_prices').upsert(chunk, { onConflict: 'asset_id,date,provider' })
        if (upErr) throw upErr
        inserted += chunk.length
      }
      console.log(`[market-data] ${asset.symbol}: ${inserted} barras (${provider.name}, ${outputSize})`)
      return json({ symbol: asset.symbol, provider: provider.name, bars: inserted, from: rows.at(-1)?.date, to: rows[0]?.date })
    }

    return json({ error: 'action inválida' }, 400)
  } catch (e) {
    return errorResponse(e, 'market-data')
  }
})
