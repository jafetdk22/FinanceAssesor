import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthShell from './AuthShell'

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const nav = useNavigate()
  const [password, setPassword] = useState(''); const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null)
    try { await updatePassword(password); nav('/') } catch (err) { setError((err as Error).message) }
  }
  return (
    <AuthShell title="Nueva contraseña">
      <form onSubmit={submit}>
        {error && <div className="alert alert-danger small">{error}</div>}
        <div className="mb-3"><label className="form-label">Contraseña nueva</label><input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></div>
        <button className="btn btn-primary w-100">Guardar</button>
      </form>
    </AuthShell>
  )
}
