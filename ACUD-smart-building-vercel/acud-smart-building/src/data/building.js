// ACUD template building model (configurable until official drawings are issued): levels, rooms, devices.
// Units are metres. Footprint 64 × 32 m, centred on the origin. 1 level = 4.2 m.

export const FLOOR_H = 4.2
export const FOOT = { w: 64, d: 32, rFront: 14, rBack: 3 }

export const SYSTEMS = {
  bms:    { name: 'BMS',             full: 'Building Management',       color: '#6f8f5a' },
  access: { name: 'Access',          full: 'Access Control',            color: '#8a6d9e' },
  fire:   { name: 'Fire',            full: 'Fire Alarm & Life Safety',  color: '#c4553f' },
  cctv:   { name: 'CCTV',            full: 'Video Surveillance',        color: '#4f7a92' },
  dc:     { name: 'Data Center',     full: 'Data Center',               color: '#5a6f8f' },
  nms:    { name: 'NMS',             full: 'Network Management',        color: '#c98a2e' },
  elec:   { name: 'Electricity',     full: 'Electricity Management',    color: '#d49b2a' },
  water:  { name: 'Water',           full: 'Water Management',          color: '#3f86a8' },
  gas:    { name: 'Gas',             full: 'Gas Management',            color: '#b0703a' },
}

export const TYPES = {
  smoke: ['fire', 'Smoke detector'], heat: ['fire', 'Heat detector'], mcp: ['fire', 'Manual call point'],
  sounder: ['fire', 'Sounder / strobe'], sprinkler: ['fire', 'Sprinkler zone valve'], fm200: ['fire', 'FM-200 suppression'],
  facp: ['fire', 'Fire alarm control panel'], exit: ['fire', 'Emergency exit'],
  camera: ['cctv', 'IP camera'], nvr: ['cctv', 'Network video recorder'],
  door: ['access', 'Access-controlled door'],
  ap: ['nms', 'Wireless access point'], switch: ['nms', 'Access switch'], core: ['nms', 'Core switch'],
  router: ['nms', 'Edge router'], firewall: ['nms', 'Firewall'],
  rack: ['dc', 'Server rack'], ups: ['dc', 'UPS module'], crac: ['dc', 'CRAH unit'], pdu: ['dc', 'Floor PDU'],
  ahu: ['bms', 'Air handling unit'], fcu: ['bms', 'Fan coil / VAV'], chiller: ['bms', 'Chiller'], tower: ['bms', 'Cooling tower'],
  iaq: ['bms', 'IAQ sensor'], light: ['bms', 'Lighting controller'], lift: ['bms', 'Elevator'],
  transformer: ['elec', 'Transformer'], mdb: ['elec', 'Main LV switchboard'], smdb: ['elec', 'Sub-main DB'],
  generator: ['elec', 'Standby generator'], pv: ['elec', 'Solar PV inverter'], emeter: ['elec', 'Energy meter'],
  tank: ['water', 'Water tank'], pump: ['water', 'Pump set'], wmeter: ['water', 'Water meter'], leak: ['water', 'Leak sensor'],
  gmeter: ['gas', 'Gas meter'], gdet: ['gas', 'Gas detector'], esv: ['gas', 'Emergency shut-off valve'], boiler: ['gas', 'Gas boiler'],
  burner: ['gas', 'Kitchen gas line'],
}

const r = (name, type, x0, z0, x1, z1) => ({ name, type, x0, z0, x1, z1 })
const core = () => [r('Core · Lifts & Stairs', 'core', -6, -15, 6, -1.5)]

const OFFICE = (lv) => [
  r('Open Office A', 'office', -30, 1.5, -6, 15),
  r('Open Office B', 'office', -6, 1.5, 24, 14),
  r('Meeting Suite', 'meeting', -30, -15, -18, -1.5),
  r(`IDF & Electrical ${lv}`, 'idf', -18, -15, -6, -1.5),
  ...core(),
  r('Pantry', 'pantry', 6, -15, 14, -1.5),
  r('Private Offices', 'office', 14, -15, 30, -1.5),
]

