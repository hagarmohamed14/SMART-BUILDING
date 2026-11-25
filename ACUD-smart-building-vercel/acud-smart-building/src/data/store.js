import { create } from 'zustand'
import { DEVICES, DEV, LEVEL, ZONE_NAMES } from './building'
import { rng, hstr, MIN } from './sim'
import { loadSite, saveSite } from './site'

const R = rng(20261125)
const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)]

// ---------- people & credentials (fictional) ----------
const FIRST = ['Ahmed', 'Mona', 'Omar', 'Nour', 'Karim', 'Salma', 'Youssef', 'Hana', 'Mostafa', 'Laila', 'Tarek', 'Dina', 'Hassan', 'Yasmin', 'Amr', 'Rana', 'Sherif', 'Mariam', 'Khaled', 'Farida', 'Ziad', 'Aya', 'Mahmoud', 'Nadia', 'Ali', 'Heba', 'Sameh', 'Reem', 'Hesham', 'Malak', 'Walid', 'Engy', 'Adel', 'Sara', 'Fady', 'Noha', 'Ihab', 'Jana', 'Bassem', 'Lina']
const LAST = ['Hassan', 'Farouk', 'Saleh', 'Mansour', 'Gaber', 'Fathy', 'Nabil', 'Shawky', 'Kamel', 'Ibrahim', 'Zaki', 'Rashad', 'Lotfy', 'Hamdy', 'Soliman', 'Fouad', 'Ezzat', 'Naguib']
const DEPTS = [['IT & Data Center', ['All staff', 'IT / DC', 'Network']], ['Facilities', ['All staff', 'Facilities', 'Plant rooms']], ['Security', ['All staff', 'Security', 'Plant rooms', 'IT / DC']], ['Finance', ['All staff']], ['Executive Office', ['All staff', 'Executive']], ['Operations', ['All staff']], ['HR', ['All staff']], ['Legal', ['All staff']]]
export const ACCESS_GROUPS = ['All staff', 'IT / DC', 'Network', 'Facilities', 'Plant rooms', 'Security', 'Executive']
export const USERS0 = FIRST.map((f, i) => {
  const [dept, groups] = DEPTS[i % DEPTS.length]
  return {
    id: `U${1001 + i}`, name: `${f} ${LAST[Math.floor(R() * LAST.length)]}`, dept, groups: [...groups],
    card: `RF-${(0x3A00 + Math.floor(R() * 0xFFF)).toString(16).toUpperCase()}`,
    cred: ['RFID', 'RFID', 'Biometric', 'QR', 'RFID + PIN'][i % 5], status: i === 13 ? 'Suspended' : i === 27 ? 'Expired' : 'Active',
    floor: ['GF', 'L1', 'L2', 'L3', 'L4', 'L5'][i % 6],
  }
})
export const doorGroup = (d) => /Data hall|UPS|MDF|NOC/.test(d.name) ? 'IT / DC' : /IDF/.test(d.name) ? 'Network' : /LV|Generator|Electrical/.test(d.name) ? 'Plant rooms'
  : /Security/.test(d.name) ? 'Security' : /Fire command/.test(d.name) ? 'Facilities' : d.level === 'L5' && /Boardroom|Exec|Meeting/.test(d.name) ? 'Executive' : 'All staff'
const DOORS = DEVICES.filter(d => d.type === 'door')
const reader = (d) => /turnstile/.test(d.name) ? 'QR + RFID' : /Data hall|MDF|UPS/.test(d.name) ? 'Biometric + RFID' : /barrier/.test(d.name) ? 'ANPR + RFID' : 'RFID'

// ---------- initial device health ----------
const status0 = {}
DEVICES.forEach(d => { status0[d.id] = 'ok' })
const setS = (id, s) => { if (DEV[id]) status0[id] = s }
setS('CAMERA-L3-02', 'offline'); setS('CAMERA-B1-03', 'maint'); setS('AP-L4-02', 'offline'); setS('FCU-L2-03', 'maint'); setS('SMOKE-L4-05', 'fault')
setS('AHU-RF-02', 'warn'); setS('RACK-L1-12', 'warn'); setS('PUMP-B1-02', 'maint'); setS('DOOR-L1-04', 'warn')

