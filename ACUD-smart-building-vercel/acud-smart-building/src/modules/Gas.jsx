import { useState, useMemo } from 'react'
import { useStore } from '../data/store'
import { DEVICES, DEV, SYSTEMS } from '../data/building'
import { useSnap, fmt, fmtK } from '../data/util'
import { gas, TARIFF, series } from '../data/sim'
import { Panel, Kpi, AlarmList, Seg, Pill } from '../components/UI'
import { LineChart, Bars, Donut, Meter } from '../components/Charts'
import { usePeriod, Pipe, Box } from './energyCommon'
import Twin from '../twin/LazyTwin'

const C = SYSTEMS.gas.color
export default function Gas() {
  const snap = useSnap(), st = useStore(), g = snap.gas, sc = snap.sc
  const [period, setPeriod] = useState('24h')
  const [confirm, setConfirm] = useState(null)
  const bars = usePeriod('gas', t => gas(t, sc).flow, snap.now, sc, period)
  const total = bars.reduce((a, b) => a + b.v, 0)
  const day = useMemo(() => ({ k: series(t => gas(t, sc).kitchen, snap.now, 24, 15), b: series(t => gas(t, sc).boiler, snap.now, 24, 15) }), [Math.floor(snap.now / 120000), JSON.stringify(sc)])
  const esv = (id) => st.esv[id] || 'open'
  const mainOpen = esv('ESV-B1-01') === 'open', kOpen = mainOpen && esv('ESV-GF-01') === 'open', bOpen = mainOpen && esv('ESV-RF-01') === 'open'
  const kitchen = kOpen ? g.kitchen : 0, boiler = bOpen ? g.boiler : 0
  const dets = DEVICES.filter(d => d.type === 'gdet')
  const lelOf = (d) => /CO/.test(d.name) ? null : d.level === 'GF' ? g.lel.kitchen * (d.id.endsWith('02') ? 0.45 : 1) : d.level === 'RF' ? g.lel.boiler : g.lel.meter
  const maxLel = Math.max(...dets.map(lelOf).filter(v => v != null))
  const valves = ['ESV-B1-01', 'ESV-GF-01', 'ESV-RF-01']
  const doValve = (id) => { if (esv(id) === 'open') setConfirm(id); else st.setEsv(id, 'open') }
  return (
    <div className="mod">
      <div className="cols">
        <div className="col left">
          <Panel title="Gas supply">
            <div className="kgrid k3">
              <Kpi label="Flow now" value={fmt(kitchen + boiler, 2)} unit="m³/h" color={C} />
              <Kpi label={period === '24h' ? 'Today' : period === '7d' ? '7 days' : '30 days'} value={fmt(total, 0)} unit="m³" />
              <Kpi label="Distribution" value={fmt(g.pressure, 1)} unit="mbar" color={g.pressure < 19 ? '#d08a1e' : null} />
              <Kpi label="Inlet (PRMS)" value={fmt(g.inlet, 2)} unit="bar" />
              <Kpi label="Max gas level" value={fmt(maxLel, 1)} unit="% LEL" color={maxLel > 20 ? '#c4553f' : maxLel > 10 ? '#d08a1e' : '#5f8a52'} />
              <Kpi label="Cost" value={fmtK(total * TARIFF.gas)} unit="EGP" sub={`${TARIFF.gas} EGP/m³`} />
            </div>
          </Panel>
          <Panel title="Emergency shut-off valves">
            {valves.map(id => <div key={id} className={'valve' + (esv(id) === 'closed' ? ' closed' : '')} onClick={() => st.selectDevice(id)}>
              <svg width="30" height="30" viewBox="0 0 30 30"><path d="M3 8 L15 15 L3 22Z M27 8 L15 15 L27 22Z" fill={esv(id) === 'open' ? '#5f8a52' : '#c4553f'} /><line x1="15" y1="15" x2="15" y2="4" stroke="#6b645a" strokeWidth="2" /><rect x="9" y="2" width="12" height="3" rx="1" fill="#6b645a" /></svg>
              <div><b>{DEV[id].name}</b><span>{esv(id) === 'open' ? 'OPEN · solenoid energised' : 'CLOSED · manual reset required'}</span></div>
              <button className={esv(id) === 'open' ? 'danger' : ''} onClick={e => { e.stopPropagation(); doValve(id) }}>{esv(id) === 'open' ? 'Close' : 'Open'}</button>
            </div>)}
            {confirm && <div className="confirm"><b>Close {DEV[confirm].name}?</b><span>This cuts gas to {confirm === 'ESV-B1-01' ? 'the whole building' : confirm === 'ESV-GF-01' ? 'the kitchen' : 'the boilers'}.</span>
              <div><button onClick={() => setConfirm(null)}>Cancel</button><button className="danger" onClick={() => { st.setEsv(confirm, 'closed'); setConfirm(null) }}>Close valve</button></div></div>}
          </Panel>
          <Panel title="Gas detectors" className="grow">
            <div className="dets">{dets.map(d => { const v = lelOf(d); return <div key={d.id} onClick={() => st.selectDevice(d.id)} className={st.device === d.id ? 'on' : ''}>
              <b>{d.level} · {d.room}</b><span>{v == null ? `${fmt(g.co, 0)} ppm CO` : `${fmt(v, 1)} % LEL`}</span>
              <Meter v={v == null ? g.co : v} max={v == null ? 100 : 50} warn={v == null ? 35 : 10} crit={v == null ? 50 : 20} color="#5f8a52" /></div> })}</div>
          </Panel>
        </div>
        <div className="col center split">
          <div className="wall-h"><b>Gas distribution</b><span>utility main → PRMS → main meter → ESV → consumers</span></div>
          <div className="sld">
            <svg viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid meet">
              <Box x={80} y={200} w={130} title="Utility main" sub="1 bar · natural gas" />
              <Pipe d="M145,200 L200,200" color={C} on={mainOpen} />
              <Box x={250} y={200} w={100} title="PRMS" sub={`${fmt(g.inlet, 2)} → 0.021 bar`} />
              <Pipe d="M300,200 L345,200" color={C} on={mainOpen} />
              <Box x={395} y={200} w={100} title="GM-1 main" sub={`${fmt(kitchen + boiler, 2)} m³/h`} onClick={() => st.selectDevice('GMETER-B1-01')} sel={st.device === 'GMETER-B1-01'} />
              <Pipe d="M445,200 L490,200" color={C} on={mainOpen} />
              <Box x={540} y={200} w={100} title="ESV-1" sub={esv('ESV-B1-01').toUpperCase()} state={mainOpen ? 'ok' : 'alarm'} onClick={() => doValve('ESV-B1-01')} sel={st.device === 'ESV-B1-01'} />
              <Pipe d="M590,200 L630,200 L630,100 L670,100 M630,200 L630,300 L670,300" color={C} on={mainOpen} />
              <Box x={720} y={100} w={100} title="ESV-2" sub={esv('ESV-GF-01').toUpperCase()} state={esv('ESV-GF-01') === 'open' ? 'ok' : 'alarm'} onClick={() => doValve('ESV-GF-01')} />
              <Pipe d="M770,100 L810,100" color={C} on={kOpen} />
              <Box x={880} y={100} w={130} title="Kitchen (GF)" sub={`${fmt(kitchen, 2)} m³/h · GM-2`} state={sc.gasLeak ? 'alarm' : 'ok'} onClick={() => st.selectDevice('BURNER-GF-01')} sel={st.device === 'BURNER-GF-01'} />
              <Box x={720} y={300} w={100} title="ESV-3" sub={esv('ESV-RF-01').toUpperCase()} state={esv('ESV-RF-01') === 'open' ? 'ok' : 'alarm'} onClick={() => doValve('ESV-RF-01')} />
              <Pipe d="M770,300 L810,300" color={C} on={bOpen} />
              <Box x={880} y={300} w={130} title="Boilers B-1/B-2 (RF)" sub={`${fmt(boiler, 2)} m³/h · GM-3`} onClick={() => st.selectDevice('BOILER-RF-01')} sel={st.device === 'BOILER-RF-01'} />
              {sc.gasLeak && <g><rect x={640} y={20} width={340} height={40} rx={8} fill="#f6ddd6" stroke="#c4553f" /><text x={654} y={45} className="bt" fill="#c4553f">GAS LEAK · kitchen {fmt(g.lel.kitchen, 0)} % LEL · ESV-2 tripped</text></g>}
            </svg>
          </div>
          <div className="wall-twin"><Twin layer="gas" compact /></div>
        </div>
        <div className="col right">
          <Panel title="Consumption trends" right={<Seg small value={period} options={[['24h', 'Day'], ['7d', 'Week'], ['30d', 'Month']]} onChange={setPeriod} />}>
            <Bars h={110} data={bars} unit={period === '24h' ? 'm³' : 'm³/day'} digits={1} color={C} />
            <LineChart h={110} unit="m³/h" digits={2} series={[{ name: 'Kitchen', color: C, data: day.k, area: true }, { name: 'Boilers', color: '#8a8073', data: day.b }]} />
          </Panel>
          <Panel title="Cost analytics">
            <div className="row-c">
              <Donut size={100} parts={[{ v: day.k.reduce((a, b) => a + b.v, 0), color: C }, { v: day.b.reduce((a, b) => a + b.v, 0), color: '#8a8073' }]} center={fmtK(total * TARIFF.gas)} sub="EGP" />
              <div className="lg-v col"><span><i style={{ background: C }} />Kitchen<b>{fmt(day.k.reduce((a, b) => a + b.v, 0) / 4, 0)} m³</b></span><span><i style={{ background: '#8a8073' }} />Boilers (DHW)<b>{fmt(day.b.reduce((a, b) => a + b.v, 0) / 4, 0)} m³</b></span><span>Tariff<b>{TARIFF.gas} EGP/m³</b></span></div>
            </div>
          </Panel>
          <Panel title="Safety monitoring" src={false}>
            <div className="hist">
              <div><span>Last leak test</span><Pill s="ok">Pass</Pill><b>Tightness test 21 mbar · 15 min</b><em>12 d</em></div>
              <div><span>ESV stroke test</span><Pill s="ok">Pass</Pill><b>All 3 valves closed in &lt; 1 s</b><em>30 d</em></div>
              <div><span>Detector calibration</span><Pill s="warn">Due</Pill><b>Kitchen GD-1/GD-2 bump test</b><em>in 6 d</em></div>
            </div>
          </Panel>
          <Panel title="Gas alarms" src={false}><AlarmList sys="gas" limit={5} compact empty="No gas alarms" /></Panel>
        </div>
      </div>
    </div>
  )
}
