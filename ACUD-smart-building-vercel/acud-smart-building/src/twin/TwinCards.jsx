import { animate } from '../components/Anim'
// Floating live-data cards around the 3D model, with leader lines to the building
// (lines are positioned every frame by <CardLinks> inside the canvas).
import { useMemo } from 'react'
import { useStore, activeAlarms } from '../data/store'
import { DEVICES, LEVELS } from '../data/building'
import { useSnap, fmt } from '../data/util'
import { series, climate, electricity, occ } from '../data/sim'
import { Spark } from '../components/Charts'
import Icon from '../components/Icons'

const OFFICE = LEVELS.filter(L => ['L2', 'L3', 'L4', 'L5'].includes(L.id)).map(L => L.id)
const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length

function useTrend(fn, now, sc) {
  return useMemo(() => series(fn, now, 12, 30), [Math.floor(now / 300000), JSON.stringify(sc)])
}

export function useCardData() {
  const snap = useSnap(), status = useStore(s => s.status), alarms = useStore(s => s.alarms)
  const { now, sc } = snap
  const tT = useTrend(t => avg(OFFICE.map(id => climate(t, {}, sc)[id].temp)), now, sc)
  const tE = useTrend(t => electricity(t, sc).kw, now, sc)
  const tO = useTrend(t => occ(t) * 100, now, sc)
  const tQ = useTrend(t => avg(OFFICE.map(id => climate(t, {}, sc)[id].pm25)), now, sc)
  const act = activeAlarms(alarms)
  const bad = DEVICES.filter(d => !['ok', 'run'].includes(status[d.id]))
  const maint = DEVICES.filter(d => status[d.id] === 'maint')
  const crit = act.filter(a => a.sev === 'critical').length
  const temp = avg(OFFICE.map(id => snap.climate[id].temp)), pm = avg(OFFICE.map(id => snap.climate[id].pm25)), co2 = avg(OFFICE.map(id => snap.climate[id].co2))
  const occNow = avg(OFFICE.map(id => snap.climate[id].occ)) * 100
  return {
    temp: { label: 'Temperature', icon: 'thermo', value: fmt(temp, 1), unit: '°C', sub: 'Office floors avg', spark: tT, mod: 'bms', state: temp > 25.5 ? 'warn' : 'ok' },
    energy: { label: 'Energy demand', icon: 'elec', value: fmt(snap.elec.kw, 0), unit: 'kW', sub: `PV ${fmt(snap.elec.pv, 0)} kW · PF ${fmt(snap.elec.pf, 2)}`, spark: tE, mod: 'elec', state: sc.powerFail ? 'alarm' : 'ok' },
    occ: { label: 'Occupancy', icon: 'user', value: fmt(occNow, 0), unit: '%', sub: `${fmt(snap.net.wifiClients)} Wi-Fi clients`, spark: tO, mod: 'access', state: 'ok' },
    equip: { label: 'Equipment status', icon: crit ? 'alert' : 'check', value: crit ? 'Critical' : bad.length > DEVICES.length * 0.05 ? 'Attention' : 'Optimal', unit: '', sub: `${DEVICES.length - bad.length} / ${DEVICES.length} devices normal`, mod: 'overview', state: crit ? 'alarm' : bad.length > DEVICES.length * 0.05 ? 'warn' : 'ok' },
    air: { label: 'Air quality', icon: 'wind', value: pm < 15 && co2 < 900 ? 'Good' : pm < 35 && co2 < 1100 ? 'Moderate' : 'Poor', unit: '', sub: `PM2.5 ${fmt(pm, 0)} µg/m³ · CO₂ ${fmt(co2, 0)} ppm`, spark: tQ, mod: 'bms', state: co2 > 1100 ? 'warn' : 'ok' },
    maint: { label: 'Predictive maintenance', icon: 'wrench', value: maint.length ? `${maint.length} in service` : 'No alerts', unit: '', sub: maint[0] ? maint[0].name : 'Next service in 6 days', mod: 'bms', state: maint.length ? 'warn' : 'ok' },
  }
}

// 3D anchor points (level + local offset) for each card
const LEFT = [['temp', { lv: 'L4', x: -26, y: 2.2, z: 16 }], ['energy', { lv: 'L2', x: -12, y: 2.2, z: 16 }], ['occ', { lv: 'GF', x: -2, y: 2, z: 16 }]]
const RIGHT = [['equip', { lv: 'RF', x: 22, y: 3.5, z: -6 }], ['air', { lv: 'L3', x: 20, y: 3.2, z: 12 }], ['maint', { lv: 'B1', x: 12, y: 2.4, z: -8 }]]
const COL = { ok: '#5fd46e', warn: '#ffb347', alarm: '#ff6b57' }

export function DataCard({ c, onClick, innerRef, style }) {
  return <button ref={innerRef} className={'dcard ' + c.state} style={style} onClick={onClick} title={`Open ${c.label}`}>
    <div className="dc-h"><Icon n={c.icon} s={15} /><small>{c.label}</small><i style={{ background: COL[c.state] }} /></div>
    <b>{animate(c.value)}<em>{c.unit}</em></b>
    <span>{c.sub}</span>
    {c.spark && <Spark data={c.spark} color="#7cc8ff" w={150} h={22} />}
  </button>
}

export default function TwinCards({ refs }) {
  const data = useCardData(), go = useStore(s => s.go)
  const all = [...LEFT.map(x => [...x, 'l']), ...RIGHT.map(x => [...x, 'r'])]
  refs.current.anchors = all.map(([, a]) => a)
  return <>
    <svg className="dlinks">{all.map(([k], i) => <g key={k} ref={el => { refs.current.lines[i] = el && { path: el.children[0], dot: el.children[1] } }}>
      <path fill="none" stroke="#7cc8ff" strokeWidth="1.2" strokeOpacity=".85" className="flowline" />
      <circle r="3.5" fill="#bfe6ff" className="dl-dot" />
    </g>)}</svg>
    <div className="dcards l">{LEFT.map(([k], i) => <DataCard key={k} c={data[k]} innerRef={el => (refs.current.els[i] = el)} onClick={() => go(data[k].mod)} />)}</div>
    <div className="dcards r">{RIGHT.map(([k], i) => <DataCard key={k} c={data[k]} innerRef={el => (refs.current.els[LEFT.length + i] = el)} onClick={() => go(data[k].mod)} />)}</div>
  </>
}