let aid = 1000
export function mkAlarm(a, ts) {
  const d = a.dev ? DEV[a.dev] : null
  const level = a.level || d?.level, zone = a.zone || d?.zone
  return { id: `INC-${++aid}`, state: 'active', assignee: null, ts, level, zone, room: a.room || d?.room, sys: a.sys || d?.sys, timeline: [{ ts, text: 'Alarm raised by ' + (d ? d.name : 'system') }], ...a }
}
function seedAlarms(now) {
  const m = (min, a) => mkAlarm(a, now - min * MIN)
  const list = [
    m(34, { sev: 'major', dev: 'RACK-L1-12', title: 'Rack B4 inlet temperature high', desc: 'Inlet 27.4 °C exceeds ASHRAE A1 recommended 27 °C. Check blanking panels and CRAH-2 airflow.' }),
    m(52, { sev: 'major', dev: 'DOOR-L1-04', title: 'UPS room door held open', desc: 'Door held open > 120 s after valid entry by card RF-3B1C.' }),
    m(78, { sev: 'minor', dev: 'AHU-RF-02', title: 'AHU-2 filter ΔP high', desc: 'Pre-filter differential pressure 245 Pa (limit 225 Pa). Schedule filter replacement.' }),
    m(95, { sev: 'minor', dev: 'CAMERA-L3-02', title: 'Camera video loss', desc: 'No RTSP stream for 15 min. PoE port Gi1/0/14 on Access switch L3-A shows link down.' }),
    m(140, { sev: 'minor', dev: 'AP-L4-02', title: 'Access point unreachable', desc: 'SNMP and CAPWAP heartbeat lost.' }),
    m(190, { sev: 'minor', dev: 'SMOKE-L4-05', title: 'Smoke detector dirty / drift', desc: 'Detector compensation at 82 %. Clean or replace head.' }),
    m(260, { sev: 'minor', dev: 'EMETER-B1-01', title: 'Power factor below target', desc: 'PF 0.89 on MDB-1 for 15 min (target ≥ 0.92). Capacitor bank stage 3 not switching.', sys: 'elec' }),
  ]
  list[2].state = 'ack'; list[2].assignee = 'Facilities · Shift B'; list[2].timeline.push({ ts: now - 70 * MIN, text: 'Acknowledged by Facilities · Shift B' })
  return list
}

function mkEvent(now, r = Math.random, forced) {
  const u = pick(USERS0, r), d = forced || pick(DOORS, r)
  const allowed = u.status === 'Active' && u.groups.includes(doorGroup(d))
  const dir = r() > 0.5 ? 'Entry' : 'Exit'
  return {
    id: `E${Math.floor(now)}${Math.floor(r() * 1e4)}`, ts: now, user: u.name, uid: u.id, card: u.card, door: d.id, doorName: d.name, level: d.level, cred: u.cred, dir,
    result: allowed ? 'Granted' : 'Denied', reason: allowed ? '' : u.status !== 'Active' ? `Card ${u.status.toLowerCase()}` : 'No access rights for this door',
  }
}
function seedEvents(now) {
  const r = rng(77), out = []
  for (let i = 0; i < 80; i++) out.push(mkEvent(now - i * 47000 - r() * 20000, r))
  return out
}
function seedFireHistory(now) {
  return [
    { ts: now - 26 * 3600000, type: 'Test', text: 'Weekly sounder test — all zones', level: 'GF' },
    { ts: now - 3 * 86400000, type: 'Fault', text: 'Loop 2 earth fault cleared', level: 'L2' },
    { ts: now - 5 * 86400000, type: 'Pre-alarm', text: 'Kitchen heat detector rate-of-rise (cooking)', level: 'GF' },
    { ts: now - 9 * 86400000, type: 'Drill', text: 'Full evacuation drill — 6 min 40 s', level: 'All' },
    { ts: now - 16 * 86400000, type: 'Disablement', text: 'Zone L4-Z3 disabled for fit-out (restored)', level: 'L4' },
  ]
}

