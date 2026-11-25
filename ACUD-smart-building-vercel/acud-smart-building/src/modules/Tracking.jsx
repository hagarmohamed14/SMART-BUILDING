// Access Control › Employee tracking: who is inside, where they are now, how they moved today.
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { LEVELS, LEVEL, DEVICES } from '../data/building'
import { tms } from '../data/util'
import { trackState, fmtDur, placeName, dayStart } from '../data/tracking'
import { Panel, Seg, Kpi } from '../components/UI'
import Icon from '../components/Icons'

const PAL = ['#8a6d9e', '#c98a2e', '#4f7a92', '#5f8a52', '#a8604a', '#6c7a8f', '#9a7d4a', '#4a8a85']
const KIND = { entry: ['Entered building', '#5f8a52', 'unlock'], exit: ['Left building', '#a8604a', 'lock'], lift: ['Lift', '#6c7a8f', 'layers'], move: ['Arrived', '#c98a2e', 'move'] }
const ST = { inside: ['Inside', '#5f8a52'], left: ['Left', '#8d867b'], expected: ['Expected', '#c98a2e'], absent: ['Absent', '#b9b0a2'] }
const DOORS = DEVICES.filter(d => d.type === 'door')

// Illustrated avatar (no real photos). Drop real ID photos at public/staff/<ID>.jpg to replace.
export function Avatar({ u, size = 40 }) {
  const [real, setReal] = useState(true)
  const i = parseInt(u.id.slice(1)) || 0, bg = PAL[i % PAL.length], skin = ['#c99b7a', '#a87b5c', '#e0b896', '#8d5e43'][i % 4], hair = ['#1c1714', '#3d2c22', '#141414', '#5a4636'][(i >> 1) % 4]
  const ini = u.name.split(' ').map(x => x[0]).join('')
  if (real) return <img className="tk-av" src={`./staff/${u.id}.jpg`} alt={u.name} width={size} height={size} onError={() => setReal(false)} style={{ width: size, height: size }} />
  return <svg className="tk-av" width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={`${u.name} (illustrated avatar)`}>
    <rect width="40" height="40" rx="20" fill={bg} />
    <path d="M6 40c1-9 7-13 14-13s13 4 14 13z" fill="#2a2f38" /><path d="M16 27l4 6 4-6z" fill="#eee" />
    <ellipse cx="20" cy="17" rx="7" ry="8" fill={skin} />
    {i % 3 === 1 ? <path d="M12 18c0-8 4-11 8-11s8 3 8 11c-1-4-3-6-8-6s-7 2-8 6zM12 18v9h3v-9zM25 18v9h3v-9z" fill={hair} /> : <path d="M13 15c0-5 3-8 7-8s7 3 7 8c-2-3-4-4-7-4s-5 1-7 4z" fill={hair} />}
    <text x="33" y="37" fontSize="6" fill="#fff" fontWeight="700" textAnchor="middle" opacity=".8">{ini}</text>
  </svg>
}

