import { useState, useRef, useLayoutEffect } from 'react'
import { fmt, tm } from '../data/util'
import { useTween, useTweenNum, AnimNum } from './Anim'

function useWidth(def = 300) {
  const ref = useRef(), [w, setW] = useState(def)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(80, e.contentRect.width)))
    ro.observe(ref.current); return () => ro.disconnect()
  }, [])
  return [ref, w]
}
const niceMax = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p }

// series: [{name, color, data:[{t,v}], area?, dash?}]
export function LineChart({ series, h = 160, unit = '', yMin, yMax, fmtX = tm, digits = 0, refLine, band }) {
  const [ref, w] = useWidth()
  const [hi, setHi] = useState(null)
  const pad = { l: 38, r: 10, t: 10, b: 20 }
  const all = series.flatMap(s => s.data.map(d => d.v))
  const lo = yMin ?? Math.min(0, ...all), hiV = yMax ?? niceMax(Math.max(...all, refLine?.v || 0) * 1.08)
  const n = series[0]?.data.length || 1
  const X = (i) => pad.l + (i / Math.max(1, n - 1)) * (w - pad.l - pad.r)
  const Y = (v) => pad.t + (1 - (v - lo) / (hiV - lo || 1)) * (h - pad.t - pad.b)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(k => lo + k * (hiV - lo))
  // animated copy of the data: rises from the baseline on entry, glides on every update
  const flat = useTween(series.flatMap(s => s.data.map(d => d.v)), { from: t => t.map(() => lo), enter: 600, dur: 320, stagger: 0.4 })
  let off = 0
  const aser = series.map(s => { const o = off; off += s.data.length; return { ...s, data: s.data.map((d, i) => ({ t: d.t, v: flat[o + i] ?? d.v })) } })
  const xt = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1]
  const onMove = (e) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.round((e.clientX - r.left - pad.l) / (w - pad.l - pad.r) * (n - 1)); setHi(i >= 0 && i < n ? i : null) }
  return (
    <div ref={ref} className="chart" style={{ height: h }}>
      <svg width={w} height={h} onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
        {ticks.map((t, k) => <g key={k}><line x1={pad.l} x2={w - pad.r} y1={Y(t)} y2={Y(t)} className="grid" /><text x={pad.l - 6} y={Y(t) + 3} className="ax" textAnchor="end">{fmt(t, hiV - lo < 5 ? 1 : 0)}</text></g>)}
        {xt.map((i, k) => <text key={k} x={X(i)} y={h - 5} className="ax" textAnchor={k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}>{series[0]?.data[i] ? fmtX(series[0].data[i].t) : ''}</text>)}
        {band && <rect x={pad.l} width={w - pad.l - pad.r} y={Y(band[1])} height={Math.max(0, Y(band[0]) - Y(band[1]))} className="band" />}
        {aser.map((s, k) => {
          const d = s.data.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join('')
          return <g key={k}>
            {s.area && <path d={`${d}L${X(n - 1)},${Y(lo)}L${X(0)},${Y(lo)}Z`} fill={s.color} opacity={0.13} />}
            <path d={d} fill="none" stroke={s.color} strokeWidth={s.width || 1.8} strokeDasharray={s.dash} strokeLinejoin="round" />
            {!s.dash && s.data.length > 1 && <g className="head" style={{ color: s.color }}><circle cx={X(s.data.length - 1)} cy={Y(s.data[s.data.length - 1].v)} r={6} className="hp" /><circle cx={X(s.data.length - 1)} cy={Y(s.data[s.data.length - 1].v)} r={2.6} fill={s.color} /></g>}
          </g>
        })}
        {refLine && <g><line x1={pad.l} x2={w - pad.r} y1={Y(refLine.v)} y2={Y(refLine.v)} stroke={refLine.color || '#c4553f'} strokeDasharray="4 3" strokeWidth={1.2} /><text x={w - pad.r} y={Y(refLine.v) - 4} textAnchor="end" className="ax" fill={refLine.color || '#c4553f'}>{refLine.label}</text></g>}
        {hi != null && <g>
          <line x1={X(hi)} x2={X(hi)} y1={pad.t} y2={h - pad.b} className="cross" />
          {series.map((s, k) => <circle key={k} cx={X(hi)} cy={Y(s.data[hi].v)} r={3.2} fill="#fff" stroke={s.color} strokeWidth={1.8} />)}
        </g>}
      </svg>
      {hi != null && <div className="tip" style={{ left: Math.min(w - 150, Math.max(0, X(hi) + 10)), top: 4 }}>
        <b>{fmtX(series[0].data[hi].t)}</b>
        {series.map((s, k) => <div key={k}><i style={{ background: s.color }} />{s.name}<span>{fmt(s.data[hi].v, digits)} {unit}</span></div>)}
      </div>}
    </div>
  )
}

