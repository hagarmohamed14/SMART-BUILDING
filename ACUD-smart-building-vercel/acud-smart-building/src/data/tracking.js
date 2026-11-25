// Employee movement tracking (simulated). Every active cardholder gets a deterministic daily
// itinerary built from the template floor plan and its access-controlled doors: entry
// turnstile / car-park door → lift → home area → department visits → lunch → meetings → exit.
// Positions are template-layout coordinates, NOT surveyed locations.
import { LEVELS, LEVEL, DEVICES } from './building'
import { hstr } from './sim'

const HOUR = 3600e3
const DOORS = DEVICES.filter(d => d.type === 'door')
const roomBy = (lv, name) => LEVEL[lv].rooms.find(r => r.name === name || r.name.startsWith(name))
const doorFor = (lv, room) => DOORS.find(d => d.level === lv && (d.name.startsWith(room.name) || d.room === room.name))
const LIFT = { x: -3, z: -8 }
const BARRIER = DOORS.find(d => d.name === 'Car park barrier')

export const dayStart = (now) => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime() }

function homeOf(u, r) {
  if (/IT/.test(u.dept)) return ['L1', 'IT Offices']
  if (/Security/.test(u.dept)) return ['GF', 'Security Control Room']
  if (/Executive/.test(u.dept)) return ['L5', 'Executive Suite']
  if (/Facilities/.test(u.dept)) return ['GF', 'Fire Command Centre']
  const lv = ['L2', 'L3', 'L4'][Math.floor(r('home') * 3)]
  return [lv, r('wing') < 0.5 ? 'Open Office A' : 'Open Office B']
}
function deptVisit(u, r) {
  if (/IT/.test(u.dept)) return ['L1', r('v') < 0.6 ? 'Data Hall' : 'Main Distribution Frame']
  if (/Facilities/.test(u.dept)) return r('v') < 0.5 ? ['B1', 'Generator Room'] : ['B1', 'Main LV Room']
  if (/Security/.test(u.dept)) return ['GF', 'Loading & Mail']
  if (/Executive/.test(u.dept)) return ['L5', 'Boardroom']
  return [['L2', 'L3', 'L4'][Math.floor(r('mv') * 3)], 'Meeting Suite']
}

