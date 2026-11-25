import { useState } from 'react'
import { useStore, activeAlarms, SCENARIOS, RESPONSES } from '../data/store'
import { SYSTEMS } from '../data/building'
import { SEV, tms, dt } from '../data/util'
import { HOUR } from '../data/sim'
import Icon from './Icons'
import { AlarmList } from './UI'
import { ZONE_TYPES, ZONE_ORDER, nodeOf, bldOf, defaultSite } from '../data/site'

export const MODULES = [
  ['overview', 'Overview', 'overview'], ['bms', 'BMS', 'bms'], ['hvac', 'HVAC', 'thermo'], ['access', 'Access Control', 'access'], ['fire', 'Fire Alarm', 'fire'],
  ['cctv', 'CCTV', 'cctv'], ['dc', 'Data Center', 'dc'], ['nms', 'Network (NMS)', 'nms'],
  ['energy', 'Energy Management', 'elec'],
]
const GROUP = { energy: ['energy', 'elec', 'water', 'gas'] }
const SUB = { energy: 'Summary', elec: 'Electricity', water: 'Water', gas: 'Gas' }

export function Brand() {
  const theme = useStore(s => s.theme)
  return <div className="brand">
    <img className="acud-logo" src={theme === 'dark' ? './acud-logo-dark.png' : './acud-logo.png'} alt="ACUD" />
    <div className="brand-t"><b>Smart Building</b><small>Management Platform</small></div>
  </div>
}

// Schneider Electric partner mark. Drop an official file at public/schneider-logo.png to replace the wordmark.
export function SchneiderMark() {
  const [img, setImg] = useState(true)
  return <div className="se-mark" title="Schneider Electric">
    {img ? <img src="./schneider-logo.png" alt="Schneider Electric" onError={() => setImg(false)} />
      : <span className="se-word"><b>Schneider</b><i>Electric</i></span>}
  </div>
}

export function SitePicker() {
  const site = useStore(s => s.site), node = useStore(s => s.node), bld = useStore(s => s.bld)
  const [open, setOpen] = useState(false), [edit, setEdit] = useState(false)
  const n = nodeOf(site, node), b = bldOf(site, node, bld)
  return <div className="site-pick">
    <button className="site-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
      <em style={{ background: ZONE_TYPES[b.zone]?.color }} /><b>{n.id}</b><span>{b.name}</span>{!b.verified && <i className="tpl">template</i>}<Icon n="chev" s={11} style={{ transform: 'rotate(90deg)' }} />
    </button>
    {open && <div className="pop site-pop" onMouseLeave={() => setOpen(false)}>
      <div className="pop-h"><b>ACUD sites & buildings</b><button onClick={() => { setEdit(true); setOpen(false) }}>Edit profiles</button></div>
      <div className="site-nodes">{site.map(x => <button key={x.id} className={x.id === n.id ? 'on' : ''} onClick={() => useStore.getState().setSite(x.id, x.buildings[0]?.id)}>{x.id}</button>)}</div>
      <div className="site-blds">{n.buildings.map(x => { const z = ZONE_TYPES[x.zone] || ZONE_TYPES.admin
        return <button key={x.id} className={x.id === b.id ? 'on' : ''} onClick={() => { useStore.getState().setSite(n.id, x.id); setOpen(false) }}>
          <Icon n={z.icon} s={15} c={z.color} /><div><b>{x.name}</b><small>{z.areas.slice(0, 3).join(' · ')}</small></div>
          <span className={x.verified ? 'ver' : 'unv'}>{x.verified ? 'Drawings verified' : 'Layout unverified'}</span></button> })}</div>
      <p className="site-note">Floor layouts and equipment positions are templates until official ACUD architectural drawings are provided. Use <b>Edit profiles</b> to configure each node.</p>
    </div>}
    {edit && <SiteEditor onClose={() => setEdit(false)} />}
  </div>
}

