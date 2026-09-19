import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface Toast { id: number; type: 'success' | 'danger' | 'warning' | 'info'; message: string }
const Ctx = createContext<{ push: (type: Toast['type'], message: string) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }, [])
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1080 }}>
        {toasts.map((t) => (
          <div key={t.id} className={`toast show text-bg-${t.type} border-0`} role="alert">
            <div className="d-flex">
              <div className="toast-body">{t.message}</div>
              <button className="btn-close btn-close-white me-2 m-auto" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} />
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useToast fuera de ToastProvider')
  return c
}
