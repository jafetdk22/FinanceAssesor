import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthShell from './AuthShell'

export default function LoginPage() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null)
    try { await signIn(email, password); nav('/') } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <AuthShell title="Iniciar sesión" subtitle="Investment Intelligence Platform">
      <form onSubmit={submit}>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <div className="mb-3"><label className="form-label">Correo</label><input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
        <div className="mb-3"><label className="form-label">Contraseña</label><input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <button className="btn btn-primary w-100" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <div className="d-flex justify-content-between mt-3 small">
        <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
        <Link to="/register">Crear cuenta</Link>
      </div>
    </AuthShell>
  )
}
