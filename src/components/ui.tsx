import type { ReactNode } from 'react'

export function Card({ title, children, actions, className = '', subtitle }: { title?: ReactNode; subtitle?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={`card shadow-sm border-0 h-100 ${className}`}>
      {(title || actions) && (
        <div className="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            {title && <h6 className="mb-0 fw-semibold">{title}</h6>}
            {subtitle && <small className="text-muted">{subtitle}</small>}
          </div>
          {actions && <div className="d-flex gap-2 align-items-center">{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  )
}

export function StatCard({ label, value, hint, tone = 'primary', icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string; icon?: string }) {
  return (
    <div className="card shadow-sm border-0 h-100">
      <div className="card-body d-flex align-items-center gap-3">
        {icon && <div className={`stat-icon bg-${tone}-subtle text-${tone}`}><i className={`bi bi-${icon}`} /></div>}
        <div className="flex-grow-1 min-w-0">
          <div className="text-muted small text-uppercase">{label}</div>
          <div className="fs-5 fw-bold text-truncate">{value}</div>
          {hint && <div className="small text-muted">{hint}</div>}
        </div>
      </div>
    </div>
  )
}

export function Loading({ text = 'Cargando…' }: { text?: string }) {
  return (
    <div className="d-flex align-items-center gap-2 text-muted py-4 justify-content-center">
      <div className="spinner-border spinner-border-sm" role="status" /> <span>{text}</span>
    </div>
  )
}

export function ErrorAlert({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null
  return (
    <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
      <span><i className="bi bi-exclamation-triangle me-2" />{message}</span>
      {onRetry && <button className="btn btn-sm btn-outline-danger" onClick={onRetry}>Reintentar</button>}
    </div>
  )
}

export function EmptyState({ icon = 'inbox', title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-5 text-muted">
      <i className={`bi bi-${icon} fs-1 d-block mb-2`} />
      <h6 className="fw-semibold text-body">{title}</h6>
      {text && <p className="small mb-3">{text}</p>}
      {action}
    </div>
  )
}

export function Modal({ show, title, onClose, children, footer, size = '' }: { show: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: '' | 'modal-lg' | 'modal-xl' }) {
  if (!show) return null
  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog">
        <div className={`modal-dialog modal-dialog-scrollable ${size}`}>
          <div className="modal-content">
            <div className="modal-header"><h5 className="modal-title">{title}</h5><button className="btn-close" onClick={onClose} /></div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  )
}

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <span className="badge text-bg-secondary">N/D</span>
  const tone = score >= 75 ? 'success' : score >= 55 ? 'primary' : score >= 40 ? 'warning' : 'danger'
  return <span className={`badge text-bg-${tone}`}>{score.toFixed(0)}</span>
}

export function ScoreBar({ label, score }: { label: string; score: number | null }) {
  const tone = score === null ? 'secondary' : score >= 75 ? 'success' : score >= 55 ? 'primary' : score >= 40 ? 'warning' : 'danger'
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between small"><span>{label}</span><span className="fw-semibold">{score === null ? 'Sin datos' : score.toFixed(0)}</span></div>
      <div className="progress" style={{ height: 6 }}><div className={`progress-bar bg-${tone}`} style={{ width: `${score ?? 0}%` }} /></div>
    </div>
  )
}

export function Field({ label, children, help, col = 'col-md-6' }: { label: string; children: ReactNode; help?: string; col?: string }) {
  return (
    <div className={`${col} mb-3`}>
      <label className="form-label small fw-semibold">{label}</label>
      {children}
      {help && <div className="form-text">{help}</div>}
    </div>
  )
}

export function ConfirmButton({ onConfirm, label = 'Eliminar', className = 'btn btn-sm btn-outline-danger' }: { onConfirm: () => void; label?: string; className?: string }) {
  return <button className={className} onClick={() => { if (window.confirm('¿Confirmar eliminación? Esta acción no se puede deshacer.')) onConfirm() }} title={label}><i className="bi bi-trash" /></button>
}

export function ModelDisclaimer({ text = 'Esta información es una salida del modelo cuantitativo configurado y no constituye asesoría ni garantía de rendimiento.' }) {
  return <div className="alert alert-light border small mb-0"><i className="bi bi-info-circle me-2" />{text}</div>
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return <span title={text} style={{ cursor: 'help', borderBottom: '1px dotted currentColor' }}>{children}</span>
}
