import { useEffect, useState } from 'react'
import { Card, Field, Loading } from '@/components/ui'
import { CURRENCIES, RISK_PROFILES } from '@/constants'
import { useAuth } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { useToast } from '@/hooks/useToast'
import type { AppSettings, Profile, ScoreWeights } from '@/types'
import { validateWeights } from '@/utils/scoring'

export default function SettingsPage() {
  const { settings, profile, loading, saveSettings, saveProfile } = useSettings()
  const { updatePassword, user } = useAuth()
  const toast = useToast()
  const [p, setP] = useState<Partial<Profile>>({})
  const [s, setS] = useState<Partial<AppSettings>>({})
  const [pwd, setPwd] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (profile) setP(profile) }, [profile])
  useEffect(() => { if (settings) setS(settings) }, [settings])

  if (loading || !settings) return <Loading />
  const w = (s.score_weights ?? settings.score_weights) as ScoreWeights
  const wErr = validateWeights(w)
  const sum = Object.values(w).reduce((a, b) => a + Number(b || 0), 0)

  const save = async () => {
    if (wErr) { toast.push('warning', wErr); return }
    setBusy(true)
    try { await Promise.all([saveProfile(p), saveSettings(s)]); toast.push('success', 'Configuración guardada') }
    catch (e) { toast.push('danger', (e as Error).message) } finally { setBusy(false) }
  }

  const toggleAi = async (on: boolean) => {
    setS({ ...s, ai_enabled: on })
    try { await saveSettings({ ai_enabled: on }); toast.push('info', on ? 'IA activada' : 'IA desactivada') } catch (e) { toast.push('danger', (e as Error).message) }
  }

  return (
    <>
      <h1 className="page-title mb-3">Configuración</h1>
      <div className="row g-3">
        <div className="col-lg-6">
          <Card title="Perfil">
            <div className="row">
              <Field label="Nombre" col="col-12"><input className="form-control" value={p.full_name ?? ''} onChange={(e) => setP({ ...p, full_name: e.target.value })} /></Field>
              <Field label="Correo" col="col-12"><input className="form-control" value={user?.email ?? ''} readOnly /></Field>
              <Field label="Moneda principal"><select className="form-select" value={p.base_currency ?? 'MXN'} onChange={(e) => setP({ ...p, base_currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Perfil de riesgo"><select className="form-select" value={p.risk_profile ?? 'MODERATE'} onChange={(e) => setP({ ...p, risk_profile: e.target.value as Profile['risk_profile'] })}>{RISK_PROFILES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Field>
              <Field label="Horizonte de inversión (años)"><input type="number" min={1} className="form-control" value={p.investment_horizon_years ?? 5} onChange={(e) => setP({ ...p, investment_horizon_years: Number(e.target.value) })} /></Field>
            </div>
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Reserva de emergencia y datos de mercado">
            <div className="row">
              <Field label="Meses de reserva"><input type="number" min={0} className="form-control" value={s.emergency_fund_months ?? 6} onChange={(e) => setS({ ...s, emergency_fund_months: Number(e.target.value) })} /></Field>
              <Field label="Reserva actual"><input type="number" min={0} className="form-control" value={s.emergency_fund_current ?? 0} onChange={(e) => setS({ ...s, emergency_fund_current: Number(e.target.value) })} /></Field>
              <Field label="Capital líquido"><input type="number" min={0} className="form-control" value={s.liquid_capital ?? 0} onChange={(e) => setS({ ...s, liquid_capital: Number(e.target.value) })} /></Field>
              <Field label="Proveedor de datos" help="La API key se configura en Supabase (secrets), nunca aquí."><select className="form-select" value={s.market_data_provider ?? 'twelve_data'} onChange={(e) => setS({ ...s, market_data_provider: e.target.value as AppSettings['market_data_provider'] })}><option value="twelve_data">Twelve Data</option><option value="alpha_vantage">Alpha Vantage</option></select></Field>
            </div>
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Pesos del modelo de scoring" subtitle={<span className={wErr ? 'text-danger' : 'text-success'}>Suma: {sum}% {wErr ? `— ${wErr}` : '✓'}</span>}>
            {(['fundamental', 'technical', 'risk', 'valuation', 'momentum'] as const).map((k) => (
              <div className="d-flex align-items-center gap-2 gap-md-3 mb-2 weight-row" key={k}>
                <span className="text-capitalize weight-label">{k}</span>
                <input type="range" className="form-range flex-grow-1" min={0} max={100} value={w[k]} onChange={(e) => setS({ ...s, score_weights: { ...w, [k]: Number(e.target.value) } })} />
                <input type="number" className="form-control form-control-sm" style={{ width: 70 }} min={0} max={100} value={w[k]} onChange={(e) => setS({ ...s, score_weights: { ...w, [k]: Number(e.target.value) } })} />
              </div>
            ))}
            <div className="form-text">Si un activo no tiene datos para una categoría, su peso se redistribuye proporcionalmente y se documenta en la explicación.</div>
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Recomendaciones y alertas">
            <div className="row">
              <Field label="Posiciones por recomendación"><input type="number" min={1} max={10} className="form-control" value={s.recommendation_positions ?? 5} onChange={(e) => setS({ ...s, recommendation_positions: Number(e.target.value) })} /></Field>
              <Field label="Máx. concentración por activo (%)"><input type="number" min={1} max={100} className="form-control" value={s.max_asset_concentration ?? 25} onChange={(e) => setS({ ...s, max_asset_concentration: Number(e.target.value) })} /></Field>
              <Field label="Máx. concentración por sector (%)"><input type="number" min={1} max={100} className="form-control" value={s.max_sector_concentration ?? 40} onChange={(e) => setS({ ...s, max_sector_concentration: Number(e.target.value) })} /></Field>
            </div>
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Inteligencia artificial (opcional)">
            <div className="d-flex justify-content-between align-items-center border rounded p-3 mb-3">
              <div><div className="fw-semibold">Análisis mediante IA</div><div className="small text-muted">Por defecto desactivado.</div></div>
              <div className="form-check form-switch fs-4 mb-0"><input className="form-check-input" type="checkbox" checked={!!s.ai_enabled} onChange={(e) => toggleAi(e.target.checked)} /></div>
            </div>
            {s.ai_enabled ? (
              <div className="alert alert-info small mb-0">La IA puede utilizar información financiera y de mercado disponible en la plataforma para generar explicaciones adicionales.<br /><br />Los cálculos principales continúan realizándose mediante el motor cuantitativo. Nunca se envían contraseñas, tokens, API keys ni credenciales de brokers.</div>
            ) : (
              <div className="alert alert-light border small mb-0">Con la IA apagada no se llama a ningún servicio de IA, no se generan costos y no se envía información financiera a terceros. La plataforma funciona completamente sin IA.</div>
            )}
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Seguridad">
            <Field label="Nueva contraseña" col="col-12"><div className="input-group"><input type="password" className="form-control" value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={8} /><button className="btn btn-outline-secondary" disabled={pwd.length < 8} onClick={async () => { try { await updatePassword(pwd); setPwd(''); toast.push('success', 'Contraseña actualizada') } catch (e) { toast.push('danger', (e as Error).message) } }}>Cambiar</button></div></Field>
          </Card>
        </div>
      </div>
      <div className="sticky-bottom bg-white border-top py-2 mt-3 text-end"><button className="btn btn-primary" disabled={busy || !!wErr} onClick={save}>Guardar configuración</button></div>
    </>
  )
}