// floor plan (template layout) with today's route on the selected floor
function RouteMap({ tr, level, setLevel, sel, setSel, replay }) {
  const L = LEVEL[level]
  const pts = useMemo(() => tr.past.map((s, i) => ({ ...s, i })), [tr.past])
  // orthogonal routing through the central corridor (z = 0)
  const segs = []
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    if (a.level !== b.level) continue
    const p = (s) => [s.dx ?? s.x, s.dz ?? s.z]
    const [ax, az] = [a.x, a.z], [bx, bz] = [b.x, b.z], [dx, dz] = p(b)
    segs.push({ i, d: `M${ax},${az} L${ax},0 L${dx},0 L${dx},${dz} L${bx},${bz}` })
  }
  const onFloor = pts.filter(s => s.level === level)
  const cur = tr.inside && tr.cur
  const doors = DOORS.filter(d => d.level === level)
  const used = new Set(tr.past.map(s => s.doorId).filter(Boolean))
  const counts = Object.fromEntries(LEVELS.map(l => [l.id, tr.past.filter(s => s.level === l.id && s.kind !== 'lift').length]))
  const rp = replay != null ? pts[Math.min(replay, pts.length - 1)] : null
  return <div className="tk-map">
    <div className="tk-floors">{[...LEVELS].reverse().map(l => <button key={l.id} className={(l.id === level ? 'on ' : '') + (counts[l.id] ? 'vis' : '')} onClick={() => setLevel(l.id)}>
      <b>{l.id}</b><small>{l.use}</small>{counts[l.id] > 0 && <em>{counts[l.id]}</em>}{cur && cur.level === l.id && <i className="here" title="Current floor" />}</button>)}</div>
    <div className="tk-plan">
      <div className="tk-plan-h"><b>{L.name}</b><span>{L.use}</span><i>Template layout · positions not surveyed</i></div>
      <svg viewBox="-33 -17 66 34" preserveAspectRatio="xMidYMid meet">
        <rect x="-32" y="-16" width="64" height="32" rx="1" className="pl-foot" />
        <rect x="-32" y="-1.5" width="64" height="3" className="pl-corr" />
        {L.rooms.map(rm => <g key={rm.id}><rect x={rm.x0} y={rm.z0} width={rm.x1 - rm.x0} height={rm.z1 - rm.z0} rx=".4" className={'pl-room' + (onFloor.some(s => s.room?.name === rm.name) ? ' vis' : '') + (cur && cur.level === level && cur.room?.name === rm.name ? ' cur' : '')} />
          <text x={rm.cx} y={rm.z0 + 1.6} className="pl-t" textAnchor="middle">{rm.name.length > 22 ? rm.name.slice(0, 21) + '…' : rm.name}</text></g>)}
        {doors.map(d => <rect key={d.id} x={d.x - 0.7} y={d.z - 0.35} width="1.4" height=".7" rx=".2" className={'pl-door' + (used.has(d.id) ? ' used' : '')}><title>{d.name}</title></rect>)}
        <rect x="-4" y="-9.5" width="8" height="3" rx=".4" className="pl-lift" /><text x="0" y="-7.5" className="pl-t" textAnchor="middle">Lifts</text>
        {segs.filter(s => pts[s.i].level === level).map(s => <path key={s.i} d={s.d} className={'pl-route' + (sel === s.i ? ' sel' : '')} />)}
        {segs.filter(s => pts[s.i].level === level).map(s => <circle key={'p' + s.i} r=".3" className="pl-pkt"><animateMotion dur="2.4s" repeatCount="indefinite" path={s.d} /></circle>)}
        {onFloor.map(s => <g key={s.i} className={'pl-step ' + s.kind + (sel === s.i ? ' sel' : '')} onClick={() => setSel(s.i)} style={{ cursor: 'pointer' }}>
          <circle cx={s.x} cy={s.z} r=".75" /><text x={s.x} y={s.z + 0.26} textAnchor="middle">{s.i + 1}</text>
          <title>{`${tms(s.t)} · ${placeName(s)}${s.door ? ' · via ' + s.door : ''}`}</title></g>)}
        {cur && cur.level === level && <g className="pl-me"><circle cx={cur.x} cy={cur.z} r="1.6" className="ring" /><circle cx={cur.x} cy={cur.z} r=".85" /></g>}
        {rp && rp.level === level && <g className="pl-replay" style={{ transform: `translate(${rp.x}px, ${rp.z}px)` }}><circle r=".95" /></g>}
      </svg>
      <div className="tk-legend"><span><i className="lg-route" />Route today</span><span><i className="lg-door" />Door used</span><span><i className="lg-me" />Current position</span><span><i className="lg-step" />Step no.</span></div>
    </div>
  </div>
}

