import { useMemo, useState } from 'react'
import type { Asset } from '@/types'

/** Selector de activo con búsqueda local sobre el catálogo. */
export default function AssetPicker({ assets, value, onChange, placeholder = 'Buscar símbolo o nombre…' }: { assets: Asset[]; value: string | null; onChange: (a: Asset | null) => void; placeholder?: string }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const selected = assets.find((a) => a.id === value) ?? null
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return assets.slice(0, 20)
    return assets.filter((a) => a.symbol.toLowerCase().includes(s) || a.name.toLowerCase().includes(s)).slice(0, 20)
  }, [q, assets])

  return (
    <div className="position-relative">
      <div className="input-group">
        <input className="form-control" placeholder={placeholder} value={open ? q : selected ? `${selected.symbol} — ${selected.name}` : ''}
          onFocus={() => { setOpen(true); setQ('') }} onChange={(e) => setQ(e.target.value)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
        {selected && <button className="btn btn-outline-secondary" type="button" onClick={() => onChange(null)}><i className="bi bi-x" /></button>}
      </div>
      {open && (
        <div className="list-group position-absolute w-100 shadow" style={{ zIndex: 1100, maxHeight: 260, overflowY: 'auto' }}>
          {results.length === 0 && <div className="list-group-item small text-muted">Sin resultados. Agrega el activo en Mercado.</div>}
          {results.map((a) => (
            <button type="button" key={a.id} className="list-group-item list-group-item-action small" onMouseDown={() => { onChange(a); setOpen(false) }}>
              <strong>{a.symbol}</strong> <span className="text-muted">{a.name}</span> <span className="badge text-bg-light float-end">{a.asset_type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
