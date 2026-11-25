import { useEffect, useRef } from 'react'
import { hstr } from '../data/sim'
import { useStore } from '../data/store'

// Simulated camera feeds (no real streams are connected):
//  - each camera is a still frame of a matching space, with a 5-second seamless loop of
//    animated pedestrians walking along the floor in that frame's perspective,
//    entering/exiting through doors, turnstiles and corridors;
//  - overlays: camera ID, location, timestamp, LIVE / PLAYBACK, REC, PTZ zoom, AI person boxes.
//  - Real clips can replace the simulation: list them in public/cams/clips.json, e.g.
//    { "lobby": "lobby.mp4", "park": "parking.mp4" }  (keys = camera kind). They are drawn
//    instead of the still + simulated people.
const cache = {}
const load = (src) => { if (!cache[src]) { const i = new Image(); i.src = src; cache[src] = i } return cache[src] }
let CLIPS = null
const clipsReady = fetch('./cams/clips.json').then(r => (r.ok ? r.json() : {})).catch(() => ({})).then(j => (CLIPS = j || {}))
const videos = {}
const loadVideo = (src) => {
  if (!videos[src]) { const v = document.createElement('video'); v.src = src; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.play().catch(() => {}); videos[src] = v }
  return videos[src]
}

// photo + base crop (fractions of the image) per camera kind; several framings per kind
const SRC = {
  lobby: [['./cams/lobby-acud.jpg', 0, 0, 1, 1], ['./cams/lobby.jpg', 0, 0, 1, 1], ['./cams/entrance.jpg', 0, 0, 1, 1]],
  entrance: [['./cams/entrance-top.jpg', 0, 0, 1, 1], ['./cams/lobby-acud.jpg', 0.35, 0.1, 0.65, 0.7]],
  corridor: [['./cams/corridor.jpg', 0, 0, 1, 1], ['./cams/elevators.jpg', 0, 0, 1, 1], ['./cams/office.jpg', 0, 0, 1, 1], ['./cams/office.jpg', 0.25, 0.1, 0.75, 0.8]],
  park: [['./cams/parking.jpg', 0, 0, 1, 1], ['./cams/parking.jpg', 0.3, 0.15, 0.7, 0.8]],
  security: [['./cams/security.jpg', 0, 0, 1, 1]],
  cafe: [['./cams/cafeteria.jpg', 0, 0, 1, 1]],
  dock: [['./cams/gate.jpg', 0, 0, 1, 1]],
  dc: [['./cams/server.jpg', 0, 0, 1, 1], ['./cams/datacenter.jpg', 0, 0, 1, 1]],
  noc: [['./cams/security.jpg', 0.2, 0, 0.8, 0.85]],
  roof: [['./building.jpeg', 0.47, 0.02, 0.32, 0.3]],
}