function SiteEditor({ onClose }) {
  const site0 = useStore(s => s.site), node = useStore(s => s.node)
  const [site, setSite] = useState(() => JSON.parse(JSON.stringify(site0)))
  const [nid, setNid] = useState(node)
  const n = site.find(x => x.id === nid) || site[0]
  const upd = (f) => setSite(s => s.map(x => x.id === n.id ? f({ ...x, buildings: x.buildings.map(b => ({ ...b })) }) : x))
  const updB = (id, k, v) => upd(x => ({ ...x, buildings: x.buildings.map(b => b.id === id ? { ...b, [k]: v } : b) }))
  return <div className="modal-bg" onClick={onClose}><div className="modal site-ed" onClick={e => e.stopPropagation()} role="dialog" aria-label="Edit building profiles">
    <div className="pop-h"><b>Building profiles · configurable until drawings are issued</b><button onClick={onClose}>Close</button></div>
    <div className="site-nodes">{site.map(x => <button key={x.id} className={x.id === n.id ? 'on' : ''} onClick={() => setNid(x.id)}>{x.id}</button>)}</div>
    <div className="se-row"><label>Node name<input value={n.name} onChange={e => upd(x => ({ ...x, name: e.target.value }))} /></label>
      <label>Location / address<input value={n.location} placeholder="not set" onChange={e => upd(x => ({ ...x, location: e.target.value }))} /></label></div>
    <table className="se-t"><thead><tr><th>Building</th><th>Zone type</th><th>Floors</th><th>Drawings</th><th>Notes</th><th /></tr></thead><tbody>
      {n.buildings.map(b => <tr key={b.id}>
        <td><input value={b.name} onChange={e => updB(b.id, 'name', e.target.value)} /></td>
        <td><select value={b.zone} onChange={e => updB(b.id, 'zone', e.target.value)}>{ZONE_ORDER.map(z => <option key={z} value={z}>{ZONE_TYPES[z].name}</option>)}</select></td>
        <td><input type="number" min="0" max="60" value={b.floors ?? ''} placeholder="—" onChange={e => updB(b.id, 'floors', e.target.value === '' ? null : Math.max(0, +e.target.value))} style={{ width: 60 }} /></td>
        <td><label className="chk"><input type="checkbox" checked={b.verified} onChange={e => updB(b.id, 'verified', e.target.checked)} />verified</label></td>
        <td><input value={b.notes} placeholder="e.g. drawing ref." onChange={e => updB(b.id, 'notes', e.target.value)} /></td>
        <td><button className="x" title="Remove" onClick={() => upd(x => ({ ...x, buildings: x.buildings.filter(y => y.id !== b.id) }))}>×</button></td></tr>)}
    </tbody></table>
    <div className="se-f">
      <button onClick={() => upd(x => ({ ...x, buildings: [...x.buildings, { id: `${x.id}-b${Date.now() % 100000}`, name: 'New building', zone: 'admin', floors: null, verified: false, notes: '' }] }))}>+ Add building</button>
      <button onClick={() => setSite(defaultSite())}>Restore defaults</button>
      <button className="pri" onClick={() => { useStore.getState().saveSiteProfiles(site); useStore.getState().toast('Building profiles saved'); onClose() }}>Save profiles</button>
    </div>
  </div></div>
}

export function ThemeToggle() {
  const theme = useStore(s => s.theme)
  return <button className="theme-btn" onClick={() => useStore.getState().setTheme(theme === 'dark' ? 'light' : 'dark')} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle dark mode">
    <Icon n={theme === 'dark' ? 'sun' : 'moon'} s={16} />
  </button>
}

export function NavRail() {
  const module = useStore(s => s.module), go = useStore(s => s.go), alarms = useStore(s => s.alarms)
  const act = activeAlarms(alarms)
  return (
    <nav className="rail" aria-label="Modules">
      {MODULES.map(([id, label, icon], k) => {
        const ids = GROUP[id] || [id], on = ids.includes(module)
        const n = id === 'overview' ? 0 : act.filter(a => ids.includes(a.sys)).length
        const crit = act.some(a => ids.includes(a.sys) && a.sev === 'critical')
        return <div key={id} className="rail-item">
          {(k === 1 || k === 8) && <div className="rail-sep">{k === 1 ? 'Systems' : 'Energy'}</div>}
          <button className={on ? 'on' : ''} onClick={() => go(id)} title={label} aria-current={on ? 'page' : undefined}>
            <Icon n={icon} s={16} /><span>{label}</span>
            {n > 0 && <em className={crit ? 'crit' : ''}>{n}</em>}
          </button>
        </div>
      })}
    </nav>
  )
}

