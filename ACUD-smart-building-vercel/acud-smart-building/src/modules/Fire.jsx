import { useState } from 'react'
import { useStore, activeAlarms } from '../data/store'
import { LEVELS, DEVICES, ZONE_NAMES, LEVEL } from '../data/building'
import { useSnap, fmt, dt, SEV, STATUS } from '../data/util'
import { Panel, Kpi, AlarmList, Pill } from '../components/UI'
import { Meter } from '../components/Charts'
import Twin from '../twin/LazyTwin'

export default function Fire() {
  const snap = useSnap(), st = useStore()
  const [silenced, setSilenced] = useState(false)
  const act = activeAlarms(st.alarms).filter(a => a.sys === 'fire')
  const fire = act.some(a => a.sev === 'critical')
  const fd = DEVICES.filter(d => d.sys === 'fire')
  const cnt = (t) => fd.filter(d => d.type === t).length
  const faults = fd.filter(d => ['fault', 'offline'].includes(st.status[d.id])).length
  const zoneState = (lv, z) => { const zid = `${lv}-${z}`; const a = act.find(x => x.zone === zid); if (a) return a.sev === 'critical' ? 'alarm' : 'warn'; if (fd.some(d => d.zone === zid && st.status[d.id] === 'fault')) return 'fault'; return 'ok' }
  const cmd = (what) => {
    if (!st.guard()) return
    if (what === 'silence') { setSilenced(true); st.toast('Sounders silenced — alarm remains active', 'warn'); act.forEach(a => st.log(a.id, 'Sounders silenced at FACP-1')) }
    if (what === 'reset') { if (snap.sc.fire) { st.toast('Reset refused: detectors still in alarm. Clear the cause first.', 'crit'); return } setSilenced(false); st.toast('Fire panel reset — system normal') }
    if (what === 'evac') { st.toast('Evacuation message broadcast to all floors (drill)', 'crit'); useStore.setState(s => ({ fireHistory: [{ ts: s.now, type: 'Drill', text: 'Manual evacuation broadcast from command centre', level: 'All' }, ...s.fireHistory] })) }
  }
  const hist = [...act.map(a => ({ ts: a.ts, type: a.sev === 'critical' ? 'Fire' : 'Fault', text: a.title, level: a.level })), ...st.fireHistory].sort((a, b) => b.ts - a.ts)
  return (
    <div className="mod">
      <div className="cols">
        <div className="col left">
          <Panel title="Fire alarm control panel" sub="FACP-1 · addressable, 8 loops">
            <div className={'facp ' + (fire ? 'fire' : 'ok')}>
              <b>{fire ? 'FIRE' : 'SYSTEM NORMAL'}</b>
              <span>{fire ? `${act.filter(a => a.sev === 'critical').length} zone(s) in alarm · sounders ${silenced ? 'silenced' : 'ON'}` : `${faults} fault(s) · 0 disablements`}</span>
            </div>
            <div className="facp-btn">
              <button onClick={() => cmd('silence')} disabled={!fire}>Silence sounders</button>
              <button onClick={() => cmd('reset')}>Reset panel</button>
              <button className="danger" onClick={() => cmd('evac')}>Evacuate</button>
            </div>
            <div className="kgrid k3">
              <Kpi label="Smoke detectors" value={cnt('smoke')} /><Kpi label="Heat detectors" value={cnt('heat')} /><Kpi label="Call points" value={cnt('mcp')} />
              <Kpi label="Sounders" value={cnt('sounder')} /><Kpi label="Faults" value={faults} color={faults ? '#d08a1e' : null} /><Kpi label="Mains / battery" value="OK" sub="24 V · 98 %" />
            </div>
          </Panel>
          <Panel title="Fire zones" sub="click a zone to locate">
            <div className="zones">
              <div className="zh"><span />{['Z1', 'Z2', 'Z3', 'Z4'].map(z => <small key={z} title={ZONE_NAMES[z]}>{z}</small>)}</div>
              {[...LEVELS].reverse().map(L => <div key={L.id} className="zr"><b>{L.id}</b>
                {['Z1', 'Z2', 'Z3', 'Z4'].map(z => { const s = zoneState(L.id, z); return <button key={z} className={'zc ' + s} title={`${L.name} · ${ZONE_NAMES[z]} — ${STATUS[s].label}`} onClick={() => { st.setLevel(L.id); const d = DEVICES.find(x => x.zone === `${L.id}-${z}` && x.sys === 'fire'); d && st.selectDevice(d.id) }}>{s === 'alarm' ? 'FIRE' : s === 'ok' ? '' : STATUS[s].label}</button> })}
              </div>)}
            </div>
          </Panel>
          <Panel title="Suppression & fire water">
            <div className="supp">
              {DEVICES.filter(d => ['fm200', 'sprinkler'].includes(d.type) || /Fire/.test(d.name) && d.type === 'pump').map(d => <button key={d.id} onClick={() => st.selectDevice(d.id)}>
                <i style={{ background: (STATUS[st.status[d.id]] || STATUS.ok).color }} /><b>{d.name}</b>
                <span>{d.type === 'fm200' ? '42 bar · armed' : d.type === 'pump' ? (snap.water.pumps[d.id] === 'run' ? 'RUNNING' : 'Auto standby') : st.status[d.id] === 'warn' ? 'FLOW' : '7.2 bar · set'}</span></button>)}
              <div className="tank-row"><span>Fire reserve tank GT-2</span><Meter v={snap.water.tanks['TANK-B1-02']} color="#c4553f" /><b>{fmt(snap.water.tanks['TANK-B1-02'], 0)}%</b></div>
            </div>
          </Panel>
        </div>
        <div className="col center"><Twin layer="fire" /></div>
        <div className="col right">
          <Panel title="Fire & life-safety alarms" src={false}><AlarmList sys="fire" limit={8} empty="No fire alarms — all zones normal" /></Panel>
          <Panel title="Emergency exits & evacuation">
            <div className="exits">{LEVELS.filter(L => L.id !== 'RF').map(L => <button key={L.id} onClick={() => { st.setLevel(L.id); st.selectDevice(null) }}>
              <b>{L.id}</b><span>2 stairs · {snap.sc.fire && ['L2', 'L3', 'L4'].includes(L.id) ? 'EVACUATING' : 'clear'}</span>
              <em style={{ color: snap.sc.fire && L.id === 'L3' ? '#c4553f' : '#5f8a52' }}>{snap.sc.fire ? `${fmt(snap.climate[L.id].occ * 95 * (L.id === 'L3' ? 0.3 : 0.6), 0)} people` : 'doors monitored'}</em></button>)}</div>
            <small className="hint">Select a floor to see evacuation routes (green arrows) on the model.</small>
          </Panel>
          <Panel title="Event history" src={false} className="grow">
            <div className="hist">{hist.slice(0, 20).map((h, i) => <div key={i}><span>{dt(h.ts)}</span><Pill s={h.type === 'Fire' ? 'alarm' : h.type === 'Fault' ? 'warn' : h.type === 'Drill' ? 'maint' : 'ok'}>{h.type}</Pill><b>{h.text}</b><em>{h.level}</em></div>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
