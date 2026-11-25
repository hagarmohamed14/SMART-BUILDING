import { useMemo } from 'react'
import { useStore, scFlags } from './store'
import { electricity, water, gas, climate, datacenter, network, hvac } from './sim'
import { DEV } from './building'

export const STATUS = {
  ok: { label: 'Normal', color: '#5f8a52' }, run: { label: 'Running', color: '#5f8a52' },
  warn: { label: 'Warning', color: '#d08a1e' }, alarm: { label: 'Alarm', color: '#c4553f' },
  fault: { label: 'Fault', color: '#b4663a' }, offline: { label: 'Offline', color: '#9a9288' },
  maint: { label: 'Maintenance', color: '#7c78a8' }, off: { label: 'Stopped', color: '#9a9288' },
}
export const SEV = { critical: { label: 'Critical', color: '#c4553f' }, major: { label: 'Major', color: '#d08a1e' }, minor: { label: 'Minor', color: '#a89a6a' } }

export const fmt = (v, d = 0) => v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
export const fmtK = (v, d = 1) => Math.abs(v) >= 1e6 ? fmt(v / 1e6, d) + 'M' : Math.abs(v) >= 1e3 ? fmt(v / 1e3, d) + 'k' : fmt(v, 0)
export const tm = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
export const tms = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
export const dt = (t) => new Date(t).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
export const ago = (now, t) => { const m = Math.round((now - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} m ago` : `${Math.floor(m / 1440)} d ago` }

// All live values for the current simulated instant
export function useSnap() {
  const now = useStore(s => s.now), scenarios = useStore(s => s.scenarios), setpoints = useStore(s => s.setpoints), plant = useStore(s => s.plant)
  return useMemo(() => {
    const sc = scFlags(scenarios)
    return { now, sc, elec: electricity(now, sc), water: water(now, sc), gas: gas(now, sc), climate: climate(now, setpoints, sc), dc: datacenter(now, sc), net: network(now, sc), hvac: hvac(now, sc, setpoints, plant) }
  }, [now, scenarios, setpoints, plant])
}

// Human-readable live readings for any device
export function readings(d, snap, st) {
  if (!d) return []
  const c = snap.climate[d.level], s = st.status[d.id]
  switch (d.type) {
    case 'smoke': return [['Obscuration', s === 'alarm' ? '4.8 %/m' : (0.05 + (d.x % 3) * 0.02).toFixed(2) + ' %/m'], ['Loop / address', `L${(d.level.charCodeAt(1) % 4) + 1} · ${100 + Math.abs(Math.round(d.x * 3 + d.z))}`]]
    case 'heat': return [['Temperature', fmt(c.temp + 4, 1) + ' °C'], ['Mode', 'Rate-of-rise A2R']]
    case 'iaq': return [['Temperature', fmt(c.temp, 1) + ' °C'], ['Humidity', fmt(c.rh, 0) + ' %RH'], ['CO₂', fmt(c.co2, 0) + ' ppm'], ['PM2.5', fmt(c.pm25, 0) + ' µg/m³']]
    case 'fcu': return [['Zone temp', fmt(c.temp, 1) + ' °C'], ['Setpoint', fmt(c.sp, 1) + ' °C'], ['Valve', fmt(30 + 50 * c.occ, 0) + ' %'], ['Fan', c.occ > 0.2 ? 'Medium' : 'Low']]
    case 'ahu': return [['Supply air', s === 'off' ? '— (stopped)' : '13.8 °C'], ['Fan speed', s === 'off' ? '0 %' : fmt(55 + 30 * snap.climate.L3.occ, 0) + ' %'], ['Filter ΔP', d.id === 'AHU-RF-02' ? '245 Pa' : '142 Pa']]
    case 'chiller': return [['CHW supply', '6.7 °C'], ['Load', fmt(35 + 50 * snap.climate.L3.occ, 0) + ' %'], ['COP', '5.6']]
    case 'rack': { const r = snap.dc.racks[d.rack]; return [['CPU', fmt(r.cpu, 0) + ' %'], ['Inlet', fmt(r.inlet, 1) + ' °C'], ['Power', fmt(r.kw, 1) + ' kW'], ['Memory', fmt(r.mem, 0) + ' %']] }
    case 'crac': { const k = d.name; const u = snap.dc.crah[k]; return [['State', u?.on ? 'Cooling' : 'Tripped'], ['Supply', u?.on ? fmt(u.supply, 1) + ' °C' : '—'], ['Fan', fmt(u?.fan, 0) + ' %']] }
    case 'ups': { const u = d.id.endsWith('01') ? snap.dc.upsA : snap.dc.upsB; return [['Mode', u.mode], ['Load', fmt(u.load, 0) + ' %'], ['Battery', fmt(u.batt, 0) + ' %'], ['Runtime', u.runtime + ' min']] }
    case 'transformer': return [['Loading', fmt(d.id.endsWith('01') ? snap.elec.tx1 : snap.elec.tx2, 0) + ' %'], ['Winding temp', fmt(68 + 0.2 * snap.elec.tx1, 0) + ' °C'], ['Voltage', fmt(snap.elec.v, 0) + ' V']]
    case 'mdb': case 'smdb': case 'emeter': { const kw = d.type === 'mdb' ? snap.elec.grid / 2 : snap.elec.floors[d.level]; return [['Active power', fmt(kw, 0) + ' kW'], ['Voltage L-L', fmt(snap.elec.v, 0) + ' V'], ['Power factor', fmt(snap.elec.pf, 2)]] }
    case 'generator': return [['State', snap.sc.powerFail ? 'Running on load' : 'Standby · auto'], ['Fuel', '86 %'], ['Output', fmt(snap.elec.gen, 0) + ' kW']]
    case 'pv': return [['Output', fmt(snap.elec.pv, 0) + ' kW'], ['Today', fmt(snap.elec.pv * 4.1, 0) + ' kWh']]
    case 'tank': return [['Level', fmt(snap.water.tanks[d.id], 0) + ' %'], ['Capacity', d.cap + ' m³']]
    case 'pump': return [['State', st.pumps[d.id] === 'off' ? 'Off (manual)' : s === 'maint' ? 'Maintenance' : snap.water.pumps[d.id]], ['Discharge', fmt(snap.water.pressure, 1) + ' bar']]
    case 'wmeter': return [['Flow', fmt(d.level === 'B1' && /WM-0/.test(d.name) ? snap.water.flow : snap.water.floors[d.level], 2) + ' m³/h']]
    case 'leak': return [['Sensor', s === 'alarm' ? 'WET' : 'Dry']]
    case 'gmeter': return [['Flow', fmt(/GM-2/.test(d.name) ? snap.gas.kitchen : /GM-3/.test(d.name) ? snap.gas.boiler : snap.gas.flow, 2) + ' m³/h'], ['Pressure', fmt(snap.gas.pressure, 1) + ' mbar']]
    case 'gdet': return [['Gas', /CO/.test(d.name) ? fmt(snap.gas.co, 0) + ' ppm CO' : fmt(d.level === 'GF' ? snap.gas.lel.kitchen : d.level === 'RF' ? snap.gas.lel.boiler : snap.gas.lel.meter, 1) + ' % LEL']]
    case 'esv': return [['Valve', (st.esv[d.id] || 'open').toUpperCase()]]
    case 'boiler': return [['Firing', fmt(30 + 40 * snap.climate.L3.occ, 0) + ' %'], ['Flow temp', '62 °C']]
    case 'burner': return [['Flow', fmt(snap.gas.kitchen, 2) + ' m³/h']]
    case 'camera': return [['Stream', s === 'offline' ? 'No signal' : '4K · H.265 · 25 fps'], ['Recording', s === 'offline' ? 'Stopped' : (st.rec[d.id] || 'Continuous')]]
    case 'door': { const dr = st.doors[d.id]; return [['Lock', dr.locked ? 'Locked' : 'Unlocked'], ['Mode', dr.mode], ['Reader', dr.reader]] }
    case 'ap': return [['Clients', s === 'offline' ? '0' : fmt(snap.net.wifiClients / 18 * (0.7 + (d.x % 5) / 10), 0)], ['Band', '5 GHz · ch 44']]
    case 'switch': case 'core': case 'router': case 'firewall': return [['Uplink', s === 'offline' ? 'Down' : '10 Gb/s'], ['CPU', '18 %']]
    case 'lift': return [['Position', 'Car ' + d.name.slice(-1)], ['State', snap.sc.fire ? 'Fire recall · GF' : 'In service']]
    case 'facp': return [['State', snap.sc.fire ? 'FIRE' : 'Normal'], ['Loops', '8 / 8 healthy']]
    default: return [['Status', (STATUS[s] || STATUS.ok).label]]
  }
}

export const devAlarm = (alarms, id) => alarms.find(a => a.dev === id && a.state !== 'resolved')
export const devOf = (id) => DEV[id]
