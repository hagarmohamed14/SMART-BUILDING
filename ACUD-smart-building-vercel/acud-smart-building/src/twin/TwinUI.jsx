import * as THREE from 'three'
import { LEVELS, LEVEL, DEV, SYSTEMS, TYPES, ZONE_NAMES, DEVICES } from '../data/building'
import { useStore, activeAlarms } from '../data/store'
import { STATUS, SEV, useSnap, readings, fmt, devAlarm } from '../data/util'
import Icon from '../components/Icons'

const MODULE_OF = { bms: 'bms', access: 'access', fire: 'fire', cctv: 'cctv', dc: 'dc', nms: 'nms', elec: 'elec', water: 'water', gas: 'gas' }

export default function TwinUI({ controls, layer, fixedLayer, hovered, lvAlarm, compact, cards, setCards }) {
  const level = useStore(s => s.level), view = useStore(s => s.view), explode = useStore(s => s.explode), device = useStore(s => s.device)
  const { setLevel, setView, setExplode, setLayer, selectDevice } = useStore.getState()
  const zoom = (f) => { const c = controls.current; if (!c) return; const cam = c.object; const d = cam.position.clone().sub(c.target); d.multiplyScalar(f); cam.position.copy(c.target.clone().add(d)); c.update() }
  return (
    <>
      <div className="twin-tools">
        <div className="seg">
          <button className={view === '3d' ? 'on' : ''} onClick={() => setView('3d')} title="3D perspective"><Icon n="cube" s={14} />3D</button>
          <button className={view === '2d' ? 'on' : ''} onClick={() => { if (!level) setLevel('L3'); setView('2d') }} title="2D floor plan (top-down)"><Icon n="square" s={14} />2D</button>
        </div>
        <button className={'tbtn' + (explode ? ' on' : '')} onClick={() => setExplode(!explode)} title="Exploded view: lift the floors above the selected level"><Icon n="explode" s={14} />Explode</button>
        <button className="tbtn" onClick={() => zoom(0.8)} title="Zoom in"><Icon n="plus" s={14} /></button>
        <button className="tbtn" onClick={() => zoom(1.25)} title="Zoom out"><Icon n="minus" s={14} /></button>
        <button className="tbtn" onClick={() => { setView('3d'); selectDevice(null); setLevel(null) }} title="Back to whole building"><Icon n="reset" s={14} />Building</button>
        {!compact && setCards && <button className={'tbtn' + (cards ? ' on' : '')} onClick={() => setCards(!cards)} title="Show / hide the floating live-data cards"><Icon n="layers" s={14} />Data cards</button>}
        <select className="tsel" value={layer || ''} onChange={e => setLayer(e.target.value || (fixedLayer ? '' : null))} title="System layer shown on the model">
          <option value="">{fixedLayer ? 'All systems' : 'Layers: alarms only'}</option>
          {Object.entries(SYSTEMS).map(([k, v]) => <option key={k} value={k}>{v.full}</option>)}
        </select>
      </div>

      <div className="floor-sel">
        <div className="fs-h">Floors</div>
        {[...LEVELS].reverse().map(L => {
          const a = lvAlarm[L.id]
          return <button key={L.id} className={'fs-b' + (level === L.id ? ' on' : '') + (hovered === L.id ? ' hov' : '')} onClick={() => setLevel(level === L.id ? null : L.id)} title={`${L.name} · ${L.use}`}>
            <b>{L.id}</b>{!compact && <span>{L.use}</span>}
            <i className="dot" style={{ background: a ? SEV[a].color : '#5f8a52' }} />
          </button>
        })}
        <button className={'fs-b all' + (!level ? ' on' : '')} onClick={() => { setLevel(null); setView('3d') }}><b>ALL</b>{!compact && <span>Whole building</span>}</button>
      </div>

      {level && !device && <LevelCard lv={level} layer={layer} compact={compact} />}
      {device && <Inspector id={device} />}
      {!compact && <Legend layer={layer} />}
      {hovered && hovered !== level && <div className="hover-pill">{LEVEL[hovered].name} · {LEVEL[hovered].use} — click to isolate</div>}
    </>
  )
}

