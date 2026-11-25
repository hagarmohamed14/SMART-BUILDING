import { animate } from './Anim'
// Overview hero: the building photograph with live hotspots and data cards.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { useSnap, fmt } from '../data/util'
import { series, electricity, climate, occ } from '../data/sim'
import { DataCard } from '../twin/TwinCards'
import { AlarmList } from './UI'
import { Spark } from './Charts'
import Icon from './Icons'
import { DEVICES } from '../data/building'
import { STATUS } from '../data/util'
import { bldOf, nodeOf } from '../data/site'

const IMG = { w: 1600, h: 900, src: './building.jpeg', px: 0.55, py: 0.5 }
// hotspot positions in image pixels
const SPOTS = {
  fire: [360, 455], access: [760, 640], energy: [700, 380],
  solar: [1010, 100], hvac: [1185, 300], cctv: [1300, 560],
}
const LEFT = ['energy', 'fire', 'access'], RIGHT = ['solar', 'hvac', 'cctv']
const COL = { ok: '#5fd46e', warn: '#ffb347', alarm: '#ff6b57' }
const SYS_OF = { fire: ['fire'], access: ['access'], energy: ['elec'], solar: ['elec'], hvac: ['bms'], cctv: ['cctv'] }

const useTrend = (fn, now, sc) => useMemo(() => series(fn, now, 12, 30), [Math.floor(now / 300000), JSON.stringify(sc)])

