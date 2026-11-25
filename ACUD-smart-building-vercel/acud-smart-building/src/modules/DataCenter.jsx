import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { DEVICES, DEV } from '../data/building'
import { useSnap, fmt, STATUS } from '../data/util'
import { datacenter, series, hash, rng } from '../data/sim'
import { Panel, Kpi, AlarmList, Seg, Pill } from '../components/UI'
import { LineChart, Gauge, Meter, Donut } from '../components/Charts'
import Twin from '../twin/LazyTwin'

const RACKS = DEVICES.filter(d => d.type === 'rack')
const ROLE = ['esx', 'k8s', 'db', 'sto', 'bkp', 'app', 'web', 'gpu']
function rackServers(rack, used) {
  const r = rng(Math.floor(hash(rack.charCodeAt(0) * 31 + +rack.slice(1)) * 1e6)), out = []
  let u = 2
  while (u < used + 2) { const h = r() > 0.7 ? 2 : 1; const role = ROLE[Math.floor(r() * ROLE.length)]; out.push({ u, h, name: `${role}-${rack.toLowerCase()}-${String(out.length + 1).padStart(2, '0')}`, k: r() }); u += h }
  out.push({ u: 40, h: 1, name: `tor-${rack.toLowerCase()}-a`, k: 0.3, net: true }, { u: 41, h: 1, name: `tor-${rack.toLowerCase()}-b`, k: 0.4, net: true })
  return out
}
const heat = (v, lo, hi) => { const k = Math.max(0, Math.min(1, (v - lo) / (hi - lo))); const a = [124, 149, 168], b = [208, 138, 30], c = [196, 85, 63]; const m = k < 0.5 ? a.map((x, i) => x + (b[i] - x) * k * 2) : b.map((x, i) => x + (c[i] - x) * (k - 0.5) * 2); return `rgb(${m.map(Math.round).join(',')})` }

