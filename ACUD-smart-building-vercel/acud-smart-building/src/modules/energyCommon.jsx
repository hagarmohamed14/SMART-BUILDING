import { useMemo } from 'react'
import { series, dailyTotals, HOUR, DAY } from '../data/sim'

// Consumption for a period: '24h' → hourly bars today; '7d' / '30d' → daily totals
export function usePeriod(key, rateFn, now, sc, period) {
  return useMemo(() => {
    if (period === '24h') {
      const start = new Date(now); start.setHours(0, 0, 0, 0)
      const out = []
      for (let h = 0; h < 24; h++) { const t = start.getTime() + h * HOUR; out.push({ label: String(h).padStart(2, '0'), full: `${String(h).padStart(2, '0')}:00`, v: t + 30 * 60000 <= now ? rateFn(t + 30 * 60000) : 0, future: t > now }) }
      return out
    }
    const days = period === '7d' ? 7 : 30
    return dailyTotals(key + JSON.stringify(sc), rateFn, now, days).map(d => { const dd = new Date(d.t); return { label: days === 7 ? dd.toLocaleDateString('en-GB', { weekday: 'short' }) : String(dd.getDate()), full: dd.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }), v: d.v } })
  }, [key, period, Math.floor(now / (period === '24h' ? 300000 : 3600000)), JSON.stringify(sc)])
}
export const useDay = (fn, now, sc, step = 15) => useMemo(() => series(fn, now, 24, step), [Math.floor(now / 120000), JSON.stringify(sc)])

// schematic primitives (viewBox units)
export function Pipe({ d, color = '#c98a2e', on: onP = true, w = 3, speed = 1.6, label }) {
  const on = !!onP
  return <g className="pipe">
    <path d={d} stroke={on ? color : '#cfc6b8'} strokeWidth={w + 3} strokeOpacity={0.22} fill="none" strokeLinecap="round" />
    <path d={d} stroke={on ? color : '#bdb3a5'} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    {on && <path d={d} className="flow" stroke="#fffaf1" strokeWidth={Math.max(1.2, w - 1.2)} style={{ animationDuration: `${speed}s` }} />}
    {label}
  </g>
}
export function Box({ x, y, w = 110, h = 46, title, sub, state = 'ok', onClick, sel, icon }) {
  const c = { ok: '#5f8a52', warn: '#d08a1e', alarm: '#c4553f', off: '#9a9288', maint: '#7c78a8', offline: '#9a9288', run: '#5f8a52' }[state] || '#5f8a52'
  return <g className={'sbox' + (sel ? ' sel' : '') + (onClick ? ' click' : '')} transform={`translate(${x - w / 2},${y - h / 2})`} onClick={onClick}>
    <rect width={w} height={h} rx={8} />
    <rect width={4} height={h - 14} x={6} y={7} rx={2} fill={c} />
    <text x={16} y={19} className="bt">{title}</text>
    <text x={16} y={35} className="bs">{sub}</text>
    {state === 'alarm' && <circle cx={w - 9} cy={9} r={4} fill={c} className="blink" />}
  </g>
}
export const COST = (v, rate) => v * rate