export default function PhotoHero({ H }) {
  const snap = useSnap(), go = useStore(s => s.go), doors = useStore(s => s.doors), status = useStore(s => s.status), mode = useStore(s => s.mode)
  const site = useStore(s => s.site), node = useStore(s => s.node), bldId = useStore(s => s.bld)
  const bld = bldOf(site, node, bldId), nd = nodeOf(site, node)
  const [open, setOpen] = useState(null)
  const { now, sc } = snap
  const box = useRef(), els = useRef({})
  const [size, setSize] = useState({ w: 1000, h: 800 })
  const [pos, setPos] = useState({})
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(box.current); return () => ro.disconnect()
  }, [])
  const s = Math.max(size.w / IMG.w, size.h / IMG.h)
  const ox = (size.w - IMG.w * s) * IMG.px, oy = (size.h - IMG.h * s) * IMG.py
  const map = ([x, y]) => [ox + x * s, oy + y * s]

  const tE = useTrend(t => electricity(t, sc).kw, now, sc)
  const tP = useTrend(t => electricity(t, sc).pv, now, sc)
  const tT = useTrend(t => climate(t, {}, sc).L3.temp, now, sc)
  const tO = useTrend(t => occ(t) * 612, now, sc)
  const b = H.bySys
  const st = (k) => b[k].state === 'alarm' ? 'alarm' : b[k].alarms ? 'warn' : 'ok'
  const cards = {
    energy: { label: 'Building load', icon: 'elec', value: fmt(snap.elec.kw, 0), unit: 'kW', sub: `PF ${fmt(snap.elec.pf, 2)} · ${b.elec.alarms} alarm(s)`, spark: tE, mod: 'elec', state: sc.powerFail ? 'alarm' : 'ok' },
    fire: { label: 'Fire & life safety', icon: 'fire', value: sc.fire ? 'FIRE ALARM' : 'Normal', unit: '', sub: `${fmt(b.fire.avail, 1)} % devices healthy`, mod: 'fire', state: sc.fire ? 'alarm' : st('fire') },
    access: { label: 'People in building', icon: 'user', value: fmt(snap.climate.L3.occ * 612, 0), unit: '', sub: `${Object.values(doors).filter(d => d.locked).length} / ${Object.keys(doors).length} doors secured`, spark: tO, mod: 'access', state: sc.intrusion ? 'alarm' : st('access') },
    solar: { label: 'Rooftop solar PV', icon: 'elec', value: fmt(snap.elec.pv, 0), unit: 'kW', sub: `${fmt(snap.elec.pv / Math.max(1, snap.elec.kw) * 100, 0)} % of current load`, spark: tP, mod: 'elec', state: 'ok' },
    hvac: { label: 'Comfort · HVAC', icon: 'thermo', value: fmt(snap.climate.L3.temp, 1), unit: '°C', sub: `CO₂ ${fmt(snap.climate.L3.co2, 0)} ppm · ${fmt(snap.climate.L3.rh, 0)} %RH`, spark: tT, mod: 'bms', state: st('bms') },
    cctv: { label: 'Video surveillance', icon: 'cctv', value: `${b.cctv.ok}/${b.cctv.total}`, unit: 'online', sub: `${b.cctv.alarms} camera alarm(s)`, mod: 'cctv', state: st('cctv') },
  }
  // measure card positions so the leader lines meet their edges
  useLayoutEffect(() => {
    const p = {}
    Object.entries(els.current).forEach(([k, el]) => { if (el && el.offsetParent) p[k] = { x: el.offsetLeft + el.offsetParent.offsetLeft, y: el.offsetTop + el.offsetParent.offsetTop, w: el.offsetWidth, h: el.offsetHeight } })
    setPos(prev => JSON.stringify(prev) === JSON.stringify(p) ? prev : p)
  })
  const score = Math.round(H.score)
  return (
    <div className="hero" ref={box}>
      <img src={IMG.src} alt={`${bld.name} — main entrance`} style={{ objectPosition: `${IMG.px * 100}% ${IMG.py * 100}%` }} className={mode === 'offline' ? 'off' : ''} />
      <div className="hero-shade" />
      <div className="hero-title">
        <small>ACUD · {nd.id} · {nd.name}</small>
        <h2>{bld.name}</h2>
        <div className="hero-chips">
          <span><i style={{ background: score > 85 ? COL.ok : score > 60 ? COL.warn : COL.alarm }} />Score {score}/100</span>
          <span>{bld.verified ? 'Drawings verified' : 'Template layout'} · 399 devices</span>
          <span className="sim">SIM · demo data</span>
        </div>
      </div>
      <svg className="hero-links" width={size.w} height={size.h}>
        {[...LEFT, ...RIGHT].map(k => {
          const [hx, hy] = map(SPOTS[k]), c = pos[k], vis = hx > 4 && hx < size.w - 4 && hy > 4 && hy < size.h - 4
          if (!vis || !c) return null
          const left = LEFT.includes(k), cx = left ? c.x + c.w : c.x, cy = c.y + c.h / 2, mx = left ? cx + 22 : cx - 22
          return <g key={k} className={'hl ' + cards[k].state}>
            <path d={`M${cx},${cy} L${mx},${cy} L${hx},${hy}`} className="flowline" />
            {[0, 1].map(j => <circle key={j} r={2.4} className="pkt"><animateMotion dur="2.6s" begin={`${j * 1.3}s`} repeatCount="indefinite" path={`M${cx},${cy} L${mx},${cy} L${hx},${hy}`} /></circle>)}
            <circle cx={hx} cy={hy} r={13} className="pulse" /><circle cx={hx} cy={hy} r={4.5} className="core" />
            <circle cx={hx} cy={hy} r={16} className="hit" onClick={() => setOpen(open === k ? null : k)} role="button" aria-label={`Open ${cards[k].label}`}><title>{cards[k].label}</title></circle>
          </g>
        })}
      </svg>
      <div className="dcards l hero-l">{LEFT.map(k => <DataCard key={k} c={cards[k]} innerRef={el => (els.current[k] = el)} onClick={() => go(cards[k].mod)} />)}</div>
      <div className="dcards r hero-r">{RIGHT.map(k => <DataCard key={k} c={cards[k]} innerRef={el => (els.current[k] = el)} onClick={() => go(cards[k].mod)} />)}</div>
      {open && (() => { const [hx, hy] = map(SPOTS[open]), c = cards[open], sys = SYS_OF[open], devs = DEVICES.filter(d => sys.includes(d.sys))
        const cnt = (k) => devs.filter(d => (k === 'ok' ? ['ok', 'run'].includes(status[d.id]) : status[d.id] === k)).length
        const left = Math.min(Math.max(12, hx - 170), size.w - 352), top = hy > size.h / 2 ? Math.max(12, hy - 330) : hy + 22
        return <div className="mk-pop" style={{ left, top }} role="dialog" aria-label={c.label}>
          <div className="mk-h"><Icon n={c.icon} s={16} /><b>{c.label}</b><i className={'mk-s ' + c.state}>{c.state === 'ok' ? 'Normal' : c.state === 'warn' ? 'Attention' : 'Alarm'}</i><button onClick={() => setOpen(null)} aria-label="Close">×</button></div>
          <div className="mk-kpi"><strong>{animate(c.value)}<small>{c.unit}</small></strong><span>{c.sub}</span></div>
          {c.spark && <div className="mk-an"><small>Last 12 h</small><Spark data={c.spark} color="#c98a2e" w={300} h={40} /></div>}
          <div className="mk-eq">{[['ok', 'Normal'], ['warn', 'Warning'], ['alarm', 'Alarm'], ['offline', 'Offline'], ['maint', 'Maint.']].map(([k, l]) => <div key={k}><i style={{ background: (STATUS[k] || STATUS.ok).color }} /><b>{cnt(k)}</b><small>{l}</small></div>)}</div>
          <div className="mk-al"><small>Active alerts</small><AlarmList sys={sys} limit={3} compact empty="No active alerts" /></div>
          <button className="mk-go" onClick={() => go(c.mod)}>Open {c.label} module<Icon n="chev" s={12} /></button>
        </div> })()}
      <div className="hero-foot">
        {[['Energy optimised', 'elec', 'elec'], ['Smart management', 'bms', 'bms'], ['Enhanced security', 'access', 'access'], ['Real-time monitoring', 'overview', 'nms']].map(([t, ic, m]) =>
          <button key={t} onClick={() => go(m)}><span className={'hf-i ' + st(m === 'overview' ? 'nms' : m)} />{t}</button>)}
      </div>
    </div>
  )
}