// ---------- scenarios ----------
export const SCENARIOS = {
  fire: { name: 'Fire alarm', sys: 'fire', desc: 'Smoke detected on Level 3 — sounders, lift recall, door release, AHU shutdown.' },
  gasLeak: { name: 'Gas leak', sys: 'gas', desc: 'Kitchen gas detector at 34 % LEL — ESV-2 closes automatically.' },
  waterLeak: { name: 'Water leak', sys: 'water', desc: 'Leak under Level 4 pantry — riser valve isolation.' },
  netDown: { name: 'Network switch failure', sys: 'nms', desc: 'Access switch L2-A down — cameras and APs on L2 lose connectivity.' },
  dcOverheat: { name: 'Data hall overheat', sys: 'dc', desc: 'CRAH-2 compressor trip — racks B5–B8 inlet temperature climbs.' },
  powerFail: { name: 'Utility power failure', sys: 'elec', desc: 'Grid supply lost — UPS on battery, generator start and ATS transfer.' },
  intrusion: { name: 'Unauthorized access', sys: 'access', desc: 'Forced door at the MDF and repeated badge denials.' },
  highOcc: { name: 'High occupancy', sys: 'access', desc: 'Event day — headcount 32 % above design. Ventilation and cooling demand rise.' },
  hvacOverload: { name: 'HVAC overload', sys: 'bms', desc: 'Heat wave + full floors — cooling demand exceeds one chiller; plant runs at limit.' },
  equipFail: { name: 'Equipment failure', sys: 'bms', desc: 'Chiller CH-2 compressor trip — CH-1 runs alone; upper floors drift warm.' },
}
// automatic responses executed by the engine (Auto mode) or held for the operator (Manual mode)
export const RESPONSES = {
  fire: { text: ['AHU-2 shut down (smoke control)', 'Lifts recalled to GF', 'Stair doors and turnstiles released'], status: { 'AHU-RF-02': 'off' } },
  gasLeak: { text: ['Kitchen shut-off valve ESV-2 closed', 'Kitchen burners isolated', 'Extract fans on boost'], status: { 'BURNER-GF-01': 'off' }, esv: { 'ESV-GF-01': 'closed' } },
  waterLeak: { text: ['L4 pantry branch valve closed', 'Facilities work order raised'], status: { 'WMETER-L4-01': 'warn' } },
  netDown: { text: ['Traffic re-routed via Core CS-2', 'NOC ticket opened'], status: {} },
  dcOverheat: { text: ['CRAH-1/3 fans to 96 %', 'Non-critical workload migration requested'], status: {} },
  powerFail: { text: ['Generator G-1 started', 'ATS transferred essential loads', 'Non-essential HVAC shed'], status: { 'GENERATOR-B1-01': 'run' } },
  intrusion: { text: ['Camera CAMERA-L1-01 bookmarked', 'MDF door re-locked', 'Guard dispatched'], status: {} },
  highOcc: { text: ['Demand-controlled ventilation: outdoor air +25 %', 'Standby chiller enabled', 'Turnstile flow-rate alert to security'], status: {} },
  hvacOverload: { text: ['Standby chiller CH-2 started', 'Demand limiting: office setpoints +1 °C', 'CHW supply reset to 6.5 °C'], status: {}, setpoints: { L2: 23.5, L3: 23.5, L4: 23.5, L5: 23.5 } },
  equipFail: { text: ['CH-1 set as lead and locked on', 'Work order WO-CH2 assigned to HVAC contractor', 'Non-critical zones setpoint +1 °C'], status: {}, setpoints: { L4: 23.5, L5: 23.5 } },
}
function scenarioEffects(key, now) {
  const A = (min, a) => ({ ...mkAlarm(a, now - min * 1000), scenario: key })
  switch (key) {
    case 'fire': return {
      alarms: [A(0, { sev: 'critical', dev: 'SMOKE-L3-04', title: 'FIRE ALARM — smoke detected', desc: 'Two-detector coincidence in Open Office B, Level 3 Zone SE. Sounders active on L2–L4. Lifts recalled to GF. AHU-2 shut down. Egress doors released.' }),
        A(0, { sev: 'major', dev: 'SMOKE-L3-05', title: 'Second detector in alarm', desc: 'Confirms alarm (coincidence).' })],
      status: { 'SMOKE-L3-04': 'alarm', 'SMOKE-L3-05': 'alarm', 'SOUNDER-L3-01': 'alarm', 'SOUNDER-L3-02': 'alarm', 'SPRINKLER-L3-01': 'warn' },
      focus: { level: 'L3', dev: 'SMOKE-L3-04' },
    }
    case 'gasLeak': return {
      alarms: [A(0, { sev: 'critical', dev: 'GDET-GF-01', title: 'Gas leak — 34 % LEL', desc: 'Kitchen gas detector above high threshold (20 % LEL). ESV-2 closed automatically, extract fans on boost, kitchen evacuated.' })],
      status: { 'GDET-GF-01': 'alarm', 'GDET-GF-02': 'warn' }, focus: { level: 'GF', dev: 'GDET-GF-01' },
    }
    case 'waterLeak': return {
      alarms: [A(0, { sev: 'major', dev: 'LEAK-L4-02', title: 'Water leak detected', desc: 'Leak sensor wet under Level 4 pantry. Floor flow +2.8 m³/h above profile. Riser branch valve to L4 pantry closed.' })],
      status: { 'LEAK-L4-02': 'alarm', 'WMETER-L4-01': 'warn' }, focus: { level: 'L4', dev: 'LEAK-L4-02' },
    }
    case 'netDown': return {
      alarms: [A(0, { sev: 'critical', dev: 'SWITCH-L2-01', title: 'Access switch down', desc: 'Access switch L2-A unreachable (ICMP + SNMP). 2 uplinks down on Core CS-1/CS-2. Downstream: 3 APs, 2 cameras.' })],
      status: { 'SWITCH-L2-01': 'offline', 'AP-L2-01': 'offline', 'AP-L2-02': 'offline', 'AP-L2-03': 'offline', 'CAMERA-L2-01': 'offline', 'CAMERA-L2-02': 'offline' }, focus: { level: 'L2', dev: 'SWITCH-L2-01' },
    }
    case 'dcOverheat': return {
      alarms: [A(0, { sev: 'critical', dev: 'CRAC-L1-02', title: 'CRAH-2 compressor trip', desc: 'High-pressure trip. Cooling redundancy lost (N). Racks B5–B8 inlet rising above 30 °C.' }),
        A(0, { sev: 'major', dev: 'RACK-L1-13', title: 'Rack B5–B8 inlet over temperature', desc: 'Inlet > 30 °C. Consider workload migration.' })],
      status: { 'CRAC-L1-02': 'alarm', 'RACK-L1-13': 'alarm', 'RACK-L1-14': 'alarm', 'RACK-L1-15': 'alarm', 'RACK-L1-16': 'alarm' }, focus: { level: 'L1', dev: 'CRAC-L1-02' },
    }
    case 'powerFail': return {
      alarms: [A(0, { sev: 'critical', dev: 'TRANSFORMER-B1-01', title: 'Utility supply lost', desc: 'Undervoltage on 22 kV incomer. UPS-A/B on battery. Generator G-1 started, ATS transfer in 8 s.', sys: 'elec' }),
        A(0, { sev: 'major', dev: 'GENERATOR-B1-01', title: 'Generator running on load', desc: 'G-1 supplying essential loads.', sys: 'elec' })],
      status: { 'TRANSFORMER-B1-01': 'alarm', 'TRANSFORMER-B1-02': 'alarm', 'UPS-L1-01': 'warn', 'UPS-L1-02': 'warn' }, focus: { level: 'B1', dev: 'GENERATOR-B1-01' },
    }
    case 'highOcc': return {
      alarms: [A(0, { sev: 'major', dev: 'DOOR-GF-04', title: 'Occupancy above design capacity', desc: 'Headcount 32 % above design occupancy. Turnstile throughput at limit; CO₂ rising on office floors.' }),
        A(0, { sev: 'minor', dev: 'IAQ-L3-01', title: 'CO₂ above 1000 ppm', desc: 'Ventilation demand rising with occupancy.' })],
      status: { 'DOOR-GF-04': 'warn', 'IAQ-L3-01': 'warn' }, focus: { level: 'GF', dev: 'DOOR-GF-04' },
    }
    case 'hvacOverload': return {
      alarms: [A(0, { sev: 'major', dev: 'CHILLER-RF-01', title: 'Cooling demand exceeds plant capacity', desc: 'Load above 1,300 TR at high outdoor temperature. CHW supply drifting above setpoint; office zones warming.', sys: 'bms' })],
      status: { 'CHILLER-RF-01': 'warn', 'AHU-RF-02': 'warn' }, focus: { level: 'RF', dev: 'CHILLER-RF-01' },
    }
    case 'equipFail': return {
      alarms: [A(0, { sev: 'critical', dev: 'CHILLER-RF-02', title: 'Chiller CH-2 compressor trip', desc: 'High discharge pressure trip on CH-2. Plant redundancy lost — CH-1 carrying full load.', sys: 'bms' })],
      status: { 'CHILLER-RF-02': 'alarm' }, focus: { level: 'RF', dev: 'CHILLER-RF-02' },
    }
    case 'intrusion': return {
      alarms: [A(0, { sev: 'critical', dev: 'DOOR-L1-05', title: 'Door forced open — MDF', desc: 'Door contact opened without valid credential or REX. Camera CAMERA-L1-01 bookmarked.' }),
        A(0, { sev: 'major', dev: 'DOOR-L1-03', title: 'Repeated badge denials — Data hall', desc: '4 denied attempts in 60 s with card RF-3A77 (suspended).' })],
      status: { 'DOOR-L1-05': 'alarm', 'DOOR-L1-03': 'warn' }, focus: { level: 'L1', dev: 'DOOR-L1-05' },
    }
  }
}

