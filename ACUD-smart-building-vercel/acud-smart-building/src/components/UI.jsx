import { animate } from './Anim'
import { useStore, activeAlarms, zoneLabel, levelName } from '../data/store'
import { SEV, STATUS, ago, dt, tms } from '../data/util'
import { DEV, SYSTEMS, LEVEL } from '../data/building'
import Icon from './Icons'

export function Panel({ title, sub, right, children, className = '', src = true, onTitle }) {
  return (
    <section className={'panel ' + className}>
      {title && <header className="p-h">
        <div className="p-t" onClick={onTitle} style={onTitle ? { cursor: 'pointer' } : null}><h3>{title}</h3>{sub && <small>{sub}</small>}</div>
        <div className="p-r">{right}{src && <span className="src" title="Simulated values — no field gateway connected">SIM</span>}</div>
      </header>}
      <div className="p-b">{children}</div>
    </section>
  )
}

export function Kpi({ label, value, unit, sub, color, onClick, trend, icon }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={'kpi' + (onClick ? ' click' : '')} onClick={onClick} style={color ? { '--kc': color } : null}>
      <small>{icon && <Icon n={icon} s={13} />}{label}</small>
      <b>{animate(value)}<em>{unit}</em></b>
      {sub && <span className="k-sub">{sub}</span>}
      {trend}
    </Tag>
  )
}

export function Pill({ s, children }) {
  const st = STATUS[s] || SEV[s] || { label: s, color: '#9a9288' }
  return <span className="pill" style={{ '--c': st.color }}>{children || st.label}</span>
}

export function Seg({ value, options, onChange, small }) {
  return <div className={'seg' + (small ? ' sm' : '')}>{options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button> })}</div>
}

export function AlarmList({ sys, level, limit = 50, compact, empty = 'No active alarms' }) {
  const alarms = useStore(s => s.alarms), now = useStore(s => s.now), open = useStore(s => s.openIncident), locate = useStore(s => s.locate)
  const list = activeAlarms(alarms).filter(a => (!sys || (Array.isArray(sys) ? sys.includes(a.sys) : a.sys === sys)) && (!level || a.level === level)).slice(0, limit)
  if (!list.length) return <div className="empty"><Icon n="check" s={16} />{empty}</div>
  return (
    <div className="alarms">
      {list.map(a => (
        <div key={a.id} className={'al ' + a.sev + (a.state === 'ack' ? ' ack' : '')} onClick={() => open(a.id)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && open(a.id)}>
          <i className="sev" />
          <div className="al-m">
            <b>{a.title}</b>
            <span>{SYSTEMS[a.sys]?.name} · {levelName(a.level)}{!compact && a.room ? ` · ${a.room}` : ''} · {ago(now, a.ts)}</span>
          </div>
          {a.state === 'ack' && <em>ACK</em>}
          {a.dev && <button className="ib" title="Locate on building model" onClick={(e) => { e.stopPropagation(); locate(a.dev) }}><Icon n="locate" s={14} /></button>}
        </div>
      ))}
    </div>
  )
}

