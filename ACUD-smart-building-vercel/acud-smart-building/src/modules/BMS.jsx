import { useMemo } from 'react'
import { useStore } from '../data/store'
import { LEVELS, LEVEL, DEVICES, SYSTEMS } from '../data/building'
import { useSnap, fmt, STATUS, readings } from '../data/util'
import { climate, series, occ } from '../data/sim'
import { Panel, Kpi, AlarmList, Seg, Pill, Table } from '../components/UI'
import { LineChart, Gauge, Meter } from '../components/Charts'
import Twin from '../twin/LazyTwin'

const PLANT = ['CHILLER-RF-01', 'CHILLER-RF-02', 'TOWER-RF-01', 'TOWER-RF-02', 'AHU-RF-01', 'AHU-RF-02', 'AHU-RF-03']
export default function BMS() {
  const snap = useSnap(), st = useStore(), level = useStore(s => s.level) || 'L3'
  const lv = level
  const c = snap.climate[lv]
  const hvac = st.hvac[lv] || 'Auto', light = st.lighting[lv] || 'Auto'
  const hist = useMemo(() => {
    const sp = st.setpoints, sc = snap.sc
    return { t: series(t => climate(t, sp, sc)[lv].temp, snap.now, 24, 20), sp: series(t => climate(t, sp, sc)[lv].sp, snap.now, 24, 20), co2: series(t => climate(t, sp, sc)[lv].co2, snap.now, 24, 20), rh: series(t => climate(t, sp, sc)[lv].rh, snap.now, 24, 20) }
  }, [lv, Math.floor(snap.now / 120000), st.setpoints, snap.sc])
  const floors = LEVELS.filter(L => !['RF'].includes(L.id))
  const lightPct = light === 'Off' ? 0 : light === 'On' ? 100 : Math.round(15 + 80 * c.occ)
  return (
    <div className="mod">
      <div className="cols">
        <div className="col left">
          <Panel title="HVAC central plant">
            <div className="kgrid k3">
              <Kpi label="CHW supply" value="6.7" unit="°C" sub="setpoint 6.5" />
              <Kpi label="Plant load" value={fmt(560 + 900 * occ(snap.now), 0)} unit="TR" sub={`of 1,600 TR`} />
              <Kpi label="Outdoor" value={fmt(snap.climate.RF.temp, 1)} unit="°C" sub="weather station" />
            </div>
            <div className="eq-list">{PLANT.map(id => { const d = DEVICES.find(x => x.id === id); const s = st.status[id]; const r = readings(d, snap, st)
              return <button key={id} className={st.device === id ? 'on' : ''} onClick={() => st.selectDevice(id)}><i style={{ background: (STATUS[s] || STATUS.ok).color }} /><b>{d.name}</b><span>{r.slice(0, 2).map(x => x[1]).join(' · ')}</span></button> })}</div>
          </Panel>
          <Panel title="Floor comfort" sub="click a floor to control">
            <Table active={lv} onRow={r => st.setLevel(r.id)} cols={[
              { k: 'id', l: 'Floor', f: r => <b>{r.id}</b> }, { k: 't', l: 'Temp', r: 1, f: r => fmt(snap.climate[r.id].temp, 1) + '°' },
              { k: 'sp', l: 'SP', r: 1, f: r => fmt(snap.climate[r.id].sp, 1) }, { k: 'rh', l: 'RH', r: 1, f: r => fmt(snap.climate[r.id].rh, 0) + '%' },
              { k: 'co2', l: 'CO₂', r: 1, f: r => <span style={{ color: snap.climate[r.id].co2 > 1000 ? '#c4553f' : snap.climate[r.id].co2 > 800 ? '#d08a1e' : null }}>{fmt(snap.climate[r.id].co2, 0)}</span> },
              { k: 'o', l: 'Occ.', r: 1, f: r => fmt(snap.climate[r.id].occ * 100, 0) + '%' }]} rows={floors} />
          </Panel>
          <Panel title="Elevators">
            <div className="lifts">
              {['A', 'B'].map(k => <div key={k} className="shaft"><small>Car {k}</small>
                {[...floors].reverse().slice(0, 7).map((L, i) => <div key={L.id} className={'lf' + (6 - i === st.lifts[k] ? ' car' : '')}>{L.id}</div>)}
                <span>{snap.sc.fire ? 'Fire recall' : 'In service'}</span></div>)}
              <div className="lift-info"><Kpi label="Trips today" value={fmt(380 + 900 * occ(snap.now), 0)} /><Kpi label="Avg wait" value={fmt(18 + 14 * occ(snap.now), 0)} unit="s" /><Kpi label="Escalators" value="—" sub="none installed" /></div>
            </div>
          </Panel>
        </div>
        <div className="col center"><Twin layer="bms" /></div>
        <div className="col right">
          <Panel title={`${LEVEL[lv].name} control`} sub={LEVEL[lv].use}>
            <div className="ctl">
              <div className="sp">
                <small>Setpoint</small>
                <button onClick={() => st.setSetpoint(lv, c.sp - 0.5)} aria-label="Lower setpoint">−</button>
                <b>{fmt(c.sp, 1)}°C</b>
                <button onClick={() => st.setSetpoint(lv, c.sp + 0.5)} aria-label="Raise setpoint">+</button>
                <span>Actual {fmt(c.temp, 1)}°C</span>
              </div>
              <label>HVAC mode<Seg small value={hvac} options={['Auto', 'Comfort', 'Eco', 'Off']} onChange={v => st.setHvac(lv, v)} /></label>
              <label>Lighting<Seg small value={light} options={['Auto', 'On', 'Off']} onChange={v => st.setLighting(lv, v)} /></label>
              <div className="lt"><small>Lighting level {lightPct}% · occupancy sensors {light === 'Auto' ? 'active' : 'overridden'}</small><Meter v={lightPct} color="#d49b2a" /></div>
            </div>
            <LineChart h={120} unit="°C" digits={1} yMin={18} yMax={28} series={[{ name: 'Zone temp', color: '#c98a2e', data: hist.t }, { name: 'Setpoint', color: '#8a8073', data: hist.sp, dash: '4 3', width: 1.2 }]} band={[21, 24]} />
          </Panel>
          <Panel title="Air quality" sub={LEVEL[lv].name}>
            <div className="hrow">
              <Gauge v={c.co2} max={1500} unit="ppm" label="CO₂" size={86} warn={800} crit={1000} color="#5f8a52" />
              <Gauge v={c.rh} unit="%RH" label="Humidity" size={86} color="#3f86a8" warn={65} crit={75} />
              <Gauge v={c.pm25} max={50} unit="µg/m³" label="PM2.5" size={86} color="#6f8f5a" warn={25} crit={35} />
            </div>
            <LineChart h={90} unit="ppm" series={[{ name: 'CO₂', color: '#6f8f5a', data: hist.co2, area: true }]} refLine={{ v: 1000, label: '1000 ppm' }} />
          </Panel>
          <Panel title="Maintenance & equipment alerts" src={false}><AlarmList sys="bms" limit={6} compact /></Panel>
        </div>
      </div>
    </div>
  )
}
