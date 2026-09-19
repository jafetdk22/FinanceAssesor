import { useState } from 'react'
import { Modal } from '@/components/ui'
import { useSettings } from '@/context/SettingsContext'
import { aiService } from '@/services/recommendation.service'

/**
 * Botón de explicación mediante IA. Sólo se muestra si el switch global está en ON.
 * Envía únicamente datos estructurados ya calculados por el motor cuantitativo.
 */
export default function AiExplainButton({ kind, payload, label = 'Explicar con IA' }: { kind: 'asset' | 'portfolio' | 'recommendation' | 'scenarios' | 'news'; payload: unknown; label?: string }) {
  const { aiEnabled } = useSettings()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!aiEnabled) return null

  const run = async () => {
    setOpen(true); setBusy(true); setError(null); setText(null)
    try { const r = await aiService.explain(kind, payload); setText(r.text) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <>
      <button className="btn btn-sm btn-outline-info" onClick={run}><i className="bi bi-magic me-1" />{label}</button>
      <Modal show={open} title="Explicación (IA)" onClose={() => setOpen(false)} size="modal-lg">
        {busy && <div className="text-muted"><span className="spinner-border spinner-border-sm me-2" />Generando explicación…</div>}
        {error && <div className="alert alert-danger small">{error}</div>}
        {text && <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>}
        <div className="alert alert-light border small mt-3 mb-0">La IA sólo interpreta resultados ya calculados por el motor cuantitativo. No sustituye los cálculos ni garantiza rendimientos.</div>
      </Modal>
    </>
  )
}
