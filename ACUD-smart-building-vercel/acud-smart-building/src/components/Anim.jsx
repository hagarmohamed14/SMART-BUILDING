// Shared animation primitives: eased tweens for chart data and count-up numbers.
// Entry: values rise from a baseline with a left-to-right stagger. Updates (live / simulation
// ticks): values glide from what is on screen to the new target. Honours prefers-reduced-motion.
import { useEffect, useRef, useState } from 'react'

export const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const ease = (t) => 1 - Math.pow(1 - t, 3)
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)

/**
 * Tween an array of numbers.
 * from: (target) => start array used on first mount (default: zeros)
 * enter / dur: ms for the entry animation / for later updates
 * stagger: 0..1 share of the entry spent cascading across indices
 */
export function useTween(target, { from, enter = 520, dur = 300, stagger = 0.25 } = {}) {
  const [val, setVal] = useState(() => (reduced ? target : from ? from(target) : target.map(() => 0)))
  const cur = useRef(val), raf = useRef(0), first = useRef(true)
  const key = target.join('|')
  useEffect(() => {
    if (reduced) { cur.current = target; setVal(target); return }
    const b = target, a0 = cur.current, n = b.length
    const a = a0.length === n ? a0 : b.map((v, i) => { const j = Math.round(i * (a0.length - 1) / Math.max(1, n - 1)); return a0.length ? a0[j] : v })
    const isEnter = first.current; first.current = false
    const d = isEnter ? enter : dur, st = isEnter ? stagger : 0
    const t0 = performance.now()
    cancelAnimationFrame(raf.current)
    const step = (now) => {
      const k = (now - t0) / d
      const v = b.map((x, i) => { const s = st * (n > 1 ? i / (n - 1) : 0); const e = ease(clamp01((k - s) / (1 - st))); return a[i] + (x - a[i]) * e })
      cur.current = v; setVal(v)
      if (k < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [key])
  return val
}

export const useTweenNum = (v, opt) => useTween([Number.isFinite(v) ? v : 0], { stagger: 0, ...opt })[0]

// Count-up for any displayed value: every number inside the string is animated, the
// surrounding text ("26/28", "1,163", "FIRE ALARM") is preserved. Keeps the source's decimals
// and thousands separators.
const NUM = /-?\d[\d,]*(?:\.\d+)?/g
export function AnimNum({ value }) {
  const s = value == null ? '' : String(value)
  const toks = [...s.matchAll(NUM)].map(m => { const t = m[0], dot = t.indexOf('.'); return { t, i: m.index, v: parseFloat(t.replace(/,/g, '')), dec: dot < 0 ? 0 : t.length - dot - 1, comma: t.includes(',') } })
  const vals = useTween(toks.map(k => k.v), { enter: 480, dur: 260, stagger: 0 })
  const prev = useRef(null), [fl, setFl] = useState('')
  const sum = toks.reduce((a, k) => a + k.v, 0)
  useEffect(() => { if (prev.current != null && sum !== prev.current) { setFl(''); requestAnimationFrame(() => setFl(sum > prev.current ? 'f-up' : 'f-dn')) } prev.current = sum }, [sum])
  if (!toks.length) return s
  let out = '', last = 0
  toks.forEach((k, j) => {
    const v = vals[j] ?? k.v
    const txt = k.comma || Math.abs(k.v) >= 1000 && k.t.includes(',')
      ? v.toLocaleString('en-US', { minimumFractionDigits: k.dec, maximumFractionDigits: k.dec })
      : v.toFixed(k.dec)
    out += s.slice(last, k.i) + txt; last = k.i + k.t.length
  })
  return <span className={'anum ' + fl}>{out + s.slice(last)}</span>
}

// Wrap a value if it is plain text/number; leave JSX untouched.
export const animate = (v) => (typeof v === 'string' || typeof v === 'number' ? <AnimNum value={v} /> : v)
