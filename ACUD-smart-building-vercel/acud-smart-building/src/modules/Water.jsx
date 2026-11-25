import { useState, useMemo } from 'react'
import { useStore } from '../data/store'
import { LEVELS, DEVICES, DEV, SYSTEMS } from '../data/building'
import { useSnap, fmt, STATUS } from '../data/util'
import { water, TARIFF, series, hash, hstr } from '../data/sim'
import { Panel, Kpi, AlarmList, Seg, Pill } from '../components/UI'
import { LineChart, Bars } from '../components/Charts'
import { usePeriod, Pipe, Box } from './energyCommon'
import Twin from '../twin/LazyTwin'

const C = SYSTEMS.water.color
const PUMPS = DEVICES.filter(d => d.type === 'pump')
function Tank({ x, y, w = 90, h = 110, level, title, cap, onClick, sel }) {
  const fh = (h - 8) * level / 100
  return <g className={'tank click' + (sel ? ' sel' : '')} transform={`translate(${x - w / 2},${y - h / 2})`} onClick={onClick}>
    <rect width={w} height={h} rx={10} className="tk" />
    <rect x={4} y={h - 4 - fh} width={w - 8} height={fh} rx={6} fill={C} opacity={0.75} className="fill" />
    <text x={w / 2} y={h / 2 + 4} textAnchor="middle" className="tv">{fmt(level, 0)}%</text>
    <text x={w / 2} y={-22} textAnchor="middle" className="bt">{title}</text>
    <text x={w / 2} y={-8} textAnchor="middle" className="bs">{fmt(cap * level / 100, 0)} / {cap} m³</text>
  </g>
}

