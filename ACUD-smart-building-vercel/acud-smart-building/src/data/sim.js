// Deterministic simulation engine. Every value is a pure function of simulated time
// (plus active scenario flags), so charts, KPIs and the twin always agree.
import { LEVELS, DEVICES } from './building'

export const hash = (n) => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
export const hstr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0) / 4294967296 }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
// smooth value-noise in [-1,1]; x in arbitrary units
export function vnoise(seed, x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f)
  const a = hash(i * 13.7 + seed * 101.3), b = hash((i + 1) * 13.7 + seed * 101.3)
  return (a + (b - a) * u) * 2 - 1
}
const MIN = 60000, HOUR = 3600000, DAY = 86400000
export { MIN, HOUR, DAY }

export const hourOf = (t) => { const d = new Date(t); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 }
export const isWeekend = (t) => { const g = new Date(t).getDay(); return g === 5 || g === 6 } // Fri/Sat (Egypt)

// Office occupancy profile 0..1
export function occ(t) {
  const h = hourOf(t)
  let o
  if (h < 6.5) o = 0.03
  else if (h < 9) o = 0.03 + 0.85 * smooth((h - 6.5) / 2.5)
  else if (h < 12.5) o = 0.88
  else if (h < 14) o = 0.74
  else if (h < 16.5) o = 0.86
  else if (h < 19.5) o = 0.86 - 0.8 * smooth((h - 16.5) / 3)
  else o = 0.05
  if (isWeekend(t)) o *= 0.14
  return Math.max(0, Math.min(1, o + 0.03 * vnoise(7, t / (20 * MIN))))
}
function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x) }
export const outdoorT = (t) => { const h = hourOf(t); return 26 + 7 * Math.sin((h - 9) / 24 * 2 * Math.PI) + 1.2 * vnoise(3, t / HOUR) }

// Floor load weights (kW at full occupancy) and base loads
const FLOOR_BASE = { B1: 38, GF: 46, L1: 210, L2: 22, L3: 22, L4: 22, L5: 18, RF: 30 }
const FLOOR_OCC = { B1: 30, GF: 120, L1: 40, L2: 150, L3: 150, L4: 145, L5: 110, RF: 260 }
export const TARIFF = { kwh: 2.33, peakKwh: 3.1, demand: 95, water: 18.5, gas: 4.75 } // EGP

export const occK = (sc = {}) => (sc.highOcc ? 1.32 : 1)
export function electricity(t, sc = {}) {
  const o = occ(t) * occK(sc), T = outdoorT(t), cool = Math.max(0, (T - 22) / 12)
  const floors = {}
  let total = 0
  for (const L of LEVELS) {
    let kw = FLOOR_BASE[L.id] + FLOOR_OCC[L.id] * (L.id === 'RF' ? 0.35 + 0.65 * cool * (0.4 + 0.6 * o) : o)
    if (L.id === 'L1') kw += (sc.dcOverheat ? 18 : 0)
    if (sc.fire && L.id === 'RF') kw *= 0.55
    if (sc.hvacOverload && L.id === 'RF') kw *= 1.38
    if (sc.equipFail && L.id === 'RF') kw *= 0.82
    kw *= 1 + 0.035 * vnoise(hstr(L.id) * 99, t / (6 * MIN))
    floors[L.id] = kw; total += kw
  }
  const h = hourOf(t)
  const pv = Math.max(0, Math.sin((h - 6) / 13 * Math.PI)) * 152 * (0.85 + 0.15 * vnoise(11, t / (15 * MIN)))
  const pf = 0.93 + 0.025 * vnoise(5, t / (30 * MIN)) - 0.03 * cool
  const grid = sc.powerFail ? 0 : Math.max(0, total - pv)
  const kva = total / pf, kvar = Math.sqrt(kva * kva - total * total)
  const v = sc.powerFail ? 0 : 400 + 5 * vnoise(8, t / (2 * MIN))
  const i = sc.powerFail ? 0 : grid * 1000 / (Math.sqrt(3) * v * pf)
  return {
    kw: total, grid, pv, kvar, kva, pf, v, vln: v / Math.sqrt(3), i, hz: sc.powerFail ? 50 + 0.08 * vnoise(9, t / 1000) : 50 + 0.03 * vnoise(9, t / MIN),
    thd: 3.1 + 0.9 * o + 0.4 * vnoise(10, t / (10 * MIN)), floors, gen: sc.powerFail ? total : 0,
    upsLoad: (FLOOR_BASE.L1 + 40 * o + (sc.dcOverheat ? 18 : 0)), unbalance: 1.2 + 0.5 * vnoise(12, t / HOUR),
    tx1: 0.48 * grid / 1600 * 100 / 0.95, tx2: 0.52 * grid / 1600 * 100 / 0.95,
  }
}