const TEAMS = ['Facilities · Shift A', 'Facilities · Shift B', 'Security Control', 'IT / NOC', 'Electrical contractor', 'Fire & Life Safety vendor']
export function IncidentDrawer() {
  const id = useStore(s => s.openAlarm), alarms = useStore(s => s.alarms), now = useStore(s => s.now), mode = useStore(s => s.mode)
  const st = useStore.getState()
  const a = alarms.find(x => x.id === id)
  if (!a) return null
  const d = a.dev ? DEV[a.dev] : null
  const MOD = { bms: 'bms', access: 'access', fire: 'fire', cctv: 'cctv', dc: 'dc', nms: 'nms', elec: 'elec', water: 'water', gas: 'gas' }
  return (
    <div className="scrim" onClick={st.closeIncident}>
      <aside className={'drawer ' + a.sev} onClick={e => e.stopPropagation()} role="dialog" aria-label="Incident details">
        <header>
          <div><small>{a.id} · {SYSTEMS[a.sys]?.full}</small><h2>{a.title}</h2></div>
          <button className="x" onClick={st.closeIncident} aria-label="Close"><Icon n="close" /></button>
        </header>
        <div className="dr-tags"><Pill s={a.sev} /><span className="pill" style={{ '--c': a.state === 'active' ? '#c4553f' : a.state === 'ack' ? '#d08a1e' : '#5f8a52' }}>{a.state === 'active' ? 'Unacknowledged' : a.state === 'ack' ? 'Acknowledged' : 'Resolved'}</span>{a.scenario && <span className="pill" style={{ '--c': '#7c78a8' }}>Simulation scenario</span>}</div>
        <div className="dr-grid">
          <div><small>Floor</small><b>{levelName(a.level)}</b></div>
          <div><small>Zone</small><b>{zoneLabel(a.zone)}</b></div>
          <div><small>Room</small><b>{a.room || '—'}</b></div>
          <div><small>Device</small><b>{d ? d.name : '—'}</b></div>
          <div><small>Raised</small><b>{dt(a.ts)}</b></div>
          <div><small>Owner</small><b>{a.assignee || 'Unassigned'}</b></div>
        </div>
        <p className="dr-desc">{a.desc}</p>
        <div className="dr-act">
          <button disabled={a.state !== 'active' || mode === 'offline'} onClick={() => st.ack(a.id)}>Acknowledge</button>
          {d && <button onClick={() => { st.closeIncident(); st.go(MOD[a.sys] || 'overview', { device: a.dev, level: a.level }) }}><Icon n="locate" s={14} />Locate on twin</button>}
          <select disabled={a.state === 'resolved' || mode === 'offline'} value="" onChange={e => e.target.value && st.assign(a.id, e.target.value)}>
            <option value="">Assign work order…</option>{TEAMS.map(t => <option key={t}>{t}</option>)}
          </select>
          <button className="pri" disabled={a.state === 'resolved' || mode === 'offline' || (a.scenario && useStore.getState().scenarios[a.scenario])} title={a.scenario && useStore.getState().scenarios[a.scenario] ? 'Reset the scenario in the Simulation panel to clear the cause' : ''} onClick={() => st.resolve(a.id)}>Resolve</button>
        </div>
        <h4>Timeline</h4>
        <ol className="tl">{[...a.timeline].reverse().map((t, k) => <li key={k}><span>{tms(t.ts)}</span>{t.text}</li>)}</ol>
        {d && <><h4>Related devices on {LEVEL[d.level].name}</h4>
          <div className="rel">{Object.values(DEV).filter(x => x.level === d.level && x.zone === d.zone && x.id !== d.id && ['cctv', 'access', a.sys].includes(x.sys)).slice(0, 8).map(x =>
            <button key={x.id} onClick={() => { st.closeIncident(); st.locate(x.id) }}><i style={{ background: SYSTEMS[x.sys].color }} />{x.name}</button>)}</div></>}
        <p className="dr-note">Age {ago(now, a.ts)} · Source: simulated device feed</p>
      </aside>
    </div>
  )
}

export function Toasts() {
  const toasts = useStore(s => s.toasts)
  return <div className="toasts">{toasts.map(t => <div key={t.id} className={'toast ' + t.sev}>{t.text}</div>)}</div>
}

export function Table({ cols, rows, onRow, active, maxH }) {
  return (
    <div className="tbl" style={maxH ? { maxHeight: maxH } : null}>
      <table>
        <thead><tr>{cols.map(c => <th key={c.k} style={{ textAlign: c.r ? 'right' : 'left', width: c.w }}>{c.l}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.id || i} onClick={onRow ? () => onRow(r) : undefined} className={(onRow ? 'click ' : '') + (active && active === r.id ? 'on' : '')}>
          {cols.map(c => <td key={c.k} style={{ textAlign: c.r ? 'right' : 'left' }}>{c.f ? c.f(r) : r[c.k]}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  )
}