export default function Water() {
  const snap = useSnap(), st = useStore(), w = snap.water, sc = snap.sc
  const [period, setPeriod] = useState('24h')
  const bars = usePeriod('water', t => water(t, sc).flow, snap.now, sc, period)
  const total = bars.reduce((a, b) => a + b.v, 0)
  const day = useMemo(() => series(t => water(t, sc).flow, snap.now, 24, 15), [Math.floor(snap.now / 120000), JSON.stringify(sc)])
  const pdy = useMemo(() => series(t => water(t, sc).pressure, snap.now, 24, 15), [Math.floor(snap.now / 120000), JSON.stringify(sc)])
  const leaks = DEVICES.filter(d => d.type === 'leak')
  const wet = leaks.filter(d => st.status[d.id] === 'alarm')
  const pumpState = (id) => st.pumps[id] === 'off' ? 'off' : st.status[id] === 'maint' ? 'maint' : w.pumps[id]
  const lv = st.level
  const hours = (id) => Math.floor(4200 + 9000 * hash(hstr(id)))
  const floors = [...LEVELS].filter(L => L.id !== 'RF').reverse()
  return (
    <div className="mod">
      <div className="cols">
        <div className="col left">
          <Panel title="Water supply">
            <div className="kgrid k3">
              <Kpi label="Flow now" value={fmt(w.flow, 2)} unit="m³/h" color={C} />
              <Kpi label={period === '24h' ? 'Today' : period === '7d' ? '7 days' : '30 days'} value={fmt(total, 0)} unit="m³" />
              <Kpi label="Network pressure" value={fmt(w.pressure, 2)} unit="bar" color={w.pressure < 3.2 ? '#d08a1e' : null} />
              <Kpi label="City supply" value={fmt(w.supplyP, 2)} unit="bar" />
              <Kpi label="Leak sensors" value={wet.length ? `${wet.length} WET` : 'Dry'} color={wet.length ? '#c4553f' : '#5f8a52'} sub={`${leaks.length} sensors`} />
              <Kpi label="Cost" value={fmt(total * TARIFF.water, 0)} unit="EGP" sub={`${TARIFF.water} EGP/m³`} />
            </div>
          </Panel>
          <Panel title="Pumping stations" className="grow">
            <div className="pumps">{PUMPS.map(p => { const s = pumpState(p.id)
              return <div key={p.id} className={'pmp' + (st.device === p.id ? ' on' : '')} onClick={() => st.selectDevice(p.id)}>
                <i className={s === 'run' ? 'spin' : ''} style={{ borderColor: s === 'run' ? '#5f8a52' : s === 'maint' ? '#7c78a8' : '#bdb3a5' }} />
                <div><b>{p.name}</b><span>{s === 'run' ? 'Running' : s === 'standby' ? 'Standby (auto)' : s === 'off' ? 'Off — manual' : 'Maintenance'} · {fmt(hours(p.id))} h run</span></div>
                <Seg small value={st.pumps[p.id] === 'off' ? 'Off' : 'Auto'} options={['Auto', 'Off']} onChange={v => st.setPump(p.id, v === 'Off' ? 'off' : 'auto')} />
              </div> })}</div>
          </Panel>
        </div>
        <div className="col center split">
          <div className="wall-h"><b>Water distribution</b><span>city main → ground tanks → transfer pumps → roof tank → floors</span></div>
          <div className="sld">
            <svg viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid meet">
              <Box x={80} y={330} w={130} title="City main" sub={`${fmt(w.supplyP, 2)} bar`} />
              <Pipe d="M145,330 L200,330" color={C} />
              <Box x={250} y={330} w={100} title="WM-0" sub={`${fmt(w.flow * 1.05, 1)} m³/h`} onClick={() => st.selectDevice('WMETER-B1-02')} sel={st.device === 'WMETER-B1-02'} />
              <Pipe d="M300,330 L330,330 L330,345 L520,345 L520,285 M400,345 L400,285" color={C} />
              <Tank x={400} y={230} level={w.tanks['TANK-B1-01']} title="GT-1 domestic" cap={250} onClick={() => st.selectDevice('TANK-B1-01')} sel={st.device === 'TANK-B1-01'} />
              <Tank x={520} y={245} w={80} h={80} level={w.tanks['TANK-B1-02']} title="GT-2 fire" cap={300} onClick={() => st.selectDevice('TANK-B1-02')} sel={st.device === 'TANK-B1-02'} />
              <Pipe d="M445,200 L465,200 L465,150 L604,150" color={C} on={pumpState('PUMP-B1-01') === 'run'} />
              <Box x={650} y={150} w={92} title="TP-1/2" sub={pumpState('PUMP-B1-01') === 'run' ? 'running' : 'standby'} state={pumpState('PUMP-B1-01') === 'run' ? 'run' : 'ok'} onClick={() => st.selectDevice('PUMP-B1-01')} sel={st.device === 'PUMP-B1-01'} />
               <Pipe d="M696,150 L720,150 L720,70 L775,70" color={C} on={pumpState('PUMP-B1-01') === 'run'} />
              <Tank x={815} y={70} w={80} h={70} level={w.tanks['TANK-RF-01']} title="RT-1 roof" cap={60} onClick={() => st.selectDevice('TANK-RF-01')} sel={st.device === 'TANK-RF-01'} />
              <Pipe d="M855,90 L900,90 L900,360" color={C} speed={1.2} />
              {floors.map((L, i) => { const y = 120 + i * 36, q = w.floors[L.id], wetF = wet.some(d => d.level === L.id)
                return <g key={L.id} className="click" onClick={() => st.setLevel(lv === L.id ? null : L.id)}>
                  <Pipe d={`M900,${y} L940,${y}`} color={wetF ? '#c4553f' : C} w={1.5 + q} />
                  <rect x={942} y={y - 13} width={54} height={26} rx={6} className={'fl' + (lv === L.id ? ' sel' : '') + (wetF ? ' wet' : '')} />
                  <text x={969} y={y - 1} textAnchor="middle" className="bt">{L.id}</text><text x={969} y={y + 10} textAnchor="middle" className="bs">{fmt(q, 1)}</text>
                </g> })}
              <Box x={650} y={300} w={110} title="Booster BP-1" sub={`${fmt(w.pressure, 1)} bar`} state={pumpState('PUMP-B1-03') === 'run' ? 'run' : 'ok'} onClick={() => st.selectDevice('PUMP-B1-03')} sel={st.device === 'PUMP-B1-03'} />
              <Pipe d="M445,265 L462,265 L462,300 L595,300" color={C} /><Pipe d="M705,300 L900,300" color={C} />
              {wet.length > 0 && <g><rect x={20} y={20} width={300} height={40} rx={8} fill="#f6ddd6" stroke="#c4553f" /><text x={34} y={45} className="bt" fill="#c4553f">LEAK: {wet.map(d => `${d.level} ${d.room}`).join(', ')} · +{fmt(w.leakFlow, 1)} m³/h</text></g>}
            </svg>
          </div>
          <div className="wall-twin"><Twin layer="water" compact /></div>
        </div>
        <div className="col right">
          <Panel title="Consumption analytics" right={<Seg small value={period} options={[['24h', 'Daily'], ['7d', 'Weekly'], ['30d', 'Monthly']]} onChange={setPeriod} />}>
            <Bars h={120} data={bars} unit={period === '24h' ? 'm³' : 'm³/day'} digits={1} color={C} />
            <LineChart h={100} unit="m³/h" digits={2} series={[{ name: 'Flow', color: C, data: day, area: true }]} />
            <LineChart h={70} unit="bar" digits={2} yMin={2.5} yMax={4.2} series={[{ name: 'Pressure', color: '#8a8073', data: pdy }]} band={[3.2, 4.0]} />
          </Panel>
          <Panel title="Floor-by-floor" sub="m³/h now · click to isolate">
            <Bars h={100} data={LEVELS.map(L => ({ label: L.id, full: L.name, v: w.floors[L.id] }))} unit="m³/h" digits={2} color={C} active={lv} onClick={d => st.setLevel(lv === d.label ? null : d.label)} />
          </Panel>
          <Panel title="Leak detection">
            <div className="crah">{leaks.map(d => <button key={d.id} onClick={() => st.selectDevice(d.id)}><i style={{ background: st.status[d.id] === 'alarm' ? '#c4553f' : '#5f8a52' }} /><b>{d.level} · {d.room}</b><span>{st.status[d.id] === 'alarm' ? 'WET' : 'dry'}</span></button>)}</div>
          </Panel>
          <Panel title="Water alarms" src={false}><AlarmList sys="water" limit={5} compact /></Panel>
        </div>
      </div>
    </div>
  )
}