export const LEVELS = [
  { id: 'B1', name: 'Basement', use: 'Plant · Parking', rooms: [
    r('Main LV Room', 'elec', -30, -15, -14, -1.5), r('Transformer Room', 'tx', -14, -15, -6, -1.5), ...core(),
    r('Generator Room', 'gen', 6, -15, 18, -1.5), r('Gas Meter Room', 'gasroom', 18, -15, 30, -1.5),
    r('Water Tank Room', 'tank', -30, 1.5, -8, 15), r('Pump Room', 'pump', -8, 1.5, 6, 15), r('Car Park', 'park', 6, 1.5, 24, 14),
  ]},
  { id: 'GF', name: 'Ground Floor', use: 'Lobby · Security', rooms: [
    r('Security Control Room', 'security', -30, 1.5, -12, 15), r('Main Lobby', 'lobby', -12, 1.5, 14, 15), r('Fire Command Centre', 'fcc', 14, 1.5, 24, 14),
    r('Cafeteria Kitchen', 'kitchen', -30, -15, -14, -1.5), r('Loading & Mail', 'loading', -14, -15, -6, -1.5), ...core(),
    r('Retail', 'retail', 6, -15, 30, -1.5),
  ]},
  { id: 'L1', name: 'Level 1', use: 'Data Center · NOC', rooms: [
    r('Data Hall', 'datahall', -30, -15, -6, -1.5), ...core(), r('UPS & Battery Room', 'ups', 6, -15, 18, -1.5), r('Main Distribution Frame', 'mdf', 18, -15, 30, -1.5),
    r('Network Operations Centre', 'noc', -30, 1.5, -8, 15), r('DC Electrical Room', 'elec', -8, 1.5, 4, 15), r('IT Offices', 'office', 4, 1.5, 24, 14),
  ]},
  { id: 'L2', name: 'Level 2', use: 'Offices', rooms: OFFICE('L2') },
  { id: 'L3', name: 'Level 3', use: 'Offices', rooms: OFFICE('L3') },
  { id: 'L4', name: 'Level 4', use: 'Offices', rooms: OFFICE('L4') },
  { id: 'L5', name: 'Level 5', use: 'Executive', rooms: [
    r('Boardroom', 'meeting', -30, 1.5, -10, 15), r('Executive Suite', 'exec', -10, 1.5, 24, 14),
    r('Exec Meeting', 'meeting', -30, -15, -18, -1.5), r('IDF & Electrical L5', 'idf', -18, -15, -6, -1.5), ...core(),
    r('Exec Pantry', 'pantry', 6, -15, 14, -1.5), r('Directors Offices', 'office', 14, -15, 30, -1.5),
  ]},
  { id: 'RF', name: 'Roof', use: 'Mechanical · Solar', rooms: [
    r('Boiler Room', 'boiler', -30, -15, -18, -1.5), r('Chiller Plant', 'chiller', -18, -15, -6, -1.5), r('Stair & Lift Overrun', 'core', -6, -15, 6, -1.5),
    r('Roof Water Tank', 'rtank', 6, -15, 14, -1.5), r('AHU Deck', 'ahu', 14, -15, 30, -1.5),
    r('Cooling Towers', 'towers', -30, 1.5, -10, 15), r('Solar PV Array', 'pv', -10, 1.5, 24, 14),
  ]},
]
LEVELS.forEach((l, i) => { l.index = i; l.y = i * FLOOR_H; l.rooms.forEach((rm, j) => { rm.id = `${l.id}-R${j + 1}`; rm.level = l.id; rm.cx = (rm.x0 + rm.x1) / 2; rm.cz = (rm.z0 + rm.z1) / 2 }) })
export const LEVEL = Object.fromEntries(LEVELS.map(l => [l.id, l]))

export const zoneOf = (x, z) => (z < 0 ? (x < 0 ? 'Z1' : 'Z2') : (x < 0 ? 'Z3' : 'Z4'))
export const ZONE_NAMES = { Z1: 'North-West', Z2: 'North-East', Z3: 'South-West', Z4: 'South-East' }

// ---------- devices ----------
export const DEVICES = []
const counters = {}
function dev(level, type, x, z, extra = {}) {
  const key = `${type}-${level}`
  counters[key] = (counters[key] || 0) + 1
  const n = String(counters[key]).padStart(2, '0')
  const [sys, label] = TYPES[type]
  const room = LEVEL[level].rooms.find(rm => x >= rm.x0 && x <= rm.x1 && z >= rm.z0 && z <= rm.z1)
  const d = {
    id: `${type.toUpperCase()}-${level}-${n}`, type, sys, level, x, z, zone: `${level}-${zoneOf(x, z)}`,
    room: room ? room.name : 'Corridor', name: `${label} ${level}-${n}`, ...extra,
  }
  DEVICES.push(d)
  return d
}