export function water(t, sc = {}) {
  const o = occ(t), h = hourOf(t)
  const lunch = Math.exp(-Math.pow((h - 13) / 1.1, 2))
  const floors = {}
  let total = 0
  for (const L of LEVELS) {
    let q = { B1: 0.25, GF: 0.6 + 2.6 * lunch, L1: 0.35, L2: 1.4, L3: 1.4, L4: 1.35, L5: 0.9, RF: 0.9 }[L.id]
    q *= L.id === 'B1' || L.id === 'RF' ? (0.6 + 0.4 * o) : (0.06 + o)
    if (sc.waterLeak && L.id === 'L4') q += 2.8
    q *= 1 + 0.08 * vnoise(hstr(L.id) * 51, t / (5 * MIN))
    floors[L.id] = Math.max(0, q); total += floors[L.id]
  }
  const cycle = (t / (95 * MIN)) % 1
  const gt1 = 64 + 18 * Math.sin(t / (7 * HOUR)) - (sc.waterLeak ? 6 : 0)
  const roof = 45 + 40 * (cycle < 0.7 ? 1 - cycle / 0.7 : (cycle - 0.7) / 0.3)
  const tp1On = cycle >= 0.7
  return {
    flow: total, floors, pressure: 3.6 + 0.25 * vnoise(21, t / (3 * MIN)) - 0.2 * o - (sc.waterLeak ? 0.45 : 0),
    supplyP: 2.1 + 0.15 * vnoise(22, t / (8 * MIN)),
    tanks: { 'TANK-B1-01': gt1, 'TANK-B1-02': 96 + 2 * vnoise(23, t / HOUR), 'TANK-RF-01': roof },
    pumps: { 'PUMP-B1-01': tp1On ? 'run' : 'standby', 'PUMP-B1-02': 'standby', 'PUMP-B1-03': 'run', 'PUMP-B1-04': sc.fire ? 'run' : 'standby', 'PUMP-B1-05': hash(Math.floor(t / (40 * MIN))) > 0.8 ? 'run' : 'standby' },
    leakFlow: sc.waterLeak ? 2.8 : 0,
  }
}

export function gas(t, sc = {}) {
  const h = hourOf(t), o = occ(t)
  const kitchen = sc.gasLeak ? 0 : (h > 7 && h < 16 ? 4 + 9 * Math.exp(-Math.pow((h - 12) / 1.6, 2)) : 0.3) * (isWeekend(t) ? 0.2 : 1)
  const boiler = (2 + 6 * Math.exp(-Math.pow((h - 7.5) / 1.4, 2)) + 3 * o) * (1 + 0.06 * vnoise(31, t / (7 * MIN)))
  const k = kitchen * (1 + 0.1 * vnoise(32, t / (4 * MIN)))
  return {
    flow: k + boiler, kitchen: k, boiler, pressure: sc.gasLeak ? 18.2 : 21 + 0.4 * vnoise(33, t / (5 * MIN)),
    inlet: 1.02 + 0.02 * vnoise(34, t / (20 * MIN)), // bar
    lel: { kitchen: sc.gasLeak ? 34 + 6 * vnoise(35, t / 20000) : Math.max(0, 0.6 + 0.6 * vnoise(36, t / (9 * MIN))), boiler: Math.max(0, 0.4 + 0.5 * vnoise(37, t / (9 * MIN))), meter: Math.max(0, 0.3 + 0.4 * vnoise(38, t / (9 * MIN))) },
    co: 6 + 10 * o + 4 * vnoise(39, t / (6 * MIN)),
  }
}

