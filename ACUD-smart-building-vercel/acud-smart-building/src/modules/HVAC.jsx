import { animate } from '../components/Anim'
// HVAC — chillers, cooling towers, AHUs, VAV / FCU terminals, setpoints and automatic plant control.
// All values come from the shared engine (sim.hvac + climate) so the plant, the floors and the twin agree.
import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { LEVELS, LEVEL, DEV, DEVICES } from '../data/building'
import { useSnap, fmt } from '../data/util'
import { hvac, climate, series, CH_CAP } from '../data/sim'
import { Panel, Kpi, AlarmList, Seg, Pill } from '../components/UI'
import { LineChart, Gauge, Meter } from '../components/Charts'
import Icon from '../components/Icons'
import Twin from '../twin/LazyTwin'

const CH = ['CHILLER-RF-01', 'CHILLER-RF-02'], CT = ['TOWER-RF-01', 'TOWER-RF-02'], AHU = ['AHU-RF-01', 'AHU-RF-02', 'AHU-RF-03']
const ZONES = LEVELS.filter(L => !['RF', 'B1'].includes(L.id))
const HVAC_DEV = new Set([...CH, ...CT, ...AHU, ...DEVICES.filter(d => d.type === 'fcu').map(d => d.id)])

export default function HVAC() {
  const snap = useSnap(), st = useStore(), plant = useStore(s => s.plant)
  const H = snap.hvac, auto = plant.auto !== false
  const [lv, setLv] = useState('L3'), [view, setView] = useState('plant')
  const key = Math.floor(snap.now / 120000), skey = JSON.stringify(snap.sc) + JSON.stringify(st.setpoints) + JSON.stringify(plant)
  const hist = useMemo(() => ({
    load: series(t => hvac(t, snap.sc, st.setpoints, plant).load, snap.now, 24, 20),
    cap: series(t => hvac(t, snap.sc, st.setpoints, plant).cap, snap.now, 24, 20),
    chws: series(t => hvac(t, snap.sc, st.setpoints, plant).chws, snap.now, 24, 20),
    chwr: series(t => hvac(t, snap.sc, st.setpoints, plant).chwr, snap.now, 24, 20),
    zt: series(t => climate(t, st.setpoints, snap.sc)[lv].temp, snap.now, 24, 20),
    zsp: series(t => climate(t, st.setpoints, snap.sc)[lv].sp, snap.now, 24, 20),
  }), [key, skey, lv])
  const c = snap.climate[lv], terms = DEVICES.filter(d => d.type === 'fcu' && d.level === lv)
  const hvacMode = st.hvac[lv] || 'Auto'
  const devState = (id, on) => st.status[id] === 'alarm' ? 'alarm' : st.status[id] === 'maint' ? 'maint' : st.status[id] === 'warn' ? 'warn' : on ? 'run' : 'standby'
  const cmd = (id, v) => { if (auto) { st.toast('Plant is in Automatic — switch to Manual to command equipment', 'warn'); return } st.setPlant(id, v) }

  return (
    <div className="mod">
      <div className="cols">
        <div className="col left">
          <Panel title="Central plant" right={<div className="seg sm" role="group" aria-label="Plant control">{[[true, 'Automatic'], [false, 'Manual']].map(([v, l]) => <button key={l} className={auto === v ? 'on' : ''} onClick={() => st.setPlant('auto', v)}>{l}</button>)}</div>}>
            <div className="kgrid k3">
              <Kpi label="Cooling load" value={fmt(H.load, 0)} unit="TR" sub={`capacity ${fmt(H.cap, 0)} TR`} color={H.deficit ? '#c4553f' : null} />
              <Kpi label="CHW supply" value={fmt(H.chws, 1)} unit="°C" sub="setpoint 6.5 °C" color={H.chws > 8 ? '#c4553f' : null} />
              <Kpi label="CHW return" value={fmt(H.chwr, 1)} unit="°C" sub={`ΔT ${fmt(H.chwr - H.chws, 1)} K`} />
              <Kpi label="Plant power" value={fmt(H.kw, 0)} unit="kW" sub="chillers + towers + AHUs" />
              <Kpi label="Efficiency" value={fmt(H.kwtr, 2)} unit="kW/TR" sub={`COP ${fmt(H.cop, 1)}`} color={H.kwtr > 0.62 ? '#d08a1e' : '#5f8a52'} />
              <Kpi label="Outdoor" value={fmt(H.oat, 1)} unit="°C" sub="weather station" />
            </div>
            {H.deficit > 0 && <div className="hv-warn"><Icon n="alert" s={14} />Demand exceeds running capacity by {fmt(H.deficit, 0)} TR{auto ? ' — sequencer cannot add more chillers' : ' — start a chiller'}</div>}
            <div className="hv-auto">{auto ? 'Automatic: lead/lag chiller sequencing at 82 % load, CHW reset and tower fan VSD control.' : 'Manual: operator commands each chiller and AHU. Safeties remain active.'}</div>
          </Panel>
          <Panel title="Chillers" sub={`${H.n} of 2 running · ${CH_CAP} TR each`} src={false}>
            {CH.map(id => { const x = H.chillers[id], s = devState(id, x.run)
              return <div key={id} className={'hv-eq' + (st.device === id ? ' on' : '')} onClick={() => st.selectDevice(id)}>
                <div className="hv-eq-h"><Icon n="fan" s={16} className={x.run ? 'spin' : ''} /><b>{DEV[id].name}</b><Pill s={s}>{s === 'run' ? 'Running' : s === 'standby' ? (x.avail ? 'Standby' : 'Unavailable') : s}</Pill></div>
                <Meter v={x.load} max={100} warn={90} crit={100} />
                <div className="hv-eq-v"><span>Load <b>{fmt(x.load, 0)} %</b></span><span>{fmt(x.tr, 0)} TR</span><span>{fmt(x.kw, 0)} kW</span><span>CHWS {x.chws ? fmt(x.chws, 1) + '°' : '—'}</span><span>Cond {x.cond ? fmt(x.cond, 1) + '°' : '—'}</span></div>
                <div className="hv-eq-c" onClick={e => e.stopPropagation()}><span>{fmt(x.hours, 0)} run h</span>
                  <div className="seg sm">{['on', 'off'].map(v => <button key={v} disabled={auto} className={(plant[id] || (id === CH[0] ? 'on' : 'off')) === v && !auto ? 'on' : ''} onClick={() => cmd(id, v)}>{v === 'on' ? 'Start' : 'Stop'}</button>)}</div></div>
              </div> })}
          </Panel>
          <Panel title="Cooling towers" src={false} className="grow">
            {CT.map(id => { const x = H.towers[id]
              return <div key={id} className={'hv-row' + (st.device === id ? ' on' : '')} onClick={() => st.selectDevice(id)}>
                <i className={'dot ' + (x.run ? 'run' : 'idle')} /><b>{DEV[id].name}</b>
                <span>Fan {fmt(x.fan, 0)} %</span><span>CW {x.run ? `${fmt(x.cwIn, 1)}→${fmt(x.cwOut, 1)} °C` : 'idle'}</span><span>{fmt(x.kw, 1)} kW</span></div> })}
          </Panel>
        </div>

        <div className="col center">
          <div className="hv-tabs"><Seg value={view} options={[['plant', 'Plant trends'], ['twin', 'Digital twin']]} onChange={setView} /></div>
          {view === 'plant' ? <>
            <Panel title="Cooling load vs running capacity" sub="last 24 h · TR">
              <LineChart h={220} unit="TR" series={[{ name: 'Load', color: '#c98a2e', data: hist.load, area: true }, { name: 'Running capacity', color: '#5b8fb9', data: hist.cap }]} />
            </Panel>
            <Panel title="Chilled water temperatures" sub="supply / return · °C">
              <LineChart h={180} yMin={4} unit="°C" digits={1} series={[{ name: 'CHW supply', color: '#5b8fb9', data: hist.chws }, { name: 'CHW return', color: '#c4553f', data: hist.chwr }]} refLine={{ v: 6.5, label: 'Supply SP 6.5 °C' }} />
            </Panel>
            <Panel title="Air handling units" sub="supply air, airflow, outdoor air" src={false}>
              <table className="ftbl hv-t"><thead><tr><th>AHU</th><th>Serves</th><th>Mode</th><th>SAT / SP</th><th>Airflow</th><th>Fan</th><th>OA damper</th><th>Filter ΔP</th><th>Command</th></tr></thead>
                <tbody>{AHU.map(id => { const a = H.ahus[id]
                  return <tr key={id} className={'click' + (st.device === id ? ' on' : '')} onClick={() => st.selectDevice(id)}>
                    <td><b>{DEV[id].name.split(' ')[0]}</b></td><td>{a.serves.join(', ')}</td><td><Pill s={a.run ? (a.mode === 'Auto' ? 'run' : 'warn') : 'offline'}>{a.mode}</Pill></td>
                    <td>{a.run ? `${fmt(a.sat, 1)} / ${a.satSp}` : '—'} °C</td><td>{fmt(a.flow, 0)} m³/h</td><td>{fmt(a.fan, 0)} %</td><td>{fmt(a.oa, 0)} %</td>
                    <td style={{ color: a.dp > 200 ? '#d08a1e' : null }}>{fmt(a.dp, 0)} Pa</td>
                    <td onClick={e => e.stopPropagation()}><select className="tsel sm" disabled={auto} value={plant[id] || 'auto'} onChange={e => cmd(id, e.target.value)}><option value="auto">Auto</option><option value="max">100 %</option><option value="off">Off</option></select></td></tr> })}</tbody></table>
            </Panel>
          </> : <div className="hv-twin"><Twin layer="bms" /></div>}
        </div>

        <div className="col right">
          <Panel title="Zone control" sub="click a floor">
            <div className="zone-grid">{ZONES.map(L => { const z = snap.climate[L.id], d = z.temp - z.sp
              return <button key={L.id} className={lv === L.id ? 'on' : ''} onClick={() => { setLv(L.id); st.setLevel(L.id) }} style={{ '--zc': d > 1.5 ? '#c4553f' : d > 0.7 ? '#d08a1e' : '#5f8a52' }}>
                <b>{L.id}</b><strong>{animate(fmt(z.temp, 1) + '°')}</strong><small>SP {fmt(z.sp, 1)}</small></button> })}</div>
          </Panel>
          <Panel title={`${LEVEL[lv].name}`} sub={LEVEL[lv].use}>
            <div className="zc-top">
              <Gauge v={c.temp} max={32} unit="°C" digits={1} label="Zone temp" color={c.temp - c.sp > 1.5 ? '#c4553f' : '#c98a2e'} size={96} />
              <div className="zc-sp">
                <small>Setpoint</small>
                <div className="sp-ctl"><button onClick={() => st.setSetpoint(lv, c.sp - 0.5)} aria-label="Lower setpoint">−</button><b>{fmt(c.sp, 1)} °C</b><button onClick={() => st.setSetpoint(lv, c.sp + 0.5)} aria-label="Raise setpoint">+</button></div>
                <Seg small value={hvacMode} options={['Auto', 'Comfort', 'Eco', 'Off']} onChange={v => st.setHvac(lv, v)} />
                <span>RH {fmt(c.rh, 0)} % · CO₂ {fmt(c.co2, 0)} ppm · Occ {fmt(c.occ * 100, 0)} %</span>
              </div>
            </div>
            <LineChart h={96} yMin={18} yMax={30} unit="°C" digits={1} series={[{ name: 'Zone', color: '#c98a2e', data: hist.zt, area: true }, { name: 'Setpoint', color: '#9a9083', data: hist.zsp }]} />
          </Panel>
          <Panel title="VAV / FCU terminals" sub={`${terms.length} on ${lv}`} className="grow" src={false}>
            <div className="vav-list">{terms.map(d => { const v = H.vav[d.id]
              return <button key={d.id} className={st.device === d.id ? 'on' : ''} onClick={() => st.selectDevice(d.id)}>
                <b>{d.id.replace('FCU-', '')}</b><span>{fmt(v.temp, 1)}°</span><span>{v.flow} l/s</span>
                <div className="vav-bar"><i style={{ width: v.valve + '%' }} /></div><em>valve {v.valve} %</em></button> })}</div>
          </Panel>
          <Panel title="HVAC alarms" src={false}><HvacAlarms /></Panel>
        </div>
      </div>
    </div>
  )
}

function HvacAlarms() {
  // BMS alarms raised on HVAC equipment
  return <AlarmList sys="bms" limit={4} compact empty="No HVAC alarms" />
}
export { HVAC_DEV }
