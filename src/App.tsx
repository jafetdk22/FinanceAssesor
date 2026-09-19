import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { SettingsProvider } from '@/context/SettingsContext'
import { ToastProvider } from '@/hooks/useToast'
import AppRoutes from '@/routes'
import { isSupabaseConfigured } from '@/services/supabase'

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="container py-5">
        <div className="alert alert-warning">
          <h5>Configuración requerida</h5>
          <p className="mb-0">Crea un archivo <code>.env</code> con <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> (ver <code>.env.example</code>).</p>
        </div>
      </div>
    )
  }
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
