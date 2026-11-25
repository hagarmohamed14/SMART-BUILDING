import { animate } from '../components/Anim'
// Energy Management — one tab grouping Electricity, Water and Gas.
// The summary page combines the three utilities; the sub-tabs open the
// existing Electricity / Water / Gas pages unchanged.
import { useMemo, useState } from 'react'
import { useStore, activeAlarms } from '../data/store'
import { LEVELS, SYSTEMS } from '../data/building'
import { useSnap, fmt, fmtK } from '../data/util'
import { electricity, water, gas, series, dailyTotals, TARIFF } from '../data/sim'
import { Panel, Kpi, AlarmList, Seg } from '../components/UI'
import { LineChart, Bars, Donut, Spark } from '../components/Charts'
import Icon from '../components/Icons'

export const ENERGY_TABS = [['energy', 'Summary', 'overview'], ['elec', 'Electricity', 'elec'], ['water', 'Water', 'water'], ['gas', 'Gas', 'gas']]
export const ENERGY_MODULES = ENERGY_TABS.map(t => t[0])
const CO2 = { kwh: 0.47, gas: 1.9 } // kg CO₂ per kWh / per m³ natural gas
const C = { elec: SYSTEMS.elec.color, water: SYSTEMS.water.color, gas: SYSTEMS.gas.color }

export function EnergyTabs() {
  const module = useStore(s => s.module), go = useStore(s => s.go), alarms = useStore(s => s.alarms)
  const act = activeAlarms(alarms)
  return <div className="subtabs" role="tablist" aria-label="Energy management">
    <b><Icon n="elec" s={15} />Energy Management</b>
    {ENERGY_TABS.map(([id, label, icon]) => {
      const n = id === 'energy' ? 0 : act.filter(a => a.sys === id).length
      return <button key={id} role="tab" aria-selected={module === id} className={module === id ? 'on' : ''} onClick={() => go(id)}>
        <Icon n={icon} s={14} />{label}{n > 0 && <em>{n}</em>}
      </button>
    })}
  </div>
}

