import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthShell from './AuthShell'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState(''); const [msg, setMsg] = useState<string | null>(null); const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null)
    try { await resetPassword(email); setMsg('Si el correo existe, recibirás un enlace para restablecer tu contraseña.') } catch (err) { setError((err as Error).message) }
  }
  return (
    <AuthShell title="Recuperar contraseña">
      <form onSubmit={submit}>
        {msg && <div className="alert alert-success small">{msg}</div>}
        {error && <div className="alert alert-danger small">{error}</div>}
        <div className="mb-3"><label className="form-label">Correo</label><input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <button className="btn btn-primary w-100">Enviar enlace</button>
      </form>
      <div className="text-center mt-3 small"><Link to="/login">Volver</Link></div>
    </AuthShell>
  )
}