// Walk lanes per photo, in image fractions (feet positions): [x0, y0, x1, y1, people, carry]
// hz/s give perspective: person height = s * (y - hz) of the image height. top = overhead view.
const SCENE = {
  'lobby-acud.jpg': { hz: 0.45, s: 0.82, lanes: [[0.96, 0.69, 0.48, 0.72, 1], [0.63, 0.62, 0.72, 0.93, 1, 1], [0.86, 0.94, 0.77, 0.64, 1], [0.3, 0.83, 0.97, 0.87, 1]] },
  'lobby.jpg': { hz: 0.42, s: 0.85, lanes: [[0.47, 0.58, 0.55, 0.92, 1, 1], [0.92, 0.62, 0.56, 0.63, 1], [0.76, 0.93, 0.63, 0.6, 1]] },
  'entrance.jpg': { hz: 0.46, s: 0.9, lanes: [[0.43, 0.6, 0.37, 0.93, 1, 1], [0.6, 0.6, 0.68, 0.93, 1], [0.52, 0.94, 0.55, 0.6, 1]] },
  'entrance-top.jpg': { top: 0.21, lanes: [[0.3, -0.06, 0.36, 1.06, 2, 1], [0.56, 1.06, 0.46, -0.06, 1], [0.76, 0.15, 0.62, 1.06, 1]] },
  'corridor.jpg': { hz: 0.38, s: 0.95, lanes: [[0.5, 0.55, 0.43, 0.9, 1, 1], [0.62, 0.92, 0.56, 0.52, 1], [0.58, 0.5, 0.64, 0.62, 1]] },
  'elevators.jpg': { hz: 0.3, s: 0.8, lanes: [[0.04, 0.86, 0.96, 0.89, 1, 1], [0.96, 0.95, 0.3, 0.93, 1]] },
  'office.jpg': { hz: 0.45, s: 0.9, lanes: [[0.96, 0.62, 0.5, 0.63, 1], [0.22, 0.9, 0.44, 0.66, 1, 1]] },
  'parking.jpg': { hz: 0.45, s: 0.85, lanes: [[0.3, 0.93, 0.45, 0.63, 1, 1], [0.96, 0.76, 0.56, 0.71, 1]] },
  'security.jpg': { hz: 0.3, s: 0.62, lanes: [[0.5, 1.02, 0.99, 1.0, 1]] },
  'cafeteria.jpg': { hz: 0.33, s: 1.1, lanes: [[0.96, 0.5, 0.56, 0.48, 1], [0.04, 0.6, 0.44, 0.58, 1]] },
  'gate.jpg': { hz: 0.45, s: 0.88, lanes: [[0.36, 0.62, 0.31, 0.93, 1, 1], [0.56, 0.94, 0.61, 0.62, 1], [0.76, 0.62, 0.82, 0.93, 1]] },
  'datacenter.jpg': { hz: 0.4, s: 0.8, lanes: [[0.72, 0.92, 0.8, 0.56, 1]] },
  'server.jpg': { hz: 0.35, s: 0.85, lanes: [[0.56, 0.93, 0.6, 0.56, 1]] },
  'building.jpeg': { hz: 0, s: 0, fixed: 0.035, lanes: [[0.52, 0.2, 0.72, 0.16, 1]] },
}
const LOOP = 5000, STRIDES = 9 // 9 full strides per 5 s loop → seamless
const OUTFIT = [['#1f2733', '#e8e4dc', '#22252b'], ['#3a3f4a', '#dfe8f2', '#2a2d33'], ['#6b5a48', '#f2ede4', '#3a3027'], ['#24324a', '#ffffff', '#1d2430'],
  ['#8a8f99', '#2e3440', '#30343b'], ['#e9e2d4', '#c9b9a0', '#2b2b2b'], ['#4a2f2f', '#efe6da', '#252020'], ['#2f4a3f', '#e9efe9', '#202826']]
const SKIN = ['#c99b7a', '#a87b5c', '#e0b896', '#8d5e43', '#d2a383']
const HAIR = ['#1c1714', '#2b211b', '#3d2c22', '#141414', '#5a4636']

export const camKind = (d) => /Lobby/.test(d.room) ? 'lobby' : /Car Park/.test(d.room) ? 'park' : /Solar/.test(d.room) ? 'roof' : /Loading/.test(d.room) ? 'dock'
  : /Security/.test(d.room) ? 'security' : /Cafeteria/.test(d.room) ? 'cafe' : /Data Hall/.test(d.room) ? 'dc' : /Network Operations/.test(d.room) ? 'noc'
  : d.level === 'GF' ? 'entrance' : 'corridor'
// round-robin framings within each kind so neighbouring tiles differ
const ORDER = {}
const kindIdx = (d) => { const k = camKind(d); ORDER[k] = ORDER[k] || []; let i = ORDER[k].indexOf(d.id); if (i < 0) { ORDER[k].push(d.id); i = ORDER[k].length - 1 } return i }
const pickSrc = (d) => { let list = SRC[camKind(d)]; if (camKind(d) === 'corridor' && ['B1', 'L1'].includes(d.level)) list = list.slice(0, 2); return list[kindIdx(d) % list.length] }
export const camThumb = (d) => pickSrc(d)[0]
const NAMES = { lobby: 'Main Lobby', entrance: 'Entrance', corridor: 'Corridor', park: 'Parking Area', security: 'Security Room', cafe: 'Cafeteria', dock: 'Loading Gate', dc: 'Data Center', noc: 'NOC', roof: 'Roof / PV' }
export const camName = (d) => { const k = camKind(d), s = pickSrc(d)[0]; return k === 'corridor' ? `${/office/.test(s) ? 'Office Floor' : /elevator/.test(s) ? 'Elevators' : 'Corridor'} · ${d.level}` : `${NAMES[k]}${['lobby', 'park', 'dc', 'entrance'].includes(k) ? ' · ' + d.id.slice(-2) : ''}` }