export function Header() {
  const mode = useStore(s => s.mode), now = useStore(s => s.now), alarms = useStore(s => s.alarms), speed = useStore(s => s.speed), module = useStore(s => s.module)
  const { setMode, setSpeed } = useStore.getState()
  const [pop, setPop] = useState(null)
  const act = activeAlarms(alarms)
  const cnt = (s) => act.filter(a => a.sev === s).length
  const title = GROUP.energy.includes(module) ? `Energy Management${module === 'energy' ? '' : ' › ' + SUB[module]}` : MODULES.find(m => m[0] === module)?.[1]
  return (
    <header className="top">
      <Brand />
      <SitePicker />
      <div className="crumbs"><Icon n="chev" s={12} /><b>{title}</b></div>
      <div className="top-r">
        <div className="seg mode" role="group" aria-label="Data mode">
          {[['live', 'Live'], ['sim', 'Simulation'], ['offline', 'Offline']].map(([k, l]) => <button key={k} className={mode === k ? 'on ' + k : ''} onClick={() => setMode(k)}><i />{l}</button>)}
        </div>
        {mode === 'sim' && <select className="tsel" value={speed} onChange={e => setSpeed(+e.target.value)} title="Simulation speed">
          <option value={1}>1× real time</option><option value={60}>60× (1 min/s)</option><option value={600}>600× (10 min/s)</option></select>}
        <div className="clock" title={mode === 'live' ? 'Real time' : 'Simulated time'}><b>{tms(now)}</b><small>{new Date(now).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}{mode === 'sim' ? ' · SIM' : ''}</small></div>
        <button className="src-btn" onClick={() => setPop(pop === 'src' ? null : 'src')}><i className={'live-dot ' + mode} />Data: simulated</button>
        <button className="al-btn" onClick={() => setPop(pop === 'al' ? null : 'al')} aria-label="Active alarms">
          <Icon n="bell" s={17} />
          <span style={{ '--c': SEV.critical.color }}>{cnt('critical')}</span><span style={{ '--c': SEV.major.color }}>{cnt('major')}</span><span style={{ '--c': SEV.minor.color }}>{cnt('minor')}</span>
        </button>
        <ThemeToggle />
        <div className="user"><Icon n="user" s={16} /><div><b>J. Adel</b><small>Shift supervisor</small></div></div>
        <SchneiderMark />
      </div>
      {pop === 'al' && <div className="pop al-pop" onMouseLeave={() => setPop(null)}>
        <div className="pop-h"><b>Active alarms ({act.length})</b><button onClick={() => useStore.getState().ackAll()}>Acknowledge all</button></div>
        <AlarmList limit={30} />
      </div>}
      {pop === 'src' && <div className="pop src-pop" onMouseLeave={() => setPop(null)}>
        <div className="pop-h"><b>Data sources & integrations</b></div>
        <p>No field gateway is connected to this installation. Every reading on screen is produced by the built-in simulator and tagged <span className="src">SIM</span>. Readings from a connected device would be tagged <span className="src real">LIVE</span>.</p>
        <table className="in-t"><tbody>
          {[['BACnet/IP', 'BMS · HVAC · lighting'], ['Modbus TCP', 'Energy meters · UPS · generator'], ['SNMP v3', 'Network · racks · PDUs'], ['ONVIF / RTSP', 'CCTV cameras · NVR'], ['OSDP / Wiegand', 'Access control readers'], ['OPC UA', 'Fire panel · pumps · gas']].map(([p, d]) =>
            <tr key={p}><td><b>{p}</b><br /><small>{d}</small></td><td style={{ textAlign: 'right' }}><span className="pill" style={{ '--c': '#9a9288' }}>Not connected</span></td></tr>)}
        </tbody></table>
        <p><b>Live</b> streams simulated values in real time · <b>Simulation</b> runs accelerated time and lets you inject scenarios · <b>Offline</b> freezes the last known values and disables commands.</p>
      </div>}
    </header>
  )
}