/** Full-day itinerary for a user. Steps sorted by time; `t` in ms. */
export function itinerary(u, now) {
  const d0 = dayStart(now), seed = u.id + d0, r = (k) => hstr(seed + k)
  if (u.status !== 'Active' || r('off') < 0.1) return { steps: [], absent: u.status !== 'Active' ? u.status : 'Not scheduled today' }
  const steps = []
  let cur = null
  const at = (h) => d0 + h * HOUR
  const go = (t, lv, roomName, kind = 'move', extra = {}) => {
    const room = roomBy(lv, roomName); if (!room) return
    if (cur && cur.level !== lv) { // floor change via lift lobby readers
      steps.push({ t: t - 150e3, kind: 'lift', level: cur.level, room: { name: `Lift lobby ${cur.level}` }, x: LIFT.x, z: LIFT.z, door: 'Lift call reader', reader: 'RFID', note: `Lift to ${lv}` })
      steps.push({ t: t - 60e3, kind: 'lift', level: lv, room: { name: `Lift lobby ${lv}` }, x: LIFT.x + 1.5, z: LIFT.z, door: 'Lift landing', reader: '—', note: `Arrived from ${cur.level}` })
    }
    const dr = doorFor(lv, room)
    const s = { t, kind, level: lv, room, x: room.cx + (r(roomName + t) - 0.5) * (room.x1 - room.x0) * 0.4, z: room.cz + (r(roomName + 'z' + t) - 0.5) * (room.z1 - room.z0) * 0.35,
      door: dr ? dr.name : null, doorId: dr ? dr.id : null, dx: dr ? dr.x : null, dz: dr ? dr.z : null, reader: dr ? (/Data hall|MDF|UPS/.test(dr.name) ? 'Biometric + RFID' : 'RFID') : '—', ...extra }
    steps.push(s); cur = s
  }
  const arrive = 7.3 + 2.0 * r('a'), byCar = r('car') < 0.35, gate = r('gate') < 0.5 ? 1 : 2
  const [hl, hr] = homeOf(u, r)
  // entry
  if (byCar) go(at(arrive), 'B1', 'Car Park', 'entry', { door: 'Car park barrier', doorId: BARRIER?.id, dx: BARRIER?.x, dz: BARRIER?.z, reader: 'ANPR + RFID' })
  else {
    const lob = roomBy('GF', 'Main Lobby'), tsl = DOORS.find(d => d.name === `Main entrance turnstile ${gate}`)
    const s = { t: at(arrive), kind: 'entry', level: 'GF', room: lob, x: tsl ? tsl.x : lob.cx, z: tsl ? tsl.z - 1 : lob.cz, door: tsl ? tsl.name : 'Main entrance', doorId: tsl?.id, reader: 'QR + RFID' }
    steps.push(s); cur = s
  }
  go(at(arrive + 0.1), hl, hr, 'move')
  const [vl, vr] = deptVisit(u, r), v0 = 9.7 + r('vt') * 1.1
  go(at(v0), vl, vr); go(at(v0 + 0.5 + r('vd') * 0.6), hl, hr)
  const l0 = 12.6 + r('lt') * 0.8
  go(at(l0), 'GF', 'Retail', 'move', { label: 'Café · Retail' }); go(at(l0 + 0.45 + r('ld') * 0.35), hl, hr)
  if (r('pm') < 0.65) { const ml = /Executive/.test(u.dept) ? 'L5' : ['L2', 'L3', 'L4'][Math.floor(r('pml') * 3)], m0 = 14.4 + r('pmt') * 1.2
    go(at(m0), ml, ml === 'L5' ? 'Exec Meeting' : 'Meeting Suite'); go(at(m0 + 0.6 + r('pmd') * 0.5), hl, hr) }
  // exit through the same way they came in
  const out = arrive + 8.3 + r('x') * 0.9
  if (byCar) go(at(out), 'B1', 'Car Park', 'exit', { door: 'Car park barrier', doorId: BARRIER?.id, dx: BARRIER?.x, dz: BARRIER?.z, reader: 'ANPR + RFID' })
  else { const lob = roomBy('GF', 'Main Lobby'), tsl = DOORS.find(d => d.name === `Main entrance turnstile ${gate}`)
    if (cur.level !== 'GF') go(at(out - 0.02), 'GF', 'Main Lobby')
    steps.push({ t: at(out), kind: 'exit', level: 'GF', room: lob, x: tsl ? tsl.x : lob.cx, z: tsl ? tsl.z - 1 : lob.cz, door: tsl ? tsl.name : 'Main entrance', doorId: tsl?.id, reader: 'QR + RFID' }) }
  steps.sort((a, b) => a.t - b.t)
  return { steps, absent: null }
}

/** Live state of a user at `now`. */
export function trackState(u, now) {
  const it = itinerary(u, now), past = it.steps.filter(s => s.t <= now)
  const entry = it.steps.find(s => s.kind === 'entry'), exit = it.steps.find(s => s.kind === 'exit')
  const cur = past[past.length - 1] || null
  const inside = !!(entry && entry.t <= now && !(exit && exit.t <= now))
  const left = !!(exit && exit.t <= now)
  const timeIn = entry && entry.t <= now ? (left ? exit.t : now) - entry.t : 0
  return { ...it, past, entry, exit, cur, inside, left, timeIn, doorsPassed: past.filter(s => s.door).length,
    status: it.absent ? 'absent' : inside ? 'inside' : left ? 'left' : 'expected' }
}

export const fmtDur = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m` }
export const placeName = (s) => (s ? s.label || s.room.name : '—')
export const PLAN_LEVELS = LEVELS.map(l => l.id)