// bars: [{label, v, color?, sub?}]
export function Bars({ data, h = 150, unit = '', digits = 0, color = '#c98a2e', onClick, active, refLine, stacked }) {
  const [ref, w] = useWidth()
  const [hi, setHi] = useState(null)
  const pad = { l: 34, r: 6, t: 10, b: 22 }
  const max = niceMax(Math.max(...data.map(d => stacked ? d.parts.reduce((a, p) => a + p.v, 0) : d.v), refLine?.v || 0) * 1.05)
  const bw = (w - pad.l - pad.r) / data.length
  const Y = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b)
  // bars grow from the axis on entry and resize smoothly on updates
  const fl = useTween(data.flatMap(d => stacked ? d.parts.map(p => p.v) : [d.v]), { enter: 1100, dur: 650, stagger: 0.45 })
  let fo = 0
  const av = data.map(d => stacked ? { ...d, parts: d.parts.map(p => ({ ...p, v: fl[fo++] ?? p.v })) } : { ...d, v: fl[fo++] ?? d.v })
  return (
    <div ref={ref} className="chart" style={{ height: h }}>
      <svg width={w} height={h}>
        {[0, 0.5, 1].map(k => <g key={k}><line x1={pad.l} x2={w - pad.r} y1={Y(k * max)} y2={Y(k * max)} className="grid" /><text x={pad.l - 5} y={Y(k * max) + 3} textAnchor="end" className="ax">{fmt(k * max, max < 5 ? 1 : 0)}</text></g>)}
        {av.map((d, i) => {
          const x = pad.l + i * bw + bw * 0.16, bwi = bw * 0.68
          const isA = active === d.label
          return <g key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onClick={() => onClick && onClick(d)} style={{ cursor: onClick ? 'pointer' : 'default' }}>
            <rect x={pad.l + i * bw} y={pad.t} width={bw} height={h - pad.t - pad.b} fill="transparent" />
            {stacked ? (() => { let acc = 0; return d.parts.map((p, k) => { const y0 = Y(acc + p.v), hh = Y(acc) - Y(acc + p.v); acc += p.v; return <rect key={k} x={x} y={y0} width={bwi} height={Math.max(0, hh)} fill={p.color} rx={k === d.parts.length - 1 ? 2 : 0} /> }) })()
              : <rect x={x} y={Y(d.v)} width={bwi} height={Math.max(0, Y(0) - Y(d.v))} rx={2} fill={d.color || color} opacity={active && !isA ? 0.35 : hi === i ? 0.85 : 1} />}
            {data.length <= 16 && <text x={x + bwi / 2} y={h - 7} textAnchor="middle" className="ax">{d.label}</text>}
          </g>
        })}
        {refLine && <g><line x1={pad.l} x2={w - pad.r} y1={Y(refLine.v)} y2={Y(refLine.v)} stroke={refLine.color || '#c4553f'} strokeDasharray="4 3" /><text x={w - pad.r} y={Y(refLine.v) - 4} textAnchor="end" className="ax" fill={refLine.color || '#c4553f'}>{refLine.label}</text></g>}
      </svg>
      {hi != null && <div className="tip" style={{ left: Math.min(w - 140, pad.l + hi * bw), top: 0 }}>
        <b>{data[hi].full || data[hi].label}</b>
        {stacked ? data[hi].parts.map((p, k) => <div key={k}><i style={{ background: p.color }} />{p.name}<span>{fmt(p.v, digits)} {unit}</span></div>)
          : <div><span>{fmt(data[hi].v, digits)} {unit}</span></div>}
      </div>}
    </div>
  )
}