export default function DataCenter() {
  const snap = useSnap(), st = useStore(), dc = snap.dc
  const [metric, setMetric] = useState('temp')
  const [rack, setRack] = useState('B4')
  const rd = dc.racks[rack]
  const servers = useMemo(() => rackServers(rack, rd.u), [rack, rd.u])
  const hist = useMemo(() => ({ it: series(t => datacenter(t, snap.sc).it, snap.now, 24, 20), pue: series(t => datacenter(t, snap.sc).pue, snap.now, 24, 20) }), [Math.floor(snap.now / 300000), snap.sc])
  const avgIn = Object.values(dc.racks).reduce((a, r) => a + r.inlet, 0) / RACKS.length
  const maxIn = Math.max(...Object.values(dc.racks).map(r => r.inlet))
  const val = (r) => metric === 'temp' ? r.inlet : metric === 'cpu' ? r.cpu : r.kw
  const col = (r) => metric === 'temp' ? heat(r.inlet, 21, 32) : metric === 'cpu' ? heat(r.cpu, 20, 95) : heat(r.kw, 3, 12)
  const unit = metric === 'temp' ? '°C' : metric === 'cpu' ? '%' : 'kW'
  const pick = (r) => { setRack(r.rack); st.selectDevice(r.id) }
  const net = DEVICES.filter(d => ['core', 'firewall', 'router'].includes(d.type))
  return (
    <div className="mod">
      <div className="cols">
        <div className="col left">
          <Panel title="Data hall" sub="Level 1 · 16 racks · Tier III design">
            <div className="kgrid k3">
              <Kpi label="IT load" value={fmt(dc.it, 0)} unit="kW" sub="of 320 kW" />
              <Kpi label="PUE" value={fmt(dc.pue, 2)} color={dc.pue > 1.5 ? '#d08a1e' : null} sub="target 1.45" />
              <Kpi label="Avg inlet" value={fmt(avgIn, 1)} unit="°C" sub={`max ${fmt(maxIn, 1)} °C`} color={maxIn > 27 ? '#d08a1e' : null} />
              <Kpi label="Facility" value={fmt(dc.facility, 0)} unit="kW" />
              <Kpi label="Humidity" value={fmt(dc.rh, 0)} unit="%RH" />
              <Kpi label="Storage" value={fmt(dc.storage.used / dc.storage.total * 100, 0)} unit="%" sub={`${dc.storage.used} / ${dc.storage.total} TB`} />
            </div>
          </Panel>
          <Panel title="UPS & backup power">
            {[['UPS-L1-01', dc.upsA, 'UPS-A'], ['UPS-L1-02', dc.upsB, 'UPS-B']].map(([id, u, n]) => <div key={id} className="ups" onClick={() => st.selectDevice(id)}>
              <div className="u-h"><b>{n} · 500 kVA</b><Pill s={u.mode === 'Online' ? 'ok' : 'warn'}>{u.mode}</Pill></div>
              <div className="u-r"><span>Load</span><Meter v={u.load} warn={70} crit={85} /><b>{fmt(u.load, 0)}%</b></div>
              <div className="u-r"><span>Battery</span><Meter v={u.batt} color="#5f8a52" /><b>{fmt(u.batt, 0)}%</b></div>
              <div className="u-r"><span>Runtime</span><b className="w">{u.runtime} min</b><span>Generator {snap.sc.powerFail ? 'ON LOAD' : 'standby'}</span></div>
            </div>)}
            <div className="pdu">{['PDU-L1-01', 'PDU-L1-02'].map((id, i) => <div key={id} onClick={() => st.selectDevice(id)}><b>{DEV[id].name}</b><Meter v={dc.it * (i ? 0.48 : 0.52) / 200 * 100} warn={70} crit={85} /><span>{fmt(dc.it * (i ? 0.48 : 0.52), 0)} kW · {fmt(dc.it * (i ? 0.48 : 0.52) * 1000 / (400 * 1.732 * 0.95), 0)} A</span></div>)}</div>
          </Panel>
          <Panel title="Cooling & airflow">
            <div className="crah">{Object.entries(dc.crah).map(([k, u], i) => <button key={k} onClick={() => st.selectDevice(`CRAC-L1-0${i + 1}`)}>
              <i style={{ background: u.on ? '#5f8a52' : '#c4553f' }} /><b>{k}</b><span>{u.on ? `Supply ${fmt(u.supply, 1)} °C · fan ${u.fan}%` : 'TRIPPED'}</span></button>)}</div>
            <div className="mini-t"><span>Cold aisle ΔT {fmt(maxIn - 18, 1)} K</span><span>Redundancy {snap.sc.dcOverheat ? 'N' : 'N+1'}</span><span>Leak: dry</span></div>
          </Panel>
        </div>
        <div className="col center split dc">
          <div className="wall-h"><b>Rack elevation</b><span>colour = {metric === 'temp' ? 'inlet temperature' : metric === 'cpu' ? 'CPU utilisation' : 'power draw'}</span>
            <Seg small value={metric} options={[['temp', 'Temperature'], ['cpu', 'CPU'], ['power', 'Power']]} onChange={setMetric} /></div>
          <div className="racks">
            {['A', 'B'].map(row => <div key={row} className="rrow">
              <div className="aisle">{row === 'A' ? 'Row A · cold aisle →' : 'Row B · ← cold aisle'}</div>
              <div className="rr">{RACKS.filter(r => r.rack.startsWith(row)).map(r => { const v = dc.racks[r.rack]; const al = ['alarm', 'warn'].includes(st.status[r.id])
                return <button key={r.id} className={'rack' + (rack === r.rack ? ' on' : '') + (al ? ' al' : '')} onClick={() => pick(r)} title={`${r.name}: ${fmt(val(v), 1)} ${unit}`}>
                  <span className="rk-h">{r.rack}</span>
                  <div className="rk-u">{Array.from({ length: 12 }, (_, k) => <i key={k} style={{ background: k < Math.round(v.u / 42 * 12) ? col(v) : 'transparent', opacity: k < Math.round(v.u / 42 * 12) ? 0.55 + 0.45 * hash(k + r.rack.charCodeAt(1)) : 1 }} />)}</div>
                  <b style={{ color: col(v) }}>{fmt(val(v), metric === 'temp' ? 1 : 0)}</b><small>{unit}</small>
                </button> })}</div>
            </div>)}
            <div className="scale"><span>{metric === 'temp' ? '21 °C' : metric === 'cpu' ? '20 %' : '3 kW'}</span><i /><span>{metric === 'temp' ? '32 °C' : metric === 'cpu' ? '95 %' : '12 kW'}</span></div>
          </div>
          <div className="wall-twin"><Twin layer="dc" compact /></div>
        </div>
        <div className="col right">
          <Panel title={`Rack ${rack}`} sub={`${rd.u} U used of 42`}>
            <div className="kgrid k4">
              <Kpi label="CPU" value={fmt(rd.cpu, 0)} unit="%" /><Kpi label="Memory" value={fmt(rd.mem, 0)} unit="%" />
              <Kpi label="Inlet" value={fmt(rd.inlet, 1)} unit="°C" color={rd.inlet > 27 ? '#d08a1e' : null} /><Kpi label="Power" value={fmt(rd.kw, 1)} unit="kW" />
            </div>
            <div className="srv">{[...servers].reverse().map(s => <div key={s.u} className={s.net ? 'net' : ''} style={{ height: s.h * 13 }}>
              <span>U{s.u}</span><b>{s.name}</b><i style={{ background: s.net ? '#c98a2e' : heat(rd.cpu * (0.7 + 0.6 * s.k), 20, 95) }} /><em>{s.net ? '48×25G' : `${fmt(Math.min(99, rd.cpu * (0.7 + 0.6 * s.k)), 0)}%`}</em></div>)}</div>
          </Panel>
          <Panel title="IT load & PUE" sub="24 h">
            <LineChart h={100} unit="kW" series={[{ name: 'IT load', color: '#5a6f8f', data: hist.it, area: true }]} />
            <LineChart h={80} digits={2} yMin={1.2} yMax={1.7} series={[{ name: 'PUE', color: '#c98a2e', data: hist.pue }]} refLine={{ v: 1.45, label: 'target', color: '#5f8a52' }} />
          </Panel>
          <Panel title="Network equipment" src>
            <div className="crah">{net.map(d => <button key={d.id} onClick={() => st.selectDevice(d.id)}><i style={{ background: (STATUS[st.status[d.id]] || STATUS.ok).color }} /><b>{d.name}</b><span>{fmt(12 + 30 * hash(d.x + d.z), 0)}% CPU</span></button>)}</div>
          </Panel>
          <Panel title="Critical infrastructure alarms" src={false}><AlarmList sys="dc" limit={5} compact /></Panel>
        </div>
      </div>
    </div>
  )
}