export function climate(t, setpoints = {}, sc = {}) {
  const o = occ(t) * occK(sc), T = outdoorT(t)
  const out = {}
  for (const L of LEVELS) {
    const sp = setpoints[L.id] ?? (L.id === 'L1' ? 21 : 22.5)
    const s = hstr(L.id) * 77
    let temp = sp + 0.4 + 0.8 * o * (T - 24) / 10 + 0.35 * vnoise(s, t / (12 * MIN))
    if (L.id === 'RF') temp = T
    if (L.id === 'B1') temp = 27 + 0.5 * vnoise(s, t / HOUR)
    if (sc.fire && ['L3', 'L4'].includes(L.id)) temp += 1.8
    if (sc.hvacOverload && ['GF', 'L2', 'L3', 'L4', 'L5'].includes(L.id)) temp += 2.3 * (0.5 + 0.5 * Math.min(1, o))
    if (sc.equipFail && ['L3', 'L4', 'L5'].includes(L.id)) temp += 1.1 * Math.min(1, o)
    out[L.id] = {
      temp, rh: 46 + 6 * vnoise(s + 1, t / (25 * MIN)) + 4 * o, co2: 430 + 520 * o * (L.id === 'GF' ? 0.8 : 1) + 25 * vnoise(s + 2, t / (8 * MIN)),
      pm25: 9 + 4 * vnoise(s + 3, t / (30 * MIN)), occ: L.id === 'RF' || L.id === 'B1' ? 0.05 * o : o * (0.85 + 0.15 * hash(s)),
      sp, voc: 180 + 160 * o + 30 * vnoise(s + 4, t / (11 * MIN)),
    }
  }
  return out
}

export const RACKS = DEVICES.filter(d => d.type === 'rack')
export function datacenter(t, sc = {}) {
  const o = occ(t)
  const racks = {}
  let it = 0
  RACKS.forEach((r, i) => {
    const s = i * 17 + 3
    const hot = sc.dcOverheat && r.rack.startsWith('B') && parseInt(r.rack.slice(1)) >= 5
    const cpu = Math.max(4, Math.min(99, 32 + 38 * hash(s) + 22 * o + 9 * vnoise(s, t / (4 * MIN))))
    const kw = 3.2 + 6 * hash(s + 1) + cpu * 0.04
    const inlet = 22 + 1.6 * hash(s + 2) + 0.5 * vnoise(s + 3, t / (6 * MIN)) + (hot ? 8.5 + 2 * vnoise(s + 9, t / MIN) : 0) + (r.rack === 'B4' ? 3.6 : 0)
    racks[r.rack] = { cpu, mem: 45 + 35 * hash(s + 4) + 6 * vnoise(s + 5, t / (15 * MIN)), kw, inlet, outlet: inlet + 9 + kw * 0.6, storage: 38 + 50 * hash(s + 6), u: 24 + Math.floor(16 * hash(s + 7)) }
    it += kw
  })
  const pue = 1.38 + 0.08 * vnoise(41, t / HOUR) + (sc.dcOverheat ? 0.12 : 0)
  return {
    racks, it, pue, facility: it * pue, upsA: { load: 0.52 * it / 450 * 100, batt: sc.powerFail ? 86 : 100, runtime: sc.powerFail ? 21 : 34, mode: sc.powerFail ? 'Battery' : 'Online' },
    upsB: { load: 0.48 * it / 450 * 100, batt: sc.powerFail ? 87 : 100, runtime: sc.powerFail ? 22 : 35, mode: sc.powerFail ? 'Battery' : 'Online' },
    crah: { 'CRAH-1': { on: true, supply: 18.2 + 0.3 * vnoise(42, t / MIN), fan: 62 }, 'CRAH-2': { on: !sc.dcOverheat, supply: sc.dcOverheat ? 0 : 18.4 + 0.3 * vnoise(43, t / MIN), fan: sc.dcOverheat ? 0 : 60 }, 'CRAH-3': { on: true, supply: 18.0 + 0.3 * vnoise(44, t / MIN), fan: sc.dcOverheat ? 96 : 58 } },
    storage: { used: 612, total: 980 }, rh: 45 + 3 * vnoise(45, t / HOUR),
  }
}