const initDoors = () => Object.fromEntries(DOORS.map(d => [d.id, { locked: true, mode: 'Scheduled', reader: reader(d), state: 'Closed' }]))

export const useStore = create((set, get) => ({
  mode: 'live', speed: 60, now: Date.now(), offlineAt: null, tick: 0, paused: false, simAuto: true, responded: {}, plant: { auto: true },
  theme: (typeof localStorage !== 'undefined' && localStorage.getItem('acud-theme')) || 'light',
  site: loadSite(), node: 'NN4', bld: 'NN4-admin',
  module: 'overview', level: null, view: '3d', explode: true, device: null, layer: null, focusTick: 0,
  filters: { level: 'all', sys: 'all', status: 'all', range: '24h', q: '' },
  alarms: seedAlarms(Date.now()), events: seedEvents(Date.now()), fireHistory: seedFireHistory(Date.now()),
  status: status0, scenarios: {}, users: USERS0, doors: initDoors(),
  setpoints: {}, lighting: {}, hvac: {}, esv: { 'ESV-B1-01': 'open', 'ESV-GF-01': 'open', 'ESV-RF-01': 'open' },
  pumps: {}, rec: {}, toasts: [], openAlarm: null, drawer: null, lifts: { A: 0, B: 4 },

  setMode: (mode) => set(s => ({ mode, offlineAt: mode === 'offline' ? s.now : null, now: mode === 'live' ? Date.now() : s.now })),
  setSpeed: (speed) => set({ speed }),
  setTheme: (theme) => { try { localStorage.setItem('acud-theme', theme) } catch { } set({ theme }) },
  setSite: (node, bld) => set({ node, bld }),
  saveSiteProfiles: (site) => { saveSite(site); set(s => { const n = site.find(x => x.id === s.node) || site[0]; const b = n?.buildings.find(x => x.id === s.bld) || n?.buildings[0]; return { site, node: n?.id, bld: b?.id } }) },
  setPlant: (k, v) => { if (!get().guard()) return; set(s => ({ plant: { ...s.plant, [k]: v } })); get().toast(k === 'auto' ? `HVAC plant control: ${v ? 'Automatic' : 'Manual'}` : `${DEV[k]?.name || k}: ${v}`) },
  setSimAuto: (simAuto) => set({ simAuto }),
  simStart: () => { const s = get(); if (s.mode !== 'sim') s.setMode('sim'); set({ paused: false }) },
  simPause: () => set({ paused: true }),
  simReset: () => { const s = get(); Object.keys(s.scenarios).forEach(k => get().clearScenario(k)); set({ now: Date.now(), paused: false, responded: {}, setpoints: {}, plant: { auto: true } }); get().toast('Simulation reset — normal conditions') },
  applyResponse: (key) => {
    const s = get(), r = RESPONSES[key]; if (!r || s.responded[key] || !s.scenarios[key]) return
    const patch = { responded: { ...s.responded, [key]: true }, status: { ...s.status, ...r.status } }
    if (r.esv) patch.esv = { ...s.esv, ...r.esv }
    if (r.setpoints) patch.setpoints = { ...s.setpoints, ...r.setpoints }
    if (key === 'fire') { patch.lifts = { A: 1, B: 1 }; patch.doors = Object.fromEntries(Object.entries(s.doors).map(([k, v]) => [k, /stair|turnstile/.test(DEV[k].name) ? { ...v, locked: false, mode: 'Fire release' } : v])) }
    if (key === 'intrusion') patch.doors = { ...s.doors, 'DOOR-L1-05': { ...s.doors['DOOR-L1-05'], locked: true, mode: 'Security lock' } }
    const who = s.simAuto ? 'Automation engine' : 'Operator · J. Adel'
    patch.alarms = s.alarms.map(a => a.scenario === key ? { ...a, timeline: [...a.timeline, ...r.text.map(x => ({ ts: s.now, text: `${who}: ${x}` }))] } : a)
    set(patch)
    if (!s.simAuto) s.toast(`Response executed: ${SCENARIOS[key].name}`)
  },
  go: (module, opts = {}) => set(s => ({ module, layer: opts.layer ?? null, level: opts.level !== undefined ? opts.level : s.level, device: opts.device ?? null, drawer: null })),
  setLevel: (level) => set(s => ({ level, device: s.device && level && DEV[s.device]?.level !== level ? null : s.device, focusTick: s.focusTick + 1 })),
  setView: (view) => set(s => ({ view, focusTick: s.focusTick + 1 })),
  setExplode: (explode) => set({ explode }),
  setLayer: (layer) => set({ layer }),
  selectDevice: (id) => set(s => id ? ({ device: id, level: DEV[id].level, focusTick: s.focusTick + 1 }) : ({ device: null })),
  locate: (id) => set(s => ({ device: id, level: DEV[id].level, focusTick: s.focusTick + 1, drawer: null })),
  setFilter: (k, v) => set(s => ({ filters: { ...s.filters, [k]: v } })),
  openIncident: (id) => set({ openAlarm: id }),
  closeIncident: () => set({ openAlarm: null }),
  setDrawer: (drawer) => set({ drawer }),
  toast: (text, sev = 'info') => { const id = Math.random(); set(s => ({ toasts: [...s.toasts, { id, text, sev }] })); setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4200) },

  guard: () => { if (get().mode === 'offline') { get().toast('Gateway offline — commands are disabled', 'warn'); return false } return true },
  log: (id, text) => set(s => ({ alarms: s.alarms.map(a => a.id === id ? { ...a, timeline: [...a.timeline, { ts: s.now, text }] } : a) })),
  ack: (id, who = 'Operator · J. Adel') => { if (!get().guard()) return; set(s => ({ alarms: s.alarms.map(a => a.id === id && a.state === 'active' ? { ...a, state: 'ack', assignee: a.assignee || who, timeline: [...a.timeline, { ts: s.now, text: `Acknowledged by ${who}` }] } : a) })) },
  assign: (id, team) => { if (!get().guard()) return; set(s => ({ alarms: s.alarms.map(a => a.id === id ? { ...a, assignee: team, timeline: [...a.timeline, { ts: s.now, text: `Work order assigned to ${team}` }] } : a) })) },
  resolve: (id) => {
    if (!get().guard()) return
    set(s => {
      const a = s.alarms.find(x => x.id === id)
      const status = { ...s.status }
      if (a?.dev && ['alarm', 'warn', 'fault', 'offline'].includes(status[a.dev]) && !a.scenario) status[a.dev] = 'ok'
      return { status, alarms: s.alarms.map(x => x.id === id ? { ...x, state: 'resolved', timeline: [...x.timeline, { ts: s.now, text: 'Resolved & closed' }] } : x) }
    })
  },
  ackAll: () => { if (!get().guard()) return; set(s => ({ alarms: s.alarms.map(a => a.state === 'active' ? { ...a, state: 'ack', timeline: [...a.timeline, { ts: s.now, text: 'Acknowledged (bulk)' }] } : a) })) },

  triggerScenario: (key) => {
    const s = get()
    if (s.mode !== 'sim') { s.toast('Switch to Simulation mode to inject scenarios', 'warn'); return }
    if (s.scenarios[key]) return
    const fx = scenarioEffects(key, s.now)
    if (!s.simAuto) fx.alarms.forEach(a => { a.timeline = [...a.timeline, { ts: s.now, text: 'Manual mode — automatic response held for operator' }] })
    const patch = { scenarios: { ...s.scenarios, [key]: s.now }, alarms: [...fx.alarms, ...s.alarms], status: { ...s.status, ...fx.status } }
    if (key === 'intrusion') patch.events = [{ ...mkEvent(s.now, Math.random, DEV['DOOR-L1-03']), user: 'Unknown (card RF-3A77)', result: 'Denied', reason: 'Card suspended' }, { ...mkEvent(s.now, Math.random, DEV['DOOR-L1-05']), user: '—', result: 'Forced', reason: 'Door forced open', cred: '—' }, ...s.events]
    set(patch)
    if (fx.focus) set(st => ({ level: fx.focus.level, device: fx.focus.dev, focusTick: st.focusTick + 1, openAlarm: fx.alarms[0].id }))
    s.toast(`Scenario injected: ${SCENARIOS[key].name}`, 'crit')
    if (s.simAuto) get().applyResponse(key)
  },
  clearScenario: (key) => {
    set(s => {
      const fx = scenarioEffects(key, s.now)
      const status = { ...s.status }
      const r = RESPONSES[key] || { status: {} }
      Object.keys({ ...fx.status, ...r.status }).forEach(k => { status[k] = status0[k] })
      const sc = { ...s.scenarios }; delete sc[key]
      const responded = { ...s.responded }; delete responded[key]
      const patch = { scenarios: sc, responded, status, alarms: s.alarms.map(a => a.scenario === key && a.state !== 'resolved' ? { ...a, state: 'resolved', timeline: [...a.timeline, { ts: s.now, text: 'Scenario reset — normal conditions restored' }] } : a) }
      if (r.esv) patch.esv = { ...s.esv, ...Object.fromEntries(Object.keys(r.esv).map(k => [k, 'open'])) }
      if (r.setpoints) { const sp = { ...s.setpoints }; Object.keys(r.setpoints).forEach(k => delete sp[k]); patch.setpoints = sp }
      if (key === 'fire') patch.lifts = { A: 0, B: 4 }
      if (key === 'fire') patch.doors = Object.fromEntries(Object.entries(s.doors).map(([k, v]) => [k, v.mode === 'Fire release' ? { ...v, locked: true, mode: 'Scheduled' } : v]))
      return patch
    })
  },

  // ---- commands ----
  doorCmd: (id, cmd) => {
    if (!get().guard()) return
    set(s => {
      const d = s.doors[id]
      const nd = cmd === 'unlock' ? { ...d, locked: false, mode: 'Manual unlock' } : cmd === 'lock' ? { ...d, locked: true, mode: 'Manual lock' } : cmd === 'pulse' ? { ...d, locked: false, mode: 'Momentary (5 s)' } : { ...d, locked: true, mode: 'Scheduled' }
      return { doors: { ...s.doors, [id]: nd }, events: [{ id: 'C' + s.now + id, ts: s.now, user: 'Operator · J. Adel', door: id, doorName: DEV[id].name, level: DEV[id].level, cred: 'Remote command', dir: '—', result: cmd === 'lock' ? 'Locked' : cmd === 'auto' ? 'Schedule' : 'Unlocked', reason: 'Remote command' }, ...s.events] }
    })
    if (cmd === 'pulse') setTimeout(() => set(s => ({ doors: { ...s.doors, [id]: { ...s.doors[id], locked: true, mode: 'Scheduled' } } })), 5000)
    get().toast(`${DEV[id].name}: ${cmd === 'pulse' ? 'momentary unlock sent' : cmd === 'auto' ? 'returned to schedule' : cmd + 'ed'}`)
  },
  userCmd: (id, patch) => { if (!get().guard()) return; set(s => ({ users: s.users.map(u => u.id === id ? { ...u, ...patch } : u) })) },
  setSetpoint: (lv, v) => { if (!get().guard()) return; set(s => ({ setpoints: { ...s.setpoints, [lv]: Math.max(18, Math.min(27, v)) } })) },
  setLighting: (lv, v) => { if (!get().guard()) return; set(s => ({ lighting: { ...s.lighting, [lv]: v } })); get().toast(`Lighting ${LEVEL[lv].name}: ${v}`) },
  setHvac: (lv, v) => { if (!get().guard()) return; set(s => ({ hvac: { ...s.hvac, [lv]: v } })); get().toast(`HVAC ${LEVEL[lv].name}: ${v}`) },
  setEsv: (id, v) => {
    if (!get().guard()) return
    if (v === 'open' && get().scenarios.gasLeak && id === 'ESV-GF-01') { get().toast('Interlock: gas detector still above threshold — cannot reopen', 'crit'); return }
    set(s => ({ esv: { ...s.esv, [id]: v } })); get().toast(`${DEV[id].name}: ${v === 'open' ? 'opened' : 'closed'}`, v === 'closed' ? 'warn' : 'info')
  },
  setPump: (id, v) => { if (!get().guard()) return; set(s => ({ pumps: { ...s.pumps, [id]: v } })); get().toast(`${DEV[id].name}: ${v}`) },
  setRec: (id, v) => { if (!get().guard()) return; set(s => ({ rec: { ...s.rec, [id]: v } })) },
  setDevStatus: (id, v) => { if (!get().guard()) return; set(s => ({ status: { ...s.status, [id]: v } })); get().toast(`${DEV[id].name}: ${v === 'maint' ? 'placed in maintenance' : 'returned to service'}`) },

  // ---- clock ----
  step: () => {
    const s = get()
    if (s.mode === 'offline' || (s.mode === 'sim' && s.paused)) return
    const now = s.mode === 'live' ? Date.now() : s.now + 1000 * s.speed
    const patch = { now, tick: s.tick + 1 }
    // access events stream
    const n = s.mode === 'live' ? (Math.random() < 0.55 ? 1 : 0) : Math.min(6, Math.round(s.speed / 40 * Math.random()))
    if (n) { const ev = []; for (let i = 0; i < n; i++) ev.push(mkEvent(now - i * 3000)); patch.events = [...ev, ...s.events].slice(0, 400) }
    // lifts move
    if (!s.scenarios.fire) patch.lifts = { A: Math.max(0, Math.min(6, s.lifts.A + (Math.random() < 0.5 ? -1 : 1))), B: Math.max(0, Math.min(6, s.lifts.B + (Math.random() < 0.5 ? -1 : 1))) }
    // rare random minor alarm in live mode
    if (Math.random() < (s.mode === 'live' ? 0.012 : 0.03)) {
      const pool = [
        { sev: 'minor', dev: 'DOOR-GF-04', title: 'Tailgating suspected', desc: 'Two persons passed turnstile on a single badge (video analytics).' },
        { sev: 'minor', dev: 'IAQ-L2-03', title: 'CO₂ above 1000 ppm', desc: 'Meeting room ventilation insufficient. Demand-controlled ventilation increased damper to 80 %.' },
        { sev: 'minor', dev: 'PUMP-B1-03', title: 'Booster pump vibration high', desc: 'Vibration 7.2 mm/s (alert 7.1). Inspect bearings.' },
        { sev: 'minor', dev: 'CAMERA-GF-08', title: 'Motion in restricted area after hours', desc: 'Loading bay motion detected by video analytics.' },
      ]
      const a = pick(pool)
      if (!s.alarms.some(x => x.dev === a.dev && x.state !== 'resolved')) patch.alarms = [mkAlarm(a, now), ...s.alarms]
    }
    set(patch)
  },
}))

// Derived helpers
export const sevRank = { critical: 0, major: 1, minor: 2 }
export const activeAlarms = (alarms) => alarms.filter(a => a.state !== 'resolved').sort((a, b) => sevRank[a.sev] - sevRank[b.sev] || b.ts - a.ts)
export const scFlags = (scenarios) => Object.fromEntries(Object.keys(scenarios).map(k => [k, true]))
export const zoneLabel = (z) => z ? `${z.split('-')[0]} · ${ZONE_NAMES[z.split('-')[1]]}` : '—'
export const levelName = (id) => LEVEL[id]?.name || id
export const DOOR_LIST = DOORS
export const devHash = (id) => hstr(id)
if (import.meta.env.DEV) window.__store = useStore