// stepped floor-over-time chart for the day
function FloorTimeline({ tr, now, sel, setSel }) {
  const d0 = dayStart(now), t0 = d0 + 6 * 3600e3, t1 = d0 + 21 * 3600e3
  const lv = [...LEVELS].map(l => l.id), W = 1000, H = 120, X = (t) => 40 + (Math.min(t1, Math.max(t0, t)) - t0) / (t1 - t0) * (W - 50), Y = (l) => 8 + (lv.length - 1 - lv.indexOf(l)) / (lv.length - 1) * (H - 26)
  let d = ''
  tr.past.forEach((s, i) => { d += i ? `H${X(s.t)}V${Y(s.level)}` : `M${X(s.t)},${Y(s.level)}` })
  if (tr.past.length) d += `H${X(tr.left ? tr.exit.t : now)}`
  return <svg className="tk-tl" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
    {lv.map(l => <g key={l}><line x1="40" x2={W - 10} y1={Y(l)} y2={Y(l)} className="grid" /><text x="32" y={Y(l) + 3} textAnchor="end" className="ax">{l}</text></g>)}
    {[6, 9, 12, 15, 18, 21].map(h => <text key={h} x={X(d0 + h * 3600e3)} y={H - 4} textAnchor="middle" className="ax">{String(h).padStart(2, '0')}:00</text>)}
    <path d={d} className="tl-path" />
    {tr.past.map((s, i) => s.kind !== 'lift' && <circle key={i} cx={X(s.t)} cy={Y(s.level)} r={sel === i ? 5 : 3.2} className={'tl-pt ' + s.kind} onClick={() => setSel(i)}><title>{tms(s.t)} · {placeName(s)}</title></circle>)}
    <line x1={X(now)} x2={X(now)} y1="4" y2={H - 16} className="tl-now" />
  </svg>
}