// people currently visible on a camera (for counters): deterministic from the same loop
export const camPeople = (d, t = performance.now()) => {
  const sc = SCENE[pickSrc(d)[0].split('/').pop()]; if (!sc) return 0
  const tau = (t % LOOP) / LOOP
  return sc.lanes.reduce((n, L, li) => { for (let k = 0; k < (L[4] || 1); k++) { const p = (tau + hstr(d.id + li + k) + k / (L[4] || 1)) % 1; if (p > 0.04 && p < 0.96) n++ } return n }, 0)
}

function person(ctx, x, y, H, dx, dy, phase, o, alpha) {
  const [jacket, shirt, pants] = OUTFIT[o % OUTFIT.length], skin = SKIN[o % SKIN.length], hair = HAIR[(o >> 1) % HAIR.length]
  const lat = Math.min(1, Math.abs(dx) / (Math.abs(dx) + Math.abs(dy) + 1e-6) * 1.4), dir = dx >= 0 ? 1 : -1
  const sw = Math.sin(phase), sw2 = Math.cos(phase)
  const bob = Math.abs(sw2) * H * 0.012
  ctx.save(); ctx.globalAlpha = alpha * 0.94; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  // floor shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y, H * 0.17, H * 0.035, 0, 0, 7); ctx.fill()
  const hipY = y - H * 0.48 - bob, shY = y - H * 0.82 - bob, headY = y - H * 0.905 - bob
  // legs: lateral swing for side walking, alternate step depth for toward/away
  const step = H * 0.13 * lat, depth = H * 0.025 * (1 - lat)
  const legs = [[-1, sw], [1, -sw]]
  const shade = (c, a) => { const g = ctx.createLinearGradient(x - H * 0.14, 0, x + H * 0.14, 0); g.addColorStop(0, c); g.addColorStop(0.55, c); g.addColorStop(1, `rgba(0,0,0,${a})`); return g }
  ctx.strokeStyle = pants; ctx.lineWidth = H * 0.072
  legs.forEach(([s, w]) => { ctx.beginPath(); ctx.moveTo(x + s * H * 0.04, hipY); ctx.lineTo(x + s * H * 0.045 * (1 - lat) + w * step * dir, y - H * 0.02 + w * depth); ctx.stroke() })
  ctx.fillStyle = '#121212'; legs.forEach(([s, w]) => { ctx.beginPath(); ctx.ellipse(x + s * H * 0.045 * (1 - lat) + w * step * dir + dir * lat * H * 0.02, y - H * 0.01 + w * depth, H * 0.035, H * 0.016, 0, 0, 7); ctx.fill() })
  // back arm (behind torso)
  ctx.strokeStyle = jacket; ctx.lineWidth = H * 0.055
  ctx.beginPath(); ctx.moveTo(x - H * 0.1 * (1 - lat), shY + H * 0.03); ctx.lineTo(x - H * 0.12 * (1 - lat) + sw * H * 0.1 * lat * dir, hipY + H * 0.02); ctx.stroke()
  // torso
  ctx.fillStyle = jacket; ctx.beginPath()
  const torsoFill = ctx.createLinearGradient(x - H * 0.13, shY, x + H * 0.13, hipY); torsoFill.addColorStop(0, jacket); torsoFill.addColorStop(0.5, jacket); torsoFill.addColorStop(1, '#0b0d10')
  ctx.fillStyle = torsoFill
  const sh = H * (0.13 - 0.04 * lat), hp = H * (0.1 - 0.03 * lat)
  ctx.moveTo(x - sh, shY + H * 0.02); ctx.quadraticCurveTo(x, shY - H * 0.03, x + sh, shY + H * 0.02)
  ctx.lineTo(x + hp, hipY + H * 0.03); ctx.lineTo(x - hp, hipY + H * 0.03); ctx.closePath(); ctx.fill()
  if (lat < 0.7) { ctx.fillStyle = shirt; ctx.beginPath(); ctx.moveTo(x - H * 0.03, shY); ctx.lineTo(x + H * 0.03, shY); ctx.lineTo(x, shY + H * 0.12); ctx.closePath(); ctx.fill() }
  // front arm
  ctx.strokeStyle = jacket; ctx.lineWidth = H * 0.055
  const hx = x + H * 0.11 * (1 - lat) - sw * H * 0.1 * lat * dir, hy = hipY + H * 0.03
  ctx.beginPath(); ctx.moveTo(x + H * 0.1 * (1 - lat), shY + H * 0.03); ctx.lineTo(hx, hy); ctx.stroke()
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, hy + H * 0.01, H * 0.022, 0, 7); ctx.fill()
  if (o % 3 === 0) { ctx.fillStyle = '#1b1b1b'; ctx.fillRect(hx - H * 0.045, hy + H * 0.02, H * 0.09, H * 0.075) } // briefcase
  // neck + head + hair
  ctx.fillStyle = skin; ctx.fillRect(x - H * 0.018, shY - H * 0.035, H * 0.036, H * 0.04)
  ctx.fillStyle = shade(skin, 0.35); ctx.beginPath(); ctx.ellipse(x, headY, H * 0.046, H * 0.058, 0, 0, 7); ctx.fill()
  ctx.fillStyle = hair; ctx.beginPath()
  if (o % 4 === 1) { ctx.ellipse(x, headY - H * 0.01, H * 0.056, H * 0.066, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(x - H * 0.056, headY - H * 0.01, H * 0.02, H * 0.09); ctx.fillRect(x + H * 0.036, headY - H * 0.01, H * 0.02, H * 0.09) }
  else { ctx.ellipse(x, headY - H * 0.02, H * 0.05, H * 0.045, 0, Math.PI, 0); ctx.fill() }
  ctx.restore()
}
function personTop(ctx, x, y, S, dx, dy, phase, o, alpha) {
  const [jacket] = OUTFIT[o % OUTFIT.length], hair = HAIR[o % HAIR.length], ang = Math.atan2(dy, dx), sw = Math.sin(phase)
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(ang)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(S * 0.08, S * 0.05, S * 0.32, S * 0.2, 0, 0, 7); ctx.fill()
  ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.ellipse(sw * S * 0.22, -S * 0.08, S * 0.08, S * 0.05, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(-sw * S * 0.22, S * 0.08, S * 0.08, S * 0.05, 0, 0, 7); ctx.fill()
  ctx.fillStyle = jacket; ctx.beginPath(); ctx.ellipse(0, 0, S * 0.13, S * 0.27, 0, 0, 7); ctx.fill()
  ctx.beginPath(); ctx.ellipse(-sw * S * 0.1, -S * 0.27, S * 0.07, S * 0.05, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(sw * S * 0.1, S * 0.27, S * 0.07, S * 0.05, 0, 0, 7); ctx.fill()
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(S * 0.02, 0, S * 0.1, 0, 7); ctx.fill()
  ctx.restore()
}

export default function CamFeed({ d, offline, night, motion, big, ai, ptz, playTs, rec = true }) {
  const ref = useRef(), live = useRef({})
  live.current = { ai, ptz, playTs, rec, motion }
  useEffect(() => {
    const cv = ref.current
    const fit = () => { const r = cv.getBoundingClientRect(); if (r.width < 20 || r.height < 20) return
      const sc = Math.min(window.devicePixelRatio || 1, 1.5), cap = big ? 1600 : 900, w = Math.min(cap, Math.round(r.width * sc)), hgt = Math.round(w * r.height / r.width)
      if (cv.width !== w || cv.height !== hgt) { cv.width = w; cv.height = hgt } }
    const ro = new ResizeObserver(fit); ro.observe(cv); fit()
    return () => ro.disconnect()
  }, [big])
  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext('2d')
    const h = hstr(d.id), [src, fx, fy, fw, fh] = pickSrc(d), img = load(src), kind = camKind(d)
    const scene = SCENE[src.split('/').pop()] || { lanes: [] }
    let clip = null; clipsReady.then(() => { if (CLIPS && CLIPS[kind]) clip = loadVideo('./cams/' + CLIPS[kind]) })
    const loc = `${d.level} · ${d.room}`
    let raf, last = 0
    const grain = document.createElement('canvas'); grain.width = 160; grain.height = 90
    const gctx = grain.getContext('2d')
    const draw = (t) => {
      raf = requestAnimationFrame(draw)
      if (t - last < (big ? 33 : 40)) return
      last = t
      const W = cv.width, H = cv.height, L = live.current
      const media = clip && clip.readyState >= 2 ? clip : img
      const IW = media.videoWidth || media.naturalWidth, IH = media.videoHeight || media.naturalHeight
      ctx.save()
      if (offline || !IW) {
        ctx.fillStyle = '#26282c'; ctx.fillRect(0, 0, W, H)
        for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2) }
        ctx.fillStyle = '#efe7da'; ctx.font = `600 ${big ? 18 : 12}px "IBM Plex Mono", monospace`; ctx.textAlign = 'center'
        ctx.fillText(offline ? 'NO SIGNAL' : 'CONNECTING…', W / 2, H / 2)
        ctx.restore(); return
      }
      const isClip = media !== img
      const pz = L.ptz || { x: 0, y: 0, z: 1 }
      const drift = isClip ? 0 : Math.sin(t / 9000 + h * 10) * 0.02
      const z = (isClip ? 1 : 1 + 0.025 * Math.sin(t / 13000 + h * 5)) * pz.z
      const [bfx, bfy, bfw, bfh] = isClip ? [0, 0, 1, 1] : [fx, fy, fw, fh]
      let sw = IW * bfw / z, sh = IH * bfh / z
      if (sw / sh > W / H) sw = sh * W / H; else sh = sw * H / W
      const bx = IW * bfx, by = IH * bfy, bw = IW * bfw, bh = IH * bfh
      let sx = bx + (bw - sw) / 2 + (drift + pz.x * 0.5) * (bw - sw), sy = by + (bh - sh) / 2 + pz.y * 0.5 * (bh - sh)
      sx = Math.max(0, Math.min(IW - sw, sx)); sy = Math.max(0, Math.min(IH - sh, sy))
      const filt = night ? 'grayscale(1) brightness(1.1) contrast(1.15)' : L.playTs ? 'saturate(0.8) sepia(0.12)' : 'none'
      ctx.filter = filt
      ctx.drawImage(media, sx, sy, sw, sh, 0, 0, W, H)
      // simulated pedestrians — 5 s seamless loop, projected through the same crop/PTZ
      const boxes = []
      if (!isClip) {
        const toX = (fxp) => (fxp * IW - sx) / sw * W, toY = (fyp) => (fyp * IH - sy) / sh * H, k = H / sh
        const tau = ((t + (L.playTs || 0)) % LOOP) / LOOP
        const ppl = []
        scene.lanes.forEach((Ln, li) => {
          const [x0, y0, x1, y1, n = 1] = Ln
          for (let j = 0; j < n; j++) {
            const ph = hstr(d.id + li + j), p = (tau + ph + j / n) % 1
            const fxp = x0 + (x1 - x0) * p, fyp = y0 + (y1 - y0) * p
            const alpha = Math.min(1, p / 0.08, (1 - p) / 0.08)
            const o = Math.floor(hstr(d.id + 'o' + li + j) * 97)
            const size = scene.top ? scene.top * IH * k : scene.fixed ? scene.fixed * IH * k : Math.max(0, scene.s * (fyp - scene.hz)) * IH * k
            ppl.push({ x: toX(fxp), y: toY(fyp), size, dx: (x1 - x0) * IW, dy: (y1 - y0) * IH, phase: 2 * Math.PI * (STRIDES * (tau + ph)), o, alpha })
          }
        })
        ppl.sort((a, b) => a.y - b.y)
        ctx.filter = (filt === 'none' ? '' : filt + ' ') + `blur(${big ? 0.9 : 0.6}px) saturate(0.8)`
        ppl.forEach(P => {
          if (P.size < 3 || P.alpha <= 0) return
          if (scene.top) personTop(ctx, P.x, P.y, P.size, P.dx, P.dy, P.phase, P.o, P.alpha)
          else person(ctx, P.x, P.y, P.size, P.dx, P.dy, P.phase, P.o, P.alpha)
          if (P.alpha > 0.6) boxes.push(scene.top ? [P.x - P.size * 0.35, P.y - P.size * 0.35, P.size * 0.7, P.size * 0.7, P.o] : [P.x - P.size * 0.2, P.y - P.size, P.size * 0.4, P.size, P.o])
        })
      }
      ctx.restore()
      // grain + vignette
      const id = gctx.createImageData(160, 90)
      for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 14 }
      gctx.putImageData(id, 0, 0); ctx.drawImage(grain, 0, 0, W, H)
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      const fs = W > 700 ? 12 : 9
      // AI analytics: boxes track the walking people; motion mode outlines them in amber
      if ((L.ai || L.motion) && boxes.length) {
        ctx.lineWidth = big ? 2 : 1.3; ctx.font = `600 ${fs}px "IBM Plex Mono", monospace`; ctx.textAlign = 'left'
        boxes.forEach(([x, y, w, hh, o]) => {
          ctx.strokeStyle = ctx.fillStyle = L.ai ? '#5fd4ff' : '#f0b44c'; ctx.strokeRect(x, y, w, hh)
          if (L.ai) ctx.fillText(`PERSON 0.${88 + (o % 11)}`, x, y - 4)
        })
        if (L.ai && /entrance|lobby/.test(kind)) { ctx.strokeStyle = '#c8e85a'; ctx.lineWidth = big ? 3 : 2; ctx.beginPath(); ctx.moveTo(W * 0.12, H * 0.78); ctx.lineTo(W * 0.88, H * 0.78); ctx.stroke() }
      }
      // overlay: ID · location · timestamp | LIVE / PLAYBACK · REC
      const B = W > 700, bar = B ? 24 : 17
      ctx.font = `500 ${B ? 13 : 10}px "IBM Plex Mono", monospace`; ctx.textAlign = 'left'
      const ts = new Date(L.playTs || useStore.getState().now).toLocaleString('en-GB', { hour12: false }).replace(',', '')
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, H - bar, W, bar)
      ctx.fillStyle = '#f3ede3'; ctx.fillText(`${d.id}  ${loc}  ${ts}`, 6, H - (B ? 8 : 5))
      const tag = L.playTs ? '▶ PLAYBACK' : 'LIVE', tw = ctx.measureText(tag).width + (B ? 22 : 15)
      const tx = W - tw - (B ? 26 : 18)
      ctx.fillStyle = L.playTs ? 'rgba(95,212,255,0.9)' : 'rgba(214,52,40,0.92)'; ctx.fillRect(tx, H - bar + 3, tw, bar - 6)
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'
      if (!L.playTs) { ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t / 500)); ctx.beginPath(); ctx.arc(tx + (B ? 9 : 6), H - bar / 2, B ? 3.5 : 2.4, 0, 7); ctx.fill(); ctx.globalAlpha = 1 }
      ctx.fillText(tag, tx + (L.playTs ? 4 : B ? 16 : 11), H - (B ? 8 : 5))
      if (L.rec && !L.playTs) { ctx.fillStyle = Math.floor(t / 600) % 2 ? '#e25b45' : 'rgba(226,91,69,0.3)'; ctx.beginPath(); ctx.arc(W - (B ? 13 : 9), H - bar / 2, B ? 5 : 3.5, 0, 7); ctx.fill() }
      if (pz.z > 1.01) { ctx.fillStyle = '#5fd4ff'; ctx.textAlign = 'right'; ctx.fillText(`PTZ ${pz.z.toFixed(1)}×`, tx - 8, H - (B ? 8 : 5)) }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [d.id, offline, night, big])
  return <canvas ref={ref} width={big ? 960 : 480} height={big ? 540 : 270} className="feed" data-cam={d.id} />
}