export function network(t, sc = {}) {
  const o = occ(t)
  return {
    wanIn: 640 + 980 * o + 120 * vnoise(51, t / MIN), wanOut: 280 + 420 * o + 60 * vnoise(52, t / MIN), // Mbps
    latency: 7.5 + 3 * o + 1.5 * vnoise(53, t / (2 * MIN)) + (sc.netDown ? 14 : 0), loss: Math.max(0, 0.02 + 0.03 * vnoise(54, t / (3 * MIN))) + (sc.netDown ? 1.8 : 0),
    wifiClients: Math.round(40 + 920 * o + 20 * vnoise(55, t / (5 * MIN))), jitter: 1.1 + 0.6 * vnoise(56, t / MIN),
  }
}

// Sample a metric over a window ending at t
export function series(fn, t, hours = 24, stepMin = 15) {
  const n = Math.round(hours * 60 / stepMin), out = []
  for (let i = n; i >= 0; i--) { const ti = t - i * stepMin * MIN; out.push({ t: ti, v: fn(ti) }) }
  return out
}
// Daily totals (integrated hourly) for the last `days` days ending today
const dayCache = new Map()
export function dailyTotals(key, fn, t, days) {
  const end = new Date(t); end.setHours(0, 0, 0, 0)
  const out = []
  for (let d = days - 1; d >= 0; d--) {
    const start = end.getTime() - d * DAY
    const ck = key + start
    let v = dayCache.get(ck)
    if (v === undefined || d === 0) {
      v = 0
      const lim = d === 0 ? Math.min(24, Math.floor((t - start) / HOUR) + 1) : 24
      for (let h = 0; h < lim; h++) v += fn(start + h * HOUR + 30 * MIN)
      if (d !== 0) dayCache.set(ck, v)
    }
    out.push({ t: start, v })
  }
  return out
}