export default function Tracking() {
  const users = useStore(s => s.users), now = useStore(s => s.now), mode = useStore(s => s.mode)
  const [q, setQ] = useState(''), [f, setF] = useState('inside'), [uid, setUid] = useState(null), [level, setLevel] = useState('GF'), [sel, setSel] = useState(null), [replay, setReplay] = useState(null)
  const all = useMemo(() => users.map(u => ({ u, tr: trackState(u, now) })), [users, Math.floor(now / 30000)])
  const list = all.filter(x => (f === 'all' || x.tr.status === f) && (!q || (x.u.name + x.u.id + x.u.dept + x.u.card).toLowerCase().includes(q.toLowerCase())))
  const pick = all.find(x => x.u.id === uid) || list[0] || all[0]
  const { u, tr } = pick
  // follow the person to their current floor when selection changes
  useEffect(() => { setSel(null); setReplay(null); if (tr.cur) setLevel(tr.cur.level) }, [u.id])
  // route replay: walk through today's steps, switching floors as the person did
  useEffect(() => {
    if (replay == null) return
    if (replay >= tr.past.length) { const t = setTimeout(() => setReplay(null), 900); return () => clearTimeout(t) }
    const s = tr.past[replay]; setLevel(s.level); setSel(replay)
    const t = setTimeout(() => setReplay(replay + 1), 900); return () => clearTimeout(t)
  }, [replay])
  const selStep = sel != null ? tr.past[sel] : null
  useEffect(() => { if (selStep && replay == null) setLevel(selStep.level) }, [sel])
  const n = (k) => all.filter(x => x.tr.status === k).length
  const [stL, stC] = ST[tr.status]
  return (
    <div className="cols tk">
      <div className="col left">
        <Panel title="Employees" sub="today · live" className="grow">
          <div className="kgrid k3 tk-k">
            <Kpi label="Inside now" value={n('inside')} color="#5f8a52" onClick={() => setF('inside')} />
            <Kpi label="Left today" value={n('left')} onClick={() => setF('left')} />
            <Kpi label="Not in" value={n('expected') + n('absent')} sub="expected · absent" onClick={() => setF('all')} />
          </div>
          <div className="tool-row">
            <div className="search sm"><Icon n="search" s={13} /><input placeholder="Name, ID, card…" value={q} onChange={e => setQ(e.target.value)} /></div>
            <Seg small value={f} options={[['inside', 'Inside'], ['left', 'Left'], ['all', 'All']]} onChange={setF} />
          </div>
          <div className="tk-list">{list.map(({ u: x, tr: t }) => <button key={x.id} className={x.id === u.id ? 'on' : ''} onClick={() => setUid(x.id)}>
            <Avatar u={x} size={34} />
            <div><b>{x.name}</b><span>{x.id} · {x.dept}</span><small>{t.status === 'inside' ? `${t.cur.level} · ${placeName(t.cur)}` : t.status === 'left' ? `Left ${tms(t.exit.t)}` : t.absent || `Expected ${t.entry ? tms(t.entry.t) : ''}`}</small></div>
            <i className={'tk-dot ' + t.status} />
          </button>)}{!list.length && <p className="empty">No employees match.</p>}</div>
        </Panel>
      </div>
      <div className="col center split">
        <Panel title="Movement route" sub={`${u.name} · ${tr.past.length} events today`} right={<button className="tk-rp" disabled={!tr.past.length} onClick={() => setReplay(replay == null ? 0 : null)}><Icon n={replay == null ? 'play' : 'pause'} s={12} />{replay == null ? 'Replay route' : 'Stop'}</button>} className="grow">
          <RouteMap tr={tr} level={level} setLevel={setLevel} sel={sel} setSel={setSel} replay={replay} />
        </Panel>
        <Panel title="Floor over time" sub="06:00 – 21:00 · click a point">
          <FloorTimeline tr={tr} now={now} sel={sel} setSel={setSel} />
        </Panel>
      </div>
      <div className="col right">
        <Panel title="Employee" right={<span className="tk-st" style={{ '--c': stC }}><i />{stL}</span>}>
          <div className="tk-prof">
            <Avatar u={u} size={72} />
            <div><b>{u.name}</b><span>ID {u.id} · {u.dept}</span><span>Card {u.card} · {u.cred}</span></div>
          </div>
          <div className="tk-facts">
            <div><small>Entry door</small><b>{tr.entry && tr.entry.t <= now ? tr.entry.door : '—'}</b></div>
            <div><small>Current location</small><b>{tr.inside ? `${tr.cur.level} · ${placeName(tr.cur)}` : tr.left ? 'Outside building' : '—'}</b></div>
            <div><small>Entry time</small><b>{tr.entry && tr.entry.t <= now ? tms(tr.entry.t) : '—'}</b></div>
            <div><small>Exit time</small><b>{tr.left ? tms(tr.exit.t) : tr.inside ? 'Still inside' : '—'}</b></div>
            <div><small>Total time inside</small><b className={tr.inside ? 'live' : ''}>{tr.timeIn ? fmtDur(tr.timeIn) : '—'}</b></div>
            <div><small>Doors passed</small><b>{tr.doorsPassed}</b></div>
          </div>
          {mode === 'sim' && tr.inside && <p className="tk-note">Simulation clock running — position updates live.</p>}
        </Panel>
        <Panel title="Movement history" sub="chronological" className="grow">
          <ol className="tk-hist">{tr.past.map((s, i) => { const [lbl, col, ic] = KIND[s.kind], nx = tr.past[i + 1]
            return <li key={i} className={(sel === i ? 'on ' : '') + s.kind} onClick={() => { setReplay(null); setSel(i) }} style={{ '--c': col }}>
              <span className="tk-n">{i + 1}</span>
              <div><b>{lbl} · {placeName(s)}</b><span>{s.level} · {s.door ? `${s.door} (${s.reader})` : s.note || 'no reader'}</span></div>
              <time>{tms(s.t)}<small>{nx ? fmtDur(nx.t - s.t) : tr.inside ? 'now' : ''}</small></time>
            </li> })}
            {!tr.past.length && <p className="empty">{tr.absent || 'Not arrived yet today.'}</p>}
          </ol>
        </Panel>
      </div>
    </div>
  )
}
