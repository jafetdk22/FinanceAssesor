import type { ReactNode } from 'react'

export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="auth-bg">
      <div className="card auth-card shadow-lg border-0">
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <i className="bi bi-bar-chart-line-fill fs-1 text-primary" />
            <h4 className="fw-bold mt-2 mb-0">{title}</h4>
            {subtitle && <p className="text-muted small">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