// ---------- HVAC plant (chillers, cooling towers, AHUs, VAV/FCU terminals) ----------
export const CH_CAP = 800 // TR per chiller
export const AHU_SERVE = { 'AHU-RF-01': ['L1', 'L2'], 'AHU-RF-02': ['L3', 'L4'], 'AHU-RF-03': ['L5', 'GF'] }
const AHU_NOM = { 'AHU-RF-01': 22000, 'AHU-RF-02': 26000, 'AHU-RF-03': 18000 } // m³/h
export function hvac(t, sc = {}, setpoints = {}, plant = {}) {
  const o = occ(t) * occK(sc), T = outdoorT(t), cool = Math.max(0, (T - 18) / 16)
  const auto = plant.auto !== false
  let load = 230 + 640 * Math.min(1.3, o) * (0.45 + 0.55 * cool) + 35 * vnoise(61, t / (10 * MIN))
  if (sc.hvacOverload) load += 560
  if (sc.fire) load *= 0.8
  const ids = ['CHILLER-RF-01', 'CHILLER-RF-02']
  const avail = { 'CHILLER-RF-01': !sc.powerFail, 'CHILLER-RF-02': !sc.equipFail && !sc.powerFail }
  const want = auto
    ? { 'CHILLER-RF-01': true, 'CHILLER-RF-02': load > CH_CAP * 0.82 || !avail['CHILLER-RF-01'] }
    : { 'CHILLER-RF-01': plant['CHILLER-RF-01'] !== 'off', 'CHILLER-RF-02': plant['CHILLER-RF-02'] === 'on' }
  const run = Object.fromEntries(ids.map(k => [k, want[k] && avail[k]]))
  const n = ids.filter(k => run[k]).length, cap = n * CH_CAP
  const served = Math.min(load, cap), deficit = Math.max(0, load - cap), pl = n ? served / cap : 0
  const chws = n ? 6.6 + 0.12 * vnoise(62, t / MIN) + 5.5 * deficit / Math.max(1, load) : 13 + 0.2 * vnoise(62, t / MIN)
  const chwr = chws + (n ? 5.4 * pl : 0.6)
  const kwtr = 0.56 + 0.22 * Math.max(0, pl - 0.82) + 0.03 * vnoise(63, t / (5 * MIN))
  const chillers = Object.fromEntries(ids.map((k, i) => [k, {
    run: run[k], avail: avail[k], want: want[k], load: run[k] ? pl * 100 : 0, tr: run[k] ? served / n : 0, kw: run[k] ? served / n * kwtr : 0,
    chws: run[k] ? chws : null, chwr: run[k] ? chwr : null, cond: run[k] ? 29.5 + 4.5 * pl + 0.2 * (T - 30) : null, hours: 21800 + i * 2300 + Math.floor(t / HOUR) % 1000,
  }]))
  const towers = Object.fromEntries(['TOWER-RF-01', 'TOWER-RF-02'].map((k, i) => {
    const on = run[ids[i]] || (n === 1 && pl > 0.75), fan = on ? 35 + 60 * pl : 0, cwIn = 30 + 4 * pl + 0.2 * (T - 30)
    return [k, { run: on, fan, cwIn: on ? cwIn : null, cwOut: on ? cwIn - 5 : null, kw: on ? 2 + 28 * (fan / 100) ** 3 : 0 }]
  }))
  const cl = climate(t, setpoints, sc)
  const ahus = Object.fromEntries(Object.keys(AHU_SERVE).map((k, i) => {
    const forced = plant[k], on = forced === 'off' ? false : !(sc.fire && k === 'AHU-RF-02') && !sc.powerFail
    const fl = AHU_SERVE[k], ro = fl.reduce((a, L) => a + cl[L].occ, 0) / fl.length
    const flow = on ? AHU_NOM[k] * Math.min(1, forced === 'max' ? 1 : 0.42 + 0.55 * Math.min(1.1, ro) + (sc.highOcc ? 0.1 : 0)) : 0
    return [k, {
      run: on, flow, nom: AHU_NOM[k], fan: on ? flow / AHU_NOM[k] * 100 : 0, sat: on ? chws + 6.4 + (deficit ? 2.8 : 0) + 0.15 * vnoise(70 + i, t / MIN) : null, satSp: 13,
      rat: fl.reduce((a, L) => a + cl[L].temp, 0) / fl.length, oa: on ? Math.min(100, 20 + 55 * ro + (sc.highOcc ? 25 : 0)) : 0, dp: 140 + 70 * hash(i + 3) + 8 * vnoise(75 + i, t / HOUR),
      kw: on ? 4 + 38 * (flow / AHU_NOM[k]) ** 3 : 0, serves: fl,
      mode: sc.fire && k === 'AHU-RF-02' ? 'Fire shutdown' : sc.powerFail ? 'Load shed' : forced === 'off' ? 'Manual off' : forced === 'max' ? 'Manual 100 %' : 'Auto',
    }]
  }))
  const vav = {}
  DEVICES.filter(d => d.type === 'fcu').forEach(d => {
    const c = cl[d.level], h = hstr(d.id), temp = c.temp + (h - 0.5) * 1.2 + 0.15 * vnoise(h * 50, t / (6 * MIN)), err = temp - c.sp
    const dem = Math.max(0, Math.min(1, (err + 0.6) / 2.4))
    vav[d.id] = { temp, sp: c.sp, flow: Math.round(70 + 330 * dem), valve: Math.round(100 * dem), damper: Math.round(25 + 75 * dem), err }
  })
  const pumpsKw = n * 22 + (n ? 15 : 0)
  const kw = served * kwtr + Object.values(towers).reduce((a, x) => a + x.kw, 0) + Object.values(ahus).reduce((a, x) => a + x.kw, 0) + pumpsKw
  return { auto, load, cap, served, deficit, pl, n, chws, chwr, kwtr, cop: 3.517 / kwtr, kw, oat: T, chillers, towers, ahus, vav, run }
}