export function OfflineBanner() {
  const mode = useStore(s => s.mode), at = useStore(s => s.offlineAt)
  if (mode !== 'offline') return null
  return <div className="offline-banner"><b>OFFLINE</b> Gateway connection lost at {tms(at)}. Showing last known values — commands are disabled. <button onClick={() => useStore.getState().setMode('live')}>Reconnect</button></div>
}

export function SimPanel() {
  const mode = useStore(s => s.mode), scenarios = useStore(s => s.scenarios), now = useStore(s => s.now), paused = useStore(s => s.paused), auto = useStore(s => s.simAuto), responded = useStore(s => s.responded)
  const [open, setOpen] = useState(true)
  if (mode !== 'sim') return null
  const st = useStore.getState()
  const jump = (h) => { const d = new Date(now); d.setHours(h, 0, 0, 0); useStore.setState({ now: d.getTime() }) }
  return (
    <div className={'sim-panel' + (open ? '' : ' min')}>
      <header onClick={() => setOpen(!open)}><Icon n="play" s={13} /><b>Simulation scenarios</b><small>{Object.keys(scenarios).length} active</small><Icon n="chev" s={12} style={{ transform: open ? 'rotate(90deg)' : 'none' }} /></header>
      {open && <>
        <div className="sim-ctl">
          <button className={paused ? 'pri' : ''} onClick={() => paused ? st.simStart() : st.simPause()}><Icon n={paused ? 'play' : 'pause'} s={12} />{paused ? 'Start' : 'Pause'}</button>
          <button onClick={() => st.simReset()}><Icon n="history" s={12} />Reset</button>
          <div className="seg sm" role="group" aria-label="Response mode">{[[true, 'Auto'], [false, 'Manual']].map(([v, l]) => <button key={l} className={auto === v ? 'on' : ''} onClick={() => st.setSimAuto(v)}>{l}</button>)}</div>
          <span className={'sim-state' + (paused ? ' p' : '')}>{paused ? 'Paused' : 'Running'}</span>
        </div>
        <div className="sim-hint">{auto ? 'Auto: the engine executes the automatic response as soon as a scenario starts.' : 'Manual: alarms are raised; automatic responses wait for the operator.'}</div>
        <div className="sim-time"><span>Jump to</span>{[3, 9, 13, 18, 22].map(h => <button key={h} onClick={() => jump(h)}>{String(h).padStart(2, '0')}:00</button>)}<button onClick={() => useStore.setState({ now: now + 24 * HOUR })}>+1 day</button></div>
        {Object.entries(SCENARIOS).map(([k, s]) => (
          <div key={k} className={'sc' + (scenarios[k] ? ' on' : '')}>
            <i style={{ background: SYSTEMS[s.sys].color }} />
            <div><b>{s.name}</b><small>{scenarios[k] ? `Active since ${tms(scenarios[k])} · ${responded[k] ? 'response executed' : 'awaiting response'}` : s.desc}</small></div>
            {scenarios[k] && !responded[k] && <button className="pri" onClick={() => st.applyResponse(k)} title={RESPONSES[k]?.text.join(' · ')}>Respond</button>}
            {scenarios[k] ? <button onClick={() => st.clearScenario(k)}>Reset</button> : <button className="pri" onClick={() => st.triggerScenario(k)}>Start</button>}
          </div>
        ))}
      </>}
    </div>
  )
}

export function CritBanner() {
  const alarms = useStore(s => s.alarms)
  const c = activeAlarms(alarms).find(a => a.sev === 'critical' && a.state === 'active')
  if (!c) return null
  return <div className="crit-banner" onClick={() => useStore.getState().openIncident(c.id)} role="button">
    <i /> <b>CRITICAL</b> {c.title} — {c.level} · {c.room} <span>{dt(c.ts)} · click for incident</span>
  </div>
}
