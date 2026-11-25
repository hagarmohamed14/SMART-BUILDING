import { useState, useMemo } from 'react'
import { useStore } from '../data/store'
import { LEVELS, SYSTEMS } from '../data/building'
import { useSnap, fmt, fmtK, STATUS } from '../data/util'
import { electricity, TARIFF, hourOf, series } from '../data/sim'
import { Panel, Kpi, AlarmList, Seg } from '../components/UI'
import { LineChart, Bars, Gauge, Donut } from '../components/Charts'
import { usePeriod, Pipe, Box } from './energyCommon'
import Twin from '../twin/LazyTwin'

const C = SYSTEMS.elec.color
const CONTRACT = 1500
export default function Electricity() {
  const snap = useSnap(), st = useStore(), e = snap.elec, sc = snap.sc
  const [period, setPeriod] = useState('24h')
  const day = useMemo(() => series(t => electricity(t, sc).kw, snap.now, 24, 15), [Math.floor(snap.now / 120000), JSON.stringify(sc)])
  const pvDay = useMemo(() => series(t => electricity(t, sc).pv, snap.now, 24, 15), [Math.floor(snap.now / 120000), JSON.stringify(sc)])
  const bars = usePeriod('elec', t => electricity(t, sc).kw, snap.now, sc, period)
  const total = bars.reduce((a, b) => a + b.v, 0)
  const peak = day.reduce((m, p) => p.v > m.v ? p : m, day[0])
  const peakShare = 0.38
  const cost = total * (TARIFF.kwh * (1 - peakShare) + TARIFF.peakKwh * peakShare) + (period === '24h' ? 0 : peak.v * TARIFF.demand * (period === '7d' ? 7 : 30) / 30)
  const lv = st.level
  const pf = (k) => (k ? 'ok' : 'alarm')
  const feeders = LEVELS.map((L, i) => ({ L, x: 70 + i * 122 }))
  const onFloor = (id) => st.setLevel(lv === id ? null : id)
  return (
    <div className="mod">
      <div className="cols">
        <div className="col left">
          <Panel title="Main incomer" sub="22 kV utility · 2 × 1600 kVA">
            <div className="kgrid k4">
              <Kpi label="Active P" value={fmt(e.kw, 0)} unit="kW" color={C} />
              <Kpi label="Reactive Q" value={fmt(e.kvar, 0)} unit="kvar" />
              <Kpi label="Apparent S" value={fmt(e.kva, 0)} unit="kVA" />
              <Kpi label="Power factor" value={fmt(e.pf, 3)} color={e.pf < 0.92 ? '#d08a1e' : null} />
              <Kpi label="Voltage L-L" value={fmt(e.v, 0)} unit="V" color={sc.powerFail ? '#c4553f' : null} />
              <Kpi label="Current" value={fmt(e.i, 0)} unit="A" />
              <Kpi label="Frequency" value={fmt(e.hz, 2)} unit="Hz" />
              <Kpi label="PV solar" value={fmt(e.pv, 0)} unit="kW" color="#6f8f5a" />
            </div>
          </Panel>
          <Panel title="Power quality">
            <div className="hrow">
              <Gauge v={e.thd} max={10} unit="% THD-V" label="Harmonics" size={86} warn={5} crit={8} color={C} digits={1} />
              <Gauge v={e.unbalance} max={5} unit="%" label="V unbalance" size={86} warn={2} crit={3} color={C} digits={1} />
              <Gauge v={e.pf * 100} unit="%" label="PF" size={86} color="#5f8a52" digits={1} />
            </div>
            <div className="mini-t"><span>Sags (24 h): {sc.powerFail ? 1 : 0}</span><span>Swells: 0</span><span>Flicker Pst 0.42</span><span>Cap bank: 5/6 stages</span></div>
          </Panel>
          <Panel title="Transformers & sources">
            <div className="hrow">
              <button onClick={() => st.selectDevice('TRANSFORMER-B1-01')}><Gauge v={e.tx1} unit="%" label="TR-1 load" size={86} warn={75} crit={90} color={C} /></button>
              <button onClick={() => st.selectDevice('TRANSFORMER-B1-02')}><Gauge v={e.tx2} unit="%" label="TR-2 load" size={86} warn={75} crit={90} color={C} /></button>
              <Donut size={92} parts={[{ v: e.grid, color: C }, { v: e.pv, color: '#6f8f5a' }, { v: e.gen, color: '#c4553f' }]} center={fmt(e.pv / e.kw * 100, 0) + '%'} sub="solar share" />
            </div>
            <div className="mini-t"><span>Generator G-1: {sc.powerFail ? 'ON LOAD' : 'standby · fuel 86%'}</span><span>UPS: {sc.powerFail ? 'on battery' : 'online'}</span></div>
          </Panel>
        </div>
        <div className="col center split">
          <div className="wall-h"><b>Single-line diagram</b><span>click a feeder to isolate the floor on the model</span></div>
          <div className="sld">
            <svg viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid meet">
              <Box x={500} y={30} w={170} title="Utility 22 kV" sub={sc.powerFail ? 'LOST' : `${fmt(e.grid, 0)} kW import`} state={sc.powerFail ? 'alarm' : 'ok'} />
              <Pipe d="M500,53 L500,80 M500,80 L330,80 L330,110 M500,80 L670,80 L670,110" color={C} on={!sc.powerFail} />
              <Box x={330} y={130} w={150} title="TR-1 1600 kVA" sub={`${fmt(e.tx1, 0)} % · 22/0.4 kV`} state={sc.powerFail ? 'alarm' : e.tx1 > 75 ? 'warn' : 'ok'} onClick={() => st.selectDevice('TRANSFORMER-B1-01')} sel={st.device === 'TRANSFORMER-B1-01'} />
              <Box x={670} y={130} w={150} title="TR-2 1600 kVA" sub={`${fmt(e.tx2, 0)} % · 22/0.4 kV`} state={sc.powerFail ? 'alarm' : 'ok'} onClick={() => st.selectDevice('TRANSFORMER-B1-02')} sel={st.device === 'TRANSFORMER-B1-02'} />
              <Box x={110} y={130} w={150} title="Generator G-1" sub={sc.powerFail ? `${fmt(e.gen, 0)} kW · ON LOAD` : 'Standby · auto'} state={sc.powerFail ? 'warn' : 'ok'} onClick={() => st.selectDevice('GENERATOR-B1-01')} sel={st.device === 'GENERATOR-B1-01'} />
              <Box x={890} y={130} w={150} title="PV inverter 180 kWp" sub={`${fmt(e.pv, 0)} kW`} state={e.pv > 1 ? 'ok' : 'off'} onClick={() => st.selectDevice('PV-RF-01')} sel={st.device === 'PV-RF-01'} />
              <Pipe d="M330,153 L330,200" color={C} on={!sc.powerFail} /><Pipe d="M670,153 L670,200" color={C} on={!sc.powerFail} />
              <Pipe d="M110,153 L110,185 L250,185 L250,200" color="#c4553f" on={!!sc.powerFail} /><Pipe d="M890,153 L890,185 L760,185 L760,200" color="#6f8f5a" on={e.pv > 1} />
              <text x={180} y={180} className="bs">ATS</text>
              <rect x={40} y={200} width={920} height={10} rx={3} className="bus" /><text x={46} y={226} className="bs">MDB-1 / MDB-2 · 400 V busbar · coupler closed</text>
              {feeders.map(({ L, x }) => { const kw = e.floors[L.id]; const sel = lv === L.id
                return <g key={L.id} onClick={() => onFloor(L.id)} className="click">
                  <Pipe d={`M${x},210 L${x},300`} color={C} on={!sc.powerFail || ['L1', 'GF', 'B1'].includes(L.id)} w={1.5 + kw / 90} />
                  <Box x={x} y={330} w={104} h={50} title={`SMDB-${L.id}`} sub={`${fmt(kw, 0)} kW`} sel={sel} state={sc.powerFail && !['L1', 'GF', 'B1'].includes(L.id) ? 'off' : 'ok'} />
                  <text x={x} y={375} textAnchor="middle" className="bs">{L.use.split(' ·')[0]}</text>
                </g> })}
            </svg>
          </div>
          <div className="wall-twin"><Twin layer="elec" compact /></div>
        </div>
        <div className="col right">
          <Panel title="Load profile & peak demand" sub="last 24 h">
            <LineChart h={130} unit="kW" series={[{ name: 'Load', color: C, data: day, area: true }, { name: 'PV', color: '#6f8f5a', data: pvDay }]} refLine={{ v: CONTRACT, label: `Contracted ${fmt(CONTRACT)} kW` }} />
            <div className="mini-t"><span>Peak {fmt(peak.v, 0)} kW at {new Date(peak.t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span><span>Load factor {fmt(day.reduce((a, b) => a + b.v, 0) / day.length / peak.v * 100, 0)}%</span><span>Headroom {fmt(CONTRACT - peak.v, 0)} kW</span></div>
          </Panel>
          <Panel title="Consumption & cost" right={<Seg small value={period} options={[['24h', 'Day'], ['7d', 'Week'], ['30d', 'Month']]} onChange={setPeriod} />}>
            <div className="kgrid k3"><Kpi label="Energy" value={fmtK(total)} unit="kWh" /><Kpi label="Cost" value={fmtK(cost)} unit="EGP" sub={`${TARIFF.kwh}/${TARIFF.peakKwh} EGP/kWh`} /><Kpi label="CO₂" value={fmt(total * 0.47 / 1000, 1)} unit="t" sub="0.47 kg/kWh" /></div>
            <Bars h={110} data={bars} unit={period === '24h' ? 'kWh' : 'kWh/day'} color={C} />
          </Panel>
          <Panel title="Floor-by-floor" sub="now · click to isolate">
            <Bars h={110} data={LEVELS.map(L => ({ label: L.id, full: `${L.name} · ${L.use}`, v: e.floors[L.id] }))} unit="kW" color={C} active={lv} onClick={d => onFloor(d.label)} />
          </Panel>
          <Panel title="Electrical alarms" src={false}><AlarmList sys="elec" limit={5} compact /></Panel>
        </div>
      </div>
    </div>
  )
}
