// Edge Function: ai-analysis (OPCIONAL)
// Sólo se ejecuta si app_settings.ai_enabled = true para el usuario.
// Recibe datos ESTRUCTURADOS ya calculados por el motor cuantitativo y devuelve
// una explicación en lenguaje natural. Nunca calcula scores ni recomendaciones.
//
// { kind: 'asset' | 'portfolio' | 'recommendation' | 'scenarios' | 'news', payload: {...} }
import { corsHeaders, json, errorResponse, getClients } from '../_shared/http.ts'

const PROMPTS: Record<string, string> = {
  asset: 'Explica en español, de forma clara y breve, por qué este activo obtuvo el score indicado. Usa únicamente los factores y métricas provistos. No inventes datos ni des garantías de rendimiento.',
  portfolio: 'Explica en español qué factores están afectando la diversificación y el riesgo de este portafolio, con base exclusivamente en las métricas provistas. No inventes datos.',
  recommendation: 'Explica en español por qué el motor cuantitativo propuso estos instrumentos y esta distribución, usando sólo las razones y métricas provistas. Aclara que es una salida de un modelo y no una garantía.',
  scenarios: 'Con base en la composición del portafolio provista (sectores, países, monedas, volatilidad), describe en español escenarios de mercado que podrían afectarlo y qué exposiciones serían las más sensibles. Sé concreto y no inventes datos de mercado.',
  news: 'Resume en español los titulares provistos y su posible relevancia para los activos listados. No inventes noticias ni datos.',
}

// Campos que jamás deben viajar a la IA
const FORBIDDEN = ['password', 'token', 'api_key', 'apikey', 'secret', 'credential', 'account_number', 'clabe', 'iban']

function sanitize(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sanitize)
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (FORBIDDEN.some((f) => k.toLowerCase().includes(f))) continue
      out[k] = sanitize(v)
    }
    return out
  }
  return obj
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user, userId } = await getClients(req)

    // Guardia: la IA debe estar activada por el usuario
    const { data: settings } = await user.from('app_settings').select('ai_enabled').eq('user_id', userId).maybeSingle()
    if (!settings?.ai_enabled) return json({ error: 'El análisis mediante IA está desactivado en la configuración', code: 'AI_DISABLED' }, 403)

    const apiKey = Deno.env.get('AI_API_KEY')
    if (!apiKey) return json({ error: 'AI_API_KEY no configurada en el backend', code: 'NOT_CONFIGURED' }, 503)

    const body = await req.json()
    const system = PROMPTS[body.kind]
    if (!system) return json({ error: 'kind inválido' }, 400)
    const payload = sanitize(body.payload ?? {})

    const model = Deno.env.get('AI_MODEL') ?? 'claude-sonnet-5'
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 45000)
    let res: Response
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: `${system}\n\nResponde en Markdown sencillo. Los cálculos ya fueron hechos por el motor cuantitativo de la plataforma; tu tarea es explicarlos.`,
          messages: [{ role: 'user', content: `Datos estructurados:\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`` }],
        }),
      })
    } finally {
      clearTimeout(t)
    }

    if (!res.ok) {
      const txt = await res.text()
      console.error('[ai-analysis] proveedor IA', res.status, txt)
      return json({ error: 'Error del proveedor de IA', code: res.status === 429 ? 'RATE_LIMIT' : 'API_ERROR' }, 502)
    }
    const data = await res.json()
    const text = (data.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
    return json({ text, model })
  } catch (e) {
    return errorResponse(e, 'ai-analysis')
  }
})