const RANGE = { '24h': 1, '7d': 7, '30d': 30 }
export default function Energy() {
  const snap = useSnap(), go = useStore(s => s.go), setLevel = useStore(s => s.setLevel)
  const { now, sc } = snap, e = snap.elec, w = snap.water, g = snap.gas
  const [period, setPeriod] = useState('7d')
  const key = Math.floor(now / 300000), skey = JSON.stringify(sc)

  // today so far (midnight → now), hourly integration
  const today = useMemo(() => {
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    let kwh = 0, m3w = 0, m3g = 0
    for (let t = start.getTime(); t < now; t += 15 * 60000) { kwh += electricity(t, sc).kw / 4; m3w += water(t, sc).flow / 4; m3g += gas(t, sc).flow / 4 }
    return { kwh, m3w, m3g }
  }, [key, skey])
  const cost = { elec: today.kwh * TARIFF.kwh, water: today.m3w * TARIFF.water, gas: today.m3g * TARIFF.gas }
  const costAll = cost.elec + cost.water + cost.gas
  const co2 = (today.kwh * CO2.kwh + today.m3g * CO2.gas) / 1000

  const trend = useMemo(() => ({
    e: series(t => electricity(t, sc).kw, now, 24, 20), w: series(t => water(t, sc).flow, now, 24, 20), g: series(t => gas(t, sc).flow, now, 24, 20),
  }), [key, skey])

  // daily cost by utility for the selected period
  const days = RANGE[period]
  const daily = useMemo(() => {
    if (days === 1) {
      const start = new Date(now); start.setHours(0, 0, 0, 0)
      return Array.from({ length: 24 }, (_, h) => { const t = start.getTime() + h * 3600000 + 1800000, past = t <= now
        return { label: String(h).padStart(2, '0'), full: `${String(h).padStart(2, '0')}:00`, parts: [
          { name: 'Electricity', color: C.elec, v: past ? electricity(t, sc).kw * TARIFF.kwh : 0 },
          { name: 'Water', color: C.water, v: past ? water(t, sc).flow * TARIFF.water : 0 },
          { name: 'Gas', color: C.gas, v: past ? gas(t, sc).flow * TARIFF.gas : 0 }] } })
    }
    const de = dailyTotals('e' + skey, t => electricity(t, sc).kw, now, days), dw = dailyTotals('w' + skey, t => water(t, sc).flow, now, days), dg = dailyTotals('g' + skey, t => gas(t, sc).flow, now, days)
    return de.map((d, i) => { const dd = new Date(d.t); return { label: days === 7 ? dd.toLocaleDateString('en-GB', { weekday: 'short' }) : String(dd.getDate()), full: dd.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }), parts: [
      { name: 'Electricity', color: C.elec, v: d.v * TARIFF.kwh }, { name: 'Water', color: C.water, v: dw[i].v * TARIFF.water }, { name: 'Gas', color: C.gas, v: dg[i].v * TARIFF.gas }] } })
  }, [period, days === 1 ? key : Math.floor(now / 3600000), skey])
  const periodTotal = daily.reduce((a, d) => a + d.parts.reduce((b, p) => b + p.v, 0), 0)

  const act = activeAlarms(useStore(s => s.alarms))
  const nAl = (k) => act.filter(a => a.sys === k).length
  const src = [
    { id: 'elec', name: 'Electricity', icon: 'elec', now: fmt(e.kw, 0), unit: 'kW', today: `${fmtK(today.kwh)} kWh`, cost: cost.elec, spark: trend.e, color: C.elec, extra: `PV ${fmt(e.pv, 0)} kW · PF ${fmt(e.pf, 2)}`, al: nAl('elec') },
    { id: 'water', name: 'Water', icon: 'water', now: fmt(w.flow, 2), unit: 'm³/h', today: `${fmt(today.m3w, 0)} m³`, cost: cost.water, spark: trend.w, color: C.water, extra: `${fmt(w.pressure, 2)} bar · roof tank ${fmt(w.tanks['TANK-RF-01'], 0)} %`, al: nAl('water') },
    { id: 'gas', name: 'Gas', icon: 'gas', now: fmt(g.flow, 2), unit: 'm³/h', today: `${fmt(today.m3g, 0)} m³`, cost: cost.gas, spark: trend.g, color: C.gas, extra: `${fmt(g.pressure, 1)} mbar · max ${fmt(Math.max(...Object.values(g.lel)), 1)} % LEL`, al: nAl('gas') },
  ]
  const floors = [...LEVELS].reverse()

  return (
    <div className="mod">
      <div className="cols">
        <div className="col left">
          <Panel title="Energy today" sub="midnight → now">
            <div className="kgrid k3">
              <Kpi label="Total cost" value={fmtK(costAll)} unit="EGP" color="#c98a2e" />
              <Kpi label="Carbon" value={fmt(co2, 2)} unit="t CO₂" sub="elec + gas" />
              <Kpi label="Solar share" value={fmt(e.pv / Math.max(1, e.kw) * 100, 0)} unit="%" color="#5f8a52" sub={`${fmt(e.pv, 0)} kW now`} />
              <Kpi label="Electricity" value={fmtK(today.kwh)} unit="kWh" onClick={() => go('elec')} />
              <Kpi label="Water" value={fmt(today.m3w, 0)} unit="m³" onClick={() => go('water')} />
              <Kpi label="Gas" value={fmt(today.m3g, 0)} unit="m³" onClick={() => go('gas')} />
            </div>
          </Panel>
          <Panel title="Utilities" sub="click to open" className="grow" src={false}>
            <div className="util-cards">{src.map(s => (
              <button key={s.id} className="util-card" onClick={() => go(s.id)} style={{ '--uc': s.color }}>
                <div className="uc-h"><Icon n={s.icon} s={16} c={s.color} /><b>{s.name}</b>{s.al > 0 ? <em>{s.al} alarm{s.al > 1 ? 's' : ''}</em> : <i>Normal</i>}<Icon n="chev" s={14} /></div>
                <div className="uc-v"><strong>{animate(s.now)}<small>{s.unit}</small></strong><Spark data={s.spark} color={s.color} w={120} h={30} /></div>
                <div className="uc-f"><span>Today {s.today}</span><span>{fmtK(s.cost)} EGP</span></div>
                <div className="uc-x">{s.extra}</div>
              </button>))}</div>
          </Panel>
        </div>

        <div className="col center">
          <Panel title="Utility cost" sub={`${fmtK(periodTotal)} EGP in period`} right={<Seg small value={period} options={[['24h', 'Today'], ['7d', '7 days'], ['30d', '30 days']]} onChange={setPeriod} />}>
            <Bars h={240} stacked data={daily} unit="EGP" />
            <div className="legend-inline">{[['Electricity', C.elec], ['Water', C.water], ['Gas', C.gas]].map(([n, c]) => <span key={n}><i style={{ background: c }} />{n}</span>)}</div>
          </Panel>
          <Panel title="Electricity demand" sub="last 24 h">
            <LineChart h={170} unit="kW" series={[{ name: 'Load', color: C.elec, data: trend.e, area: true }]} refLine={{ v: 1500, label: 'Contracted 1,500 kW' }} />
          </Panel>
          <div className="pair">
            <Panel title="Water flow" sub="last 24 h"><LineChart h={150} unit="m³/h" digits={1} series={[{ name: 'Flow', color: C.water, data: trend.w, area: true }]} /></Panel>
            <Panel title="Gas flow" sub="last 24 h"><LineChart h={150} unit="m³/h" digits={1} series={[{ name: 'Flow', color: C.gas, data: trend.g, area: true }]} /></Panel>
          </div>
        </div>

        <div className="col right">
          <Panel title="Cost share today">
            <div className="donut-row">
              <Donut size={120} center={fmtK(costAll)} sub="EGP" parts={[{ v: cost.elec, color: C.elec }, { v: cost.water, color: C.water }, { v: cost.gas, color: C.gas }]} />
              <div className="dl">{[['Electricity', cost.elec, C.elec, `${TARIFF.kwh} EGP/kWh`], ['Water', cost.water, C.water, `${TARIFF.water} EGP/m³`], ['Gas', cost.gas, C.gas, `${TARIFF.gas} EGP/m³`]].map(([n, v, c, t]) =>
                <div key={n}><i style={{ background: c }} /><span>{n}<small>{t}</small></span><b>{fmt(v / costAll * 100, 0)} %</b></div>)}</div>
            </div>
          </Panel>
          <Panel title="Floor-by-floor" sub="now · click a floor">
            <table className="ftbl"><thead><tr><th>Floor</th><th>kW</th><th>m³/h</th><th>Gas</th></tr></thead>
              <tbody>{floors.map(L => <tr key={L.id} className="click" onClick={() => { setLevel(L.id); go('elec', { level: L.id }) }}>
                <td><b>{L.id}</b> <small>{L.use}</small></td><td>{fmt(e.floors[L.id], 0)}</td><td>{fmt(w.floors[L.id] ?? 0, 2)}</td>
                <td>{L.id === 'GF' ? fmt(g.kitchen, 1) : L.id === 'RF' ? fmt(g.boiler, 1) : '—'}</td></tr>)}</tbody></table>
          </Panel>
          <Panel title="Energy alarms" src={false} className="grow"><AlarmList sys={['elec', 'water', 'gas']} limit={6} compact empty="No energy alarms" /></Panel>
        </div>
      </div>
    </div>
  )
}
