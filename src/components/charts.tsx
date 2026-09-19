import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtMoney, fmtNum } from '@/utils/format'

export const PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569']

const shortDate = (d: string) => d.slice(0, 7)

export function DonutChart({ data, currency = 'USD', height = 260 }: { data: Array<{ key: string; value: number; weight: number }>; currency?: string; height?: number }) {
  if (!data.length) return <div className="text-muted small text-center py-4">Sin datos</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="key" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip formatter={(v: number, _n, p) => [`${fmtMoney(v, currency)} (${((p.payload as { weight: number }).weight * 100).toFixed(1)}%)`]} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function ValueAreaChart({ data, dataKey = 'value', currency = 'USD', height = 260, color = PALETTE[0], extraKey, extraLabel }: { data: Array<Record<string, unknown>>; dataKey?: string; currency?: string; height?: number; color?: string; extraKey?: string; extraLabel?: string }) {
  if (!data.length) return <div className="text-muted small text-center py-4">Sin datos históricos</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
        <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.35} /><stop offset="95%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40} fontSize={11} />
        <YAxis fontSize={11} tickFormatter={(v) => fmtNum(v, 0)} width={70} />
        <Tooltip formatter={(v: number) => fmtMoney(v, currency)} />
        <Area type="monotone" dataKey={dataKey} stroke={color} fill="url(#g1)" name="Valor" dot={false} />
        {extraKey && <Line type="stepAfter" dataKey={extraKey} stroke={PALETTE[2]} dot={false} name={extraLabel} strokeDasharray="4 2" />}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function PriceChart({ data, height = 320, showSma = true }: { data: Array<{ date: string; close: number; sma20?: number | null; sma50?: number | null; sma200?: number | null; bbUpper?: number | null; bbLower?: number | null }>; height?: number; showSma?: boolean }) {
  if (!data.length) return <div className="text-muted small text-center py-4">Sin precios</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40} fontSize={11} />
        <YAxis fontSize={11} domain={['auto', 'auto']} width={60} />
        <Tooltip formatter={(v: number) => fmtNum(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="close" stroke={PALETTE[0]} dot={false} name="Cierre" strokeWidth={1.5} />
        {showSma && <Line type="monotone" dataKey="sma20" stroke={PALETTE[2]} dot={false} name="SMA 20" strokeWidth={1} />}
        {showSma && <Line type="monotone" dataKey="sma50" stroke={PALETTE[1]} dot={false} name="SMA 50" strokeWidth={1} />}
        {showSma && <Line type="monotone" dataKey="sma200" stroke={PALETTE[3]} dot={false} name="SMA 200" strokeWidth={1} />}
        {showSma && <Line type="monotone" dataKey="bbUpper" stroke="#999" dot={false} name="BB sup" strokeDasharray="3 3" strokeWidth={0.8} />}
        {showSma && <Line type="monotone" dataKey="bbLower" stroke="#999" dot={false} name="BB inf" strokeDasharray="3 3" strokeWidth={0.8} />}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function OscillatorChart({ data, keys, height = 160, refLines }: { data: Array<Record<string, unknown>>; keys: Array<{ key: string; name: string; color?: string; bar?: boolean }>; height?: number; refLines?: number[] }) {
  void refLines
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40} fontSize={11} />
        <YAxis fontSize={11} width={60} />
        <Tooltip formatter={(v: number) => fmtNum(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k, i) => k.bar
          ? <Bar key={k.key} dataKey={k.key} name={k.name} fill={k.color ?? PALETTE[i]} />
          : <Line key={k.key} type="monotone" dataKey={k.key} name={k.name} stroke={k.color ?? PALETTE[i]} dot={false} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Series normalizadas (base 100) para comparar activos */
export function NormalizedChart({ series, height = 320 }: { series: Array<{ name: string; data: Array<{ date: string; close: number }> }>; height?: number }) {
  if (!series.length) return <div className="text-muted small text-center py-4">Sin datos</div>
  const dateSet = series.map((s) => new Set(s.data.map((d) => d.date)))
  let dates = [...dateSet[0]]
  for (const s of dateSet.slice(1)) dates = dates.filter((d) => s.has(d))
  dates.sort()
  const maps = series.map((s) => new Map(s.data.map((d) => [d.date, d.close])))
  const base = maps.map((m) => m.get(dates[0]) ?? 1)
  const rows = dates.map((d) => Object.fromEntries([['date', d], ...series.map((s, i) => [s.name, (maps[i].get(d)! / base[i]) * 100])]))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ left: 8, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40} fontSize={11} />
        <YAxis fontSize={11} domain={['auto', 'auto']} width={50} />
        <Tooltip formatter={(v: number) => v.toFixed(1)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => <Line key={s.name} type="monotone" dataKey={s.name} stroke={PALETTE[i % PALETTE.length]} dot={false} strokeWidth={1.5} />)}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function SimpleBarChart({ data, xKey, yKey, height = 240, color = PALETTE[0], formatter }: { data: Array<Record<string, unknown>>; xKey: string; yKey: string; height?: number; color?: string; formatter?: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey={xKey} fontSize={11} />
        <YAxis fontSize={11} width={60} tickFormatter={(v) => fmtNum(v, 0)} />
        <Tooltip formatter={(v: number) => (formatter ? formatter(v) : fmtNum(v))} />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
