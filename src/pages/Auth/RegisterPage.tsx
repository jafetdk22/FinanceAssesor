import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthShell from './AuthShell'

export default function RegisterPage() {
  const { signUp } = useAuth()
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    setBusy(true); setError(null)
    try { await signUp(email, password, name); setDone(true) } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <AuthShell title="Crear cuenta">
      {done ? (
        <div className="alert alert-success small">Cuenta creada. Si tu proyecto requiere confirmación, revisa tu correo. <Link to="/login">Ir a iniciar sesión</Link></div>
      ) : (
        <form onSubmit={submit}>
          {error && <div className="alert alert-danger py-2 small">{error}</div>}
          <div className="mb-3"><label className="form-label">Nombre</label><input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="mb-3"><label className="form-label">Correo</label><input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="mb-3"><label className="form-label">Contraseña</label><input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></div>
          <button className="btn btn-primary w-100" disabled={busy}>{busy ? 'Creando…' : 'Registrarme'}</button>
        </form>
      )}
      <div className="text-center mt-3 small"><Link to="/login">Ya tengo cuenta</Link></div>
    </AuthShell>
  )
}