export function Gauge({ v, max = 100, label, unit = '%', color = '#c98a2e', size = 110, digits = 0, warn, crit }) {
  const av = useTweenNum(v, { from: () => [0], enter: 1200, dur: 700 })
  const r = size / 2 - 9, c = Math.PI * r, k = Math.max(0, Math.min(1, av / max))
  const col = crit != null && v >= crit ? '#c4553f' : warn != null && v >= warn ? '#d08a1e' : color
  return (
    <div className="gauge" style={{ width: size }}>
      <svg width={size} height={size / 2 + 12}>
        <path d={`M9,${size / 2} A${r},${r} 0 0 1 ${size - 9},${size / 2}`} fill="none" stroke="var(--track, #e7e0d4)" strokeWidth={8} strokeLinecap="round" />
        <path d={`M9,${size / 2} A${r},${r} 0 0 1 ${size - 9},${size / 2}`} fill="none" stroke={col} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${c * k} ${c}`} />
      </svg>
      <div className="g-v"><b className="anum">{fmt(av, digits)}</b><small>{unit}</small></div>
      {label && <div className="g-l">{label}</div>}
    </div>
  )
}

export function Donut({ parts, size = 120, center, sub }) {
  const pv = useTween(parts.map(p => p.v), { from: t => t, dur: 700 }), rev = useTweenNum(1, { from: () => [0], enter: 1200 })
  const tot = pv.reduce((a, v) => a + v, 0) || 1, r = size / 2 - 10, C = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track, #ece6dc)" strokeWidth={12} />
        {parts.map((p, k) => { const len = (pv[k] ?? p.v) / tot * C * rev; const el = <circle key={k} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={12} strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-acc} />; acc += len; return el })}
      </svg>
      <div className="d-c"><b>{typeof center === 'string' || typeof center === 'number' ? <AnimNum value={center} /> : center}</b><small>{sub}</small></div>
    </div>
  )
}

export function Spark({ data, color = '#c98a2e', h = 28, w = 90 }) {
  const raw = data.map(d => d.v ?? d), lo = Math.min(...raw), hi = Math.max(...raw)
  const vs = useTween(raw, { from: t => t.map(() => (lo + hi) / 2), enter: 1100, dur: 650, stagger: 0.3 })
  const p = vs.map((v, i) => `${i ? 'L' : 'M'}${(i / (vs.length - 1) * w).toFixed(1)},${(h - 2 - (v - lo) / (hi - lo || 1) * (h - 4)).toFixed(1)}`).join('')
  return <svg width={w} height={h} className="spark"><path d={p} fill="none" stroke={color} strokeWidth={1.5} />
    <circle cx={w - 2} cy={h - 2 - ((vs[vs.length - 1] ?? lo) - lo) / (hi - lo || 1) * (h - 4)} r={2} fill={color} className="sp-head" /></svg>
}

export function Meter({ v, max = 100, color = '#c98a2e', warn, crit }) {
  const col = crit != null && v >= crit ? '#c4553f' : warn != null && v >= warn ? '#d08a1e' : color
  return <div className="meter"><i style={{ width: `${Math.max(0, Math.min(100, v / max * 100))}%`, background: col }} /></div>
}