for (const L of LEVELS) {
  const lv = L.id
  // Fire detection: grid inside every room
  for (const rm of L.rooms) {
    const isHot = ['kitchen', 'gen', 'boiler', 'park'].includes(rm.type)
    const nx = Math.max(1, Math.round((rm.x1 - rm.x0) / 11)), nz = Math.max(1, Math.round((rm.z1 - rm.z0) / 11))
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (lv === 'RF' && ['towers', 'pv', 'ahu'].includes(rm.type)) continue
      dev(lv, isHot ? 'heat' : 'smoke', rm.x0 + (i + 0.5) * (rm.x1 - rm.x0) / nx, rm.z0 + (j + 0.5) * (rm.z1 - rm.z0) / nz)
    }
  }
  if (lv !== 'RF') {
    dev(lv, 'mcp', -29, 0.5); dev(lv, 'mcp', 27, 0.5)
    dev(lv, 'sounder', -15, 0); dev(lv, 'sounder', 14, 0)
    dev(lv, 'sprinkler', -4, -2.5)
    dev(lv, 'exit', -31.5, 0, { name: `West exit stair ${lv}` }); dev(lv, 'exit', 29.5, 0, { name: `East exit stair ${lv}` })
    dev(lv, 'lift', -3, -8, { name: `Lift car A` }); dev(lv, 'lift', 3, -8, { name: `Lift car B` })
    // CCTV in corridors
    dev(lv, 'camera', -28, 0, { fov: 0 }); dev(lv, 'camera', 26, 0, { fov: Math.PI })
    // Network & IT
    if (!['B1', 'RF'].includes(lv)) { dev(lv, 'ap', -18, 8); dev(lv, 'ap', 8, 8); dev(lv, 'ap', 22, -8) }
    // Stair doors
    dev(lv, 'door', -30.5, 0, { name: `West stair door ${lv}` }); dev(lv, 'door', 28.5, 0, { name: `East stair door ${lv}` })
    // Leak sensors at riser
    dev(lv, 'leak', 5, -3)
    dev(lv, 'emeter', -12, -4, { name: `Floor energy meter ${lv}` })
    dev(lv, 'wmeter', 4, -3.5, { name: `Floor water meter ${lv}` })
  }
  // Room-specific equipment
  for (const rm of L.rooms) {
    const { cx, cz } = rm
    switch (rm.type) {
      case 'office': case 'exec':
        dev(lv, 'fcu', cx - 5, cz); dev(lv, 'fcu', cx + 5, cz); dev(lv, 'iaq', cx, cz + 2)
        dev(lv, 'light', cx, cz - 3); break
      case 'meeting': dev(lv, 'fcu', cx, cz); dev(lv, 'iaq', cx + 2, cz + 2); dev(lv, 'door', cx, rm.z0 > 0 ? rm.z0 : rm.z1, { name: `${rm.name} door` }); break
      case 'idf': dev(lv, 'switch', cx - 2, cz, { name: `Access switch ${lv}-A` }); dev(lv, 'switch', cx + 2, cz, { name: `Access switch ${lv}-B` })
        dev(lv, 'smdb', cx, cz + 4, { name: `SMDB-${lv}` }); dev(lv, 'door', cx, rm.z1, { name: `IDF door ${lv}` }); break
      case 'pantry': dev(lv, 'leak', cx, cz); dev(lv, 'fcu', cx, cz + 3); break
      case 'elec':
        if (lv === 'B1') { dev(lv, 'mdb', cx - 3, cz, { name: 'Main LV Switchboard MDB-1' }); dev(lv, 'mdb', cx + 3, cz, { name: 'Main LV Switchboard MDB-2' }) }
        else dev(lv, 'smdb', cx, cz, { name: 'DC Switchboard DCB-1' })
        dev(lv, 'door', cx, lv === 'B1' ? rm.z1 : rm.z0, { name: `${rm.name} door` }); break
      case 'tx': dev(lv, 'transformer', cx, cz - 4, { name: 'Transformer TR-1 1600 kVA' }); dev(lv, 'transformer', cx, cz + 3, { name: 'Transformer TR-2 1600 kVA' }); break
      case 'gen': dev(lv, 'generator', cx, cz, { name: 'Standby Generator G-1 1250 kVA' }); dev(lv, 'door', cx, rm.z1, { name: 'Generator room door' }); break
      case 'gasroom': dev(lv, 'gmeter', cx - 3, cz, { name: 'Main Gas Meter GM-1' }); dev(lv, 'esv', cx + 3, cz - 3, { name: 'Main Emergency Shut-off Valve ESV-1' })
        dev(lv, 'gdet', cx, cz + 4); dev(lv, 'gdet', cx + 4, cz + 4); break
      case 'tank': dev(lv, 'tank', cx - 5, cz, { name: 'Ground Tank GT-1 (domestic)', cap: 250 }); dev(lv, 'tank', cx + 5, cz, { name: 'Ground Tank GT-2 (fire reserve)', cap: 300 }); break
      case 'pump': dev(lv, 'pump', cx - 4, cz - 3, { name: 'Transfer Pump TP-1' }); dev(lv, 'pump', cx, cz - 3, { name: 'Transfer Pump TP-2' })
        dev(lv, 'pump', cx + 4, cz - 3, { name: 'Booster Set BP-1' }); dev(lv, 'pump', cx - 2, cz + 4, { name: 'Fire Pump FP-1 (electric)' }); dev(lv, 'pump', cx + 3, cz + 4, { name: 'Fire Jockey Pump JP-1' })
        dev(lv, 'wmeter', cx - 5, cz + 5, { name: 'Utility Water Meter WM-0' }); dev(lv, 'leak', cx, cz); break
      case 'park': dev(lv, 'camera', cx, cz + 5, { fov: Math.PI / 2 }); dev(lv, 'camera', cx - 6, cz - 4, { fov: 0 }); dev(lv, 'gdet', cx, cz, { name: 'CO detector car park' }); dev(lv, 'door', 24, 8, { name: 'Car park barrier' }); break
      case 'security': dev(lv, 'nvr', cx - 3, cz, { name: 'NVR-1 (192 ch)' }); dev(lv, 'nvr', cx + 3, cz, { name: 'NVR-2 (192 ch)' }); dev(lv, 'camera', cx, cz + 5, { fov: -Math.PI / 2 }); dev(lv, 'door', rm.x1, cz, { name: 'Security room door' }); break
      case 'lobby': dev(lv, 'door', cx - 4, 15, { name: 'Main entrance turnstile 1' }); dev(lv, 'door', cx + 4, 15, { name: 'Main entrance turnstile 2' })
        dev(lv, 'camera', cx - 8, 13, { fov: -Math.PI / 2 }); dev(lv, 'camera', cx + 8, 13, { fov: -Math.PI / 2 }); dev(lv, 'camera', cx, cz - 2, { fov: Math.PI / 2 })
        dev(lv, 'iaq', cx, cz); dev(lv, 'light', cx + 3, cz); dev(lv, 'fcu', cx - 6, cz); dev(lv, 'fcu', cx + 6, cz); break
      case 'fcc': dev(lv, 'facp', cx, cz, { name: 'Main Fire Alarm Panel FACP-1' }); dev(lv, 'door', rm.x0, cz, { name: 'Fire command centre door' }); break
      case 'kitchen': dev(lv, 'burner', cx, cz, { name: 'Kitchen gas line KL-1' }); dev(lv, 'gdet', cx - 4, cz); dev(lv, 'gdet', cx + 4, cz)
        dev(lv, 'esv', cx + 6, cz - 4, { name: 'Kitchen Shut-off Valve ESV-2' }); dev(lv, 'gmeter', cx - 6, cz - 4, { name: 'Kitchen Gas Sub-meter GM-2' }); dev(lv, 'camera', cx, cz + 4, { fov: Math.PI }); break
      case 'loading': dev(lv, 'door', cx, rm.z0, { name: 'Loading bay roller door' }); dev(lv, 'camera', cx, cz, { fov: -Math.PI / 2 }); break
      case 'retail': dev(lv, 'fcu', cx, cz); dev(lv, 'light', cx + 4, cz); dev(lv, 'emeter', cx - 4, cz, { name: 'Retail tenant meter' }); break
      case 'datahall': {
        let k = 0
        for (const row of [-11, -5.5]) for (let i = 0; i < 8; i++) {
          k++; dev(lv, 'rack', -27 + i * 2.6, row, { name: `Rack ${row < -8 ? 'A' : 'B'}${i + 1}`, rack: `${row < -8 ? 'A' : 'B'}${i + 1}` })
        }
        dev(lv, 'crac', -29, -8.25, { name: 'CRAH-1' }); dev(lv, 'crac', -7.5, -8.25, { name: 'CRAH-2' }); dev(lv, 'crac', -18, -14, { name: 'CRAH-3' })
        dev(lv, 'pdu', -18, -2.5, { name: 'Floor PDU-A' }); dev(lv, 'pdu', -12, -2.5, { name: 'Floor PDU-B' })
        dev(lv, 'fm200', -24, -2.5, { name: 'FM-200 Data Hall' }); dev(lv, 'door', -18, -1.5, { name: 'Data hall mantrap' })
        dev(lv, 'camera', -29, -2.5, { fov: 0 }); dev(lv, 'camera', -7, -14, { fov: Math.PI }); dev(lv, 'leak', -18, -8)
        break
      }
      case 'ups': dev(lv, 'ups', cx - 3, cz - 3, { name: 'UPS-A 500 kVA' }); dev(lv, 'ups', cx + 3, cz - 3, { name: 'UPS-B 500 kVA' })
        dev(lv, 'door', cx, rm.z1, { name: 'UPS room door' }); dev(lv, 'fm200', cx, cz + 4, { name: 'FM-200 UPS Room' }); break
      case 'mdf': dev(lv, 'core', cx - 3, cz - 2, { name: 'Core Switch CS-1' }); dev(lv, 'core', cx + 3, cz - 2, { name: 'Core Switch CS-2' })
        dev(lv, 'firewall', cx - 3, cz + 3, { name: 'Firewall FW-1' }); dev(lv, 'firewall', cx + 3, cz + 3, { name: 'Firewall FW-2' })
        dev(lv, 'router', cx - 3, cz + 6, { name: 'Edge Router ER-1' }); dev(lv, 'router', cx + 3, cz + 6, { name: 'Edge Router ER-2' })
        dev(lv, 'door', cx, rm.z1, { name: 'MDF door' }); break
      case 'noc': dev(lv, 'camera', cx, cz, { fov: Math.PI / 2 }); dev(lv, 'door', rm.x1, 3, { name: 'NOC door' }); dev(lv, 'fcu', cx - 4, cz); dev(lv, 'iaq', cx + 4, cz); break
      case 'boiler': dev(lv, 'boiler', cx - 2, cz - 3, { name: 'Gas Boiler B-1 (DHW)' }); dev(lv, 'boiler', cx + 2, cz - 3, { name: 'Gas Boiler B-2 (DHW)' })
        dev(lv, 'gdet', cx, cz + 4); dev(lv, 'esv', cx + 4, cz + 4, { name: 'Boiler Shut-off Valve ESV-3' }); dev(lv, 'gmeter', cx - 4, cz + 4, { name: 'Boiler Gas Sub-meter GM-3' }); break
      case 'chiller': dev(lv, 'chiller', cx, cz - 4, { name: 'Chiller CH-1 800 TR' }); dev(lv, 'chiller', cx, cz + 3, { name: 'Chiller CH-2 800 TR' }); break
      case 'rtank': dev(lv, 'tank', cx, cz, { name: 'Roof Tank RT-1', cap: 60 }); break
      case 'ahu': dev(lv, 'ahu', cx - 4, cz - 4, { name: 'AHU-1 (L1–L2)' }); dev(lv, 'ahu', cx + 4, cz - 4, { name: 'AHU-2 (L3–L4)' }); dev(lv, 'ahu', cx, cz + 4, { name: 'AHU-3 (L5 / Lobby)' }); break
      case 'towers': dev(lv, 'tower', cx - 4, cz, { name: 'Cooling Tower CT-1' }); dev(lv, 'tower', cx + 4, cz, { name: 'Cooling Tower CT-2' }); break
      case 'pv': dev(lv, 'pv', cx, cz, { name: 'PV Inverter INV-1 (180 kWp)' }); dev(lv, 'camera', cx + 10, cz, { fov: Math.PI }); break
    }
  }
}

export const DEV = Object.fromEntries(DEVICES.map(d => [d.id, d]))
export const devicesOf = (sys, level) => DEVICES.filter(d => (!sys || d.sys === sys) && (!level || d.level === level))
export const levelY = (lv) => LEVEL[lv].y
