# Investment Intelligence Platform

Plataforma web para **finanzas personales, gestión de portafolios, análisis cuantitativo de acciones, recomendación de inversión y backtesting**. Funciona 100 % sin IA; la IA es un módulo opcional controlado por un switch global (OFF por defecto).

**Stack:** React 18 + Vite + TypeScript · Bootstrap 5 + Bootstrap Icons · Recharts · Supabase (PostgreSQL, Auth, Edge Functions, RLS).

## Arquitectura

```
React / Vite  ──►  Supabase (Auth · PostgreSQL con RLS)
                        │
                        ▼
                  Edge Functions (Deno)  ──►  Alpha Vantage / Twelve Data / API de IA
                  (las API keys sólo viven aquí)
```

| Capa | Ubicación |
|---|---|
| Motor financiero (flujo, patrimonio, reserva, capital invertible) | `src/utils/financeEngine.ts` |
| Indicadores técnicos (SMA/EMA/RSI/MACD/Bollinger/ATR/ADX/OBV, volatilidad, drawdown, Sharpe, beta, correlación) | `src/utils/indicators.ts` |
| Motor de scoring 0-100 explicable, pesos configurables | `src/utils/scoring.ts` |
| Analizador de portafolio (distribuciones, HHI, alertas, correlación, riesgo) | `src/utils/portfolioAnalyzer.ts` |
| Motor de recomendación (N instrumentos, pesos por score/volatilidad/correlación/límites) | `src/utils/recommendationEngine.ts` |
| Backtesting (Buy&Hold, Score, SMA 200) | `src/utils/backtesting.ts` |
| Proveedores de mercado (`MarketDataProvider`) | `supabase/functions/_shared/providers.ts` |
| Edge Functions | `supabase/functions/{market-data,fundamentals,ai-analysis}` |
| Esquema SQL + RLS | `supabase/migrations/` |

Todo el cálculo es determinista y reproducible (`model_version` guardado con cada resultado). La IA sólo recibe datos estructurados ya calculados y devuelve explicaciones.

## Puesta en marcha

### 1. Supabase

```bash
npm install
npx supabase login
npx supabase link --project-ref <tu-project-ref>
npx supabase db push            # aplica migraciones (esquema + RLS)
psql "<connection-string>" -f supabase/seed.sql   # opcional: catálogo inicial de activos
```

Desarrollo local alternativo: `npx supabase start && npx supabase db reset` (aplica migraciones y `seed.sql`).

### 2. Secretos (sólo backend)

```bash
cp supabase/.env.example supabase/.env.local   # rellena las keys
npx supabase secrets set --env-file supabase/.env.local
npx supabase functions deploy market-data
npx supabase functions deploy fundamentals
npx supabase functions deploy ai-analysis
```

Claves: `TWELVE_DATA_API_KEY` y/o `ALPHA_VANTAGE_API_KEY` (según el proveedor elegido en Configuración), `AI_API_KEY` (opcional, sólo si se activa la IA; usa la Claude API con el modelo `AI_MODEL`, por defecto `claude-sonnet-5`).

### 3. Frontend

```bash
cp .env.example .env    # VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (públicas)
npm run dev
```

## Flujo de uso

1. Crear cuenta → 2. Finanzas: ingresos, gastos, deudas, metas, reserva y capital líquido → 3. Brokers → 4. Portafolio → 5. Inversiones: registrar compras (el ledger reconstruye posiciones automáticamente) → 6. Mercado: agregar activos y **sincronizar** precios/fundamentales → 7. Análisis: "Analizar todos" genera scores → 8. Recomendación: "Quiero invertir $X" → propuesta de N instrumentos con motivos → 9. "Registrar compra" desde la propuesta → el portafolio se actualiza.

## Seguridad

- RLS en todas las tablas con datos personales; catálogo de activos y precios compartidos en lectura, escritos únicamente por Edge Functions (service role).
- Ninguna API key de proveedor ni de IA existe en el frontend.
- La función `ai-analysis` verifica en el servidor que `ai_enabled = true` y elimina cualquier campo sensible (password, token, key, credential…) antes de llamar a la IA.

## Notas y límites conocidos

- Los planes gratuitos de Alpha Vantage / Twelve Data tienen límites de peticiones; la UI muestra el error `RATE_LIMIT` cuando ocurre.
- Los montos se muestran en la moneda nominal de cada activo; no hay conversión de tipo de cambio todavía.
- La estrategia "Score > umbral" del backtesting usa sólo componentes técnicos/riesgo/momentum (no existen fundamentales históricos punto-en-el-tiempo).
- Notificaciones: tabla `notifications` y tipos preparados; sin envío externo.