function LevelCard({ lv, layer }) {
  const snap = useSnap(), alarms = useStore(s => s.alarms), status = useStore(s => s.status), go = useStore(s => s.go), selectDevice = useStore(s => s.selectDevice)
  const L = LEVEL[lv], c = snap.climate[lv]
  const devs = DEVICES.filter(d => d.level === lv)
  const act = activeAlarms(alarms).filter(a => a.level === lv)
  const bySys = Object.keys(SYSTEMS).map(k => [k, devs.filter(d => d.sys === k)]).filter(([, l]) => l.length)
  const bad = devs.filter(d => !['ok', 'run'].includes(status[d.id])).length
  return (
    <div className="lvl-card glass">
      <div className="lc-h"><div><small>{L.id}</small><b>{L.name}</b><span>{L.use}</span></div><span className="src">SIM</span></div>
      <div className="lc-kpis">
        <div><small>Temp</small><b>{fmt(c.temp, 1)}°C</b></div>
        <div><small>Occupancy</small><b>{fmt(c.occ * 100, 0)}%</b></div>
        <div><small>Power</small><b>{fmt(snap.elec.floors[lv], 0)} kW</b></div>
        <div><small>Water</small><b>{fmt(snap.water.floors[lv], 2)} m³/h</b></div>
      </div>
      <div className="lc-sys">
        {bySys.map(([k, l]) => <button key={k} className={layer === k ? 'on' : ''} onClick={() => useStore.getState().setLayer(layer === k ? null : k)} title={`Show ${SYSTEMS[k].full} devices`}>
          <i style={{ background: SYSTEMS[k].color }} />{SYSTEMS[k].name}<b>{l.length}</b></button>)}
      </div>
      <div className="lc-foot">{devs.length} devices · {L.rooms.length} rooms · <span style={{ color: bad ? '#d08a1e' : '#5f8a52' }}>{bad} not normal</span></div>
      {act.length > 0 && <div className="lc-al">{act.slice(0, 3).map(a => <button key={a.id} onClick={() => { useStore.getState().openIncident(a.id); a.dev && selectDevice(a.dev) }}><i style={{ background: SEV[a.sev].color }} />{a.title}</button>)}</div>}
    </div>
  )
}

function Inspector({ id }) {
  const d = DEV[id], st = useStore(), snap = useSnap()
  const s = st.status[id] || 'ok', a = devAlarm(st.alarms, id)
  const rows = readings(d, snap, st)
  const mod = MODULE_OF[d.sys]
  return (
    <div className="inspector glass">
      <div className="in-h">
        <i style={{ background: SYSTEMS[d.sys].color }} />
        <div><small>{TYPES[d.type][1]} · {d.id}</small><b>{d.name}</b></div>
        <button className="x" onClick={() => st.selectDevice(null)} aria-label="Close"><Icon n="close" s={14} /></button>
      </div>
      <div className="in-loc">{LEVEL[d.level].name} · {d.room} · Zone {ZONE_NAMES[d.zone.split('-')[1]]}</div>
      <div className="in-st"><span className="pill" style={{ '--c': (STATUS[s] || STATUS.ok).color }}>{(STATUS[s] || STATUS.ok).label}</span><span className="src" title="Simulated reading — no field gateway connected">SIM</span></div>
      <table className="in-t"><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
      {a && <button className="in-al" onClick={() => st.openIncident(a.id)} style={{ '--c': SEV[a.sev].color }}><b>{SEV[a.sev].label}</b>{a.title}<Icon n="chev" s={12} /></button>}
      <div className="in-act">
        {d.type === 'door' && <><button onClick={() => st.doorCmd(id, 'pulse')}>Momentary unlock</button><button onClick={() => st.doorCmd(id, st.doors[id].locked ? 'unlock' : 'lock')}>{st.doors[id].locked ? 'Unlock' : 'Lock'}</button></>}
        {d.type === 'esv' && <button onClick={() => st.setEsv(id, st.esv[id] === 'closed' ? 'open' : 'closed')}>{st.esv[id] === 'closed' ? 'Open valve' : 'Close valve'}</button>}
        {!['alarm'].includes(s) && <button onClick={() => st.setDevStatus(id, s === 'maint' ? 'ok' : 'maint')}>{s === 'maint' ? 'Return to service' : 'Maintenance mode'}</button>}
        {mod && st.module !== mod && <button className="pri" onClick={() => st.go(mod, { device: id, level: d.level })}>Open {SYSTEMS[d.sys].name} <Icon n="chev" s={12} /></button>}
      </div>
    </div>
  )
}

function Legend({ layer }) {
  return <div className="legend">
    {Object.entries(STATUS).filter(([k]) => ['ok', 'warn', 'alarm', 'offline', 'maint'].includes(k)).map(([k, v]) => <span key={k}><i style={{ background: v.color }} />{v.label}</span>)}
    {layer && <span className="lg-sys"><i style={{ background: SYSTEMS[layer].color }} />{SYSTEMS[layer].full} layer</span>}
  </div>
}
