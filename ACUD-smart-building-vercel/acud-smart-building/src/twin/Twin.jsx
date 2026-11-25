import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useMemo, useRef, useEffect, useState, memo } from 'react'
import * as THREE from 'three'
import { LEVELS, LEVEL, FLOOR_H, FOOT, DEVICES, DEV, SYSTEMS, ZONE_NAMES } from '../data/building'
import { useStore, activeAlarms } from '../data/store'
import { STATUS, useSnap } from '../data/util'
import TwinUI from './TwinUI'
import TwinCards from './TwinCards'
import { useGeoms, Podium, Canopy, RoofPlant, Interior, Services, CLIP_L, CLIP_R, XC } from './Scene'

export const LEVEL_Y = {}
const AMBER = '#c98a2e', TAUPE = '#a89c8c', RED = '#c4553f'

export const explodeOffset = (i, sel, explode) => (sel == null || !explode ? 0 : i > sel ? 12 + (i - sel) * 0.6 : 0)

// ---------- one level ----------
const Level = memo(function Level({ L, g, selIdx, explode, view, hovered, setHovered, alarmLv, layer }) {
  const ref = useRef(), mats = useRef([])
  const i = L.index
  const isSel = selIdx === i
  const hidden = view === '2d' && selIdx != null && i > selIdx
  const faded = selIdx != null && !isSel
  const target = explodeOffset(i, selIdx, explode)
  const setLevel = useStore(s => s.setLevel)
  useFrame((_, dt) => {
    if (!ref.current) return
    const y = L.y + target
    ref.current.position.y += (y - ref.current.position.y) * Math.min(1, dt * 5)
    LEVEL_Y[L.id] = ref.current.position.y
    const op = hidden ? 0 : faded ? (i > selIdx ? 0.1 : 0.22) : 1
    mats.current.forEach(m => { if (!m) return; const base = m.userData.base; m.opacity += (base * op - m.opacity) * Math.min(1, dt * 6); m.visible = m.opacity > 0.01 })
  })
  const crit = alarmLv === 'critical'
  const hot = crit ? '#ff6b57' : alarmLv === 'major' ? '#ffb347' : null
  const hov = hovered === L.id
  const addMat = (k) => (m) => { if (m) { mats.current[k] = m } }
  const ev = {
    onPointerOver: (e) => { e.stopPropagation(); setHovered(L.id) }, onPointerOut: () => setHovered(null),
    onClick: (e) => { e.stopPropagation(); if (!hidden) setLevel(isSel ? null : L.id) },
  }
  const warm = L.id === 'L1' ? '#a9cbff' : L.id === 'B1' ? '#8fa6bd' : '#ffd9a6'
  const roof = L.id === 'RF'
  const showInside = !isSel && !roof
  return (
    <group ref={ref} position={[0, L.y, 0]}>
      <mesh geometry={g.slab} {...ev}>
        <meshStandardMaterial ref={addMat(0)} color={isSel ? '#eef1f4' : '#d4d9df'} roughness={0.6} transparent clippingPlanes={CLIP_L} userData={{ base: 1 }} />
      </mesh>
      <mesh geometry={g.slab}>
        <meshBasicMaterial ref={addMat(1)} color={isSel ? '#cfe6ff' : XC} transparent depthWrite={false} blending={isSel ? THREE.NormalBlending : THREE.AdditiveBlending} clippingPlanes={CLIP_R} toneMapped={false} userData={{ base: isSel ? 0.9 : 0.16 }} />
      </mesh>
      <lineSegments geometry={g.slabEdges}><lineBasicMaterial ref={addMat(2)} color={hot || (hov || isSel ? '#ffffff' : '#e9eef3')} transparent clippingPlanes={CLIP_L} userData={{ base: 0.9 }} /></lineSegments>
      <lineSegments geometry={g.slabEdges}><lineBasicMaterial ref={addMat(3)} color={hot || (hov || isSel ? '#c9ecff' : XC)} transparent clippingPlanes={CLIP_R} toneMapped={false} userData={{ base: 1 }} /></lineSegments>
      {!roof && <>
        <mesh geometry={g.interior} renderOrder={1}>
          <meshStandardMaterial ref={addMat(4)} color="#2a2118" emissive={crit ? '#ff5a3c' : warm} emissiveIntensity={crit ? 0.9 : 0.34} side={THREE.BackSide} transparent clippingPlanes={CLIP_L} userData={{ base: showInside ? 0.95 : 0 }} />
        </mesh>
        <mesh geometry={g.glass} renderOrder={2} {...ev}>
          <meshStandardMaterial ref={addMat(5)} color={hov ? '#6e8fb3' : '#2a4d73'} metalness={0.6} roughness={0.12} emissive={crit ? '#c4553f' : '#000000'} emissiveIntensity={crit ? 0.5 : 0} transparent depthWrite={false} clippingPlanes={CLIP_L} userData={{ base: isSel ? 0.05 : hov ? 0.28 : 0.34 }} />
        </mesh>
        <mesh geometry={g.glass} renderOrder={2}>
          <meshBasicMaterial ref={addMat(6)} color={crit ? '#ff6b57' : hov ? '#9fd8ff' : '#2d7fe0'} transparent depthWrite={false} blending={THREE.AdditiveBlending} clippingPlanes={CLIP_R} toneMapped={false} userData={{ base: isSel ? 0.03 : hov ? 0.22 : 0.09 }} />
        </mesh>
        <lineSegments geometry={g.mull}><lineBasicMaterial ref={addMat(7)} color="#1a2430" transparent clippingPlanes={CLIP_L} userData={{ base: isSel ? 0.15 : 0.85 }} /></lineSegments>
        <lineSegments geometry={g.mull}><lineBasicMaterial ref={addMat(8)} color={XC} transparent clippingPlanes={CLIP_R} toneMapped={false} userData={{ base: isSel ? 0.08 : 0.32 }} /></lineSegments>
        {showInside && <Interior L={L} addMat={addMat} idx={10} />}
        {showInside && <Services L={L} addMat={addMat} idx={20} />}
        {g.fins.map((p, k) => (
          <mesh key={k} position={[p.x, FLOOR_H / 2 + 0.2, -p.y]}>
            <boxGeometry args={[0.45, FLOOR_H - 0.3, 0.45]} />
            <meshStandardMaterial ref={addMat(60 + k)} color="#5fd46e" emissive="#36c457" emissiveIntensity={0.55} transparent userData={{ base: isSel ? 0.15 : 0.95 }} />
          </mesh>
        ))}
      </>}
      {roof && <>
        <mesh geometry={g.parapet}><meshStandardMaterial ref={addMat(4)} color="#e3e7eb" roughness={0.6} transparent clippingPlanes={CLIP_L} userData={{ base: isSel ? 0.3 : 1 }} /></mesh>
        <lineSegments geometry={g.parapetEdges}><lineBasicMaterial ref={addMat(5)} color={XC} transparent clippingPlanes={CLIP_R} toneMapped={false} userData={{ base: 0.9 }} /></lineSegments>
        {selIdx == null && <RoofPlant />}
      </>}
      {isSel && <FloorPlan L={L} layer={layer} />}
      {L.id === 'GF' && <Canopy />}
    </group>
  )
})


const ROOM_TINT = { office: '#efe8dc', exec: '#efe6d6', meeting: '#ece3d4', core: '#dcd5ca', idf: '#e3e3ea', pantry: '#e9e6dc', elec: '#efe4c9', tx: '#efe4c9', gen: '#efe4c9', gasroom: '#efdcc9', tank: '#dbe6ea', pump: '#dbe6ea', park: '#e4e1dc', security: '#e4e1ea', lobby: '#f1ebdf', fcc: '#f1dcd6', kitchen: '#efdccc', loading: '#e4e1dc', retail: '#efe8dc', datahall: '#dfe3ea', ups: '#e6e3ea', mdf: '#e3e3ea', noc: '#e3e3ea', boiler: '#efdccc', chiller: '#dbe6ea', rtank: '#dbe6ea', ahu: '#dfe8dc', towers: '#dbe6ea', pv: '#e7e6df' }

const _navy = new THREE.Color('#132236')
const tint = (t) => '#' + new THREE.Color(ROOM_TINT[t] || '#eeeeee').lerp(_navy, 0.62).getHexString()
function FloorPlan({ L, layer }) {
  const module = useStore(s => s.module)
  const walls = useMemo(() => {
    const v = []
    L.rooms.forEach(r => { const y = 0.46; const p = [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]]; for (let k = 0; k < 4; k++) { const a = p[k], b = p[(k + 1) % 4]; v.push(a[0], y, a[1], b[0], y, b[1], a[0], y + 2.4, a[1], b[0], y + 2.4, b[1]) } })
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); return g
  }, [L])
  return (
    <group>
      {L.rooms.map(r => (
        <group key={r.id}>
          <mesh position={[r.cx, 0.47, r.cz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[r.x1 - r.x0 - 0.3, r.z1 - r.z0 - 0.3]} />
            <meshStandardMaterial color={tint(r.type)} />
          </mesh>
          <mesh position={[r.cx, 1.7, r.cz]}>
            <boxGeometry args={[r.x1 - r.x0 - 0.3, 2.4, r.z1 - r.z0 - 0.3]} />
            <meshBasicMaterial color="#8cc8ff" transparent opacity={0.05} depthWrite={false} />
          </mesh>
        </group>
      ))}
      <lineSegments geometry={walls}><lineBasicMaterial color="#9fd3ff" transparent opacity={0.75} toneMapped={false} /></lineSegments>
      <Furniture L={L} />
      {module === 'fire' && L.id !== 'RF' && <Evac />}
    </group>
  )
}

function Furniture({ L }) {
  // light architectural props: desks in offices, racks in data hall, plant items
  const snap = useSnap()
  const items = []
  L.rooms.forEach(r => {
    if (['office', 'exec'].includes(r.type)) {
      for (let x = r.x0 + 3; x < r.x1 - 2; x += 4.5) for (let z = r.z0 + 3; z < r.z1 - 2; z += 3.6)
        items.push(<mesh key={r.id + x + z} position={[x, 0.85, z]}><boxGeometry args={[2.6, 0.08, 1.2]} /><meshStandardMaterial color="#c9d2dc" /></mesh>)
    }
    if (r.type === 'meeting') items.push(<mesh key={r.id + 't'} position={[r.cx, 0.85, r.cz]}><boxGeometry args={[(r.x1 - r.x0) * 0.5, 0.1, 3]} /><meshStandardMaterial color="#b9c4cf" /></mesh>)
    if (r.type === 'pv') for (let x = r.x0 + 2; x < r.x1 - 1; x += 3.2) for (let z = r.z0 + 2; z < r.z1 - 1; z += 2.4)
      items.push(<mesh key={r.id + x + z} position={[x, 0.9, z]} rotation={[-0.35, 0, 0]}><boxGeometry args={[2.9, 0.06, 1.9]} /><meshStandardMaterial color="#5d6f86" metalness={0.4} roughness={0.35} /></mesh>)
  })
  if (L.id === 'L1') DEVICES.filter(d => d.type === 'rack').forEach(d => {
    const t = snap.dc.racks[d.rack].inlet, c = new THREE.Color().lerpColors(new THREE.Color('#7c95a8'), new THREE.Color(RED), Math.max(0, Math.min(1, (t - 22) / 10)))
    items.push(<mesh key={d.id} position={[d.x, 1.6, d.z]}><boxGeometry args={[2.2, 2.3, 1.2]} /><meshStandardMaterial color={c} roughness={0.6} /></mesh>)
  })
  return <group>{items}</group>
}

function Evac() {
  // simplified egress paths: corridor to east & west stairs
  const lines = useMemo(() => [[[-2, 0], [-31, 0]], [[2, 0], [29, 0]]].map(seg => new THREE.BufferGeometry().setFromPoints(seg.map(([x, z]) => new THREE.Vector3(x, 0.55, z)))), [])
  const ref = useRef()
  useFrame(({ clock }) => { if (ref.current) ref.current.children.forEach((c, k) => { c.position.x = ((clock.elapsedTime * 6 + k * 4) % 28) * (k % 2 ? 1 : -1) }) })
  return <group>
    {lines.map((g, k) => <line key={k} geometry={g}><lineBasicMaterial color="#3f9a5a" linewidth={2} /></line>)}
    <group ref={ref}>{[0, 1, 2, 3, 4, 5].map(k => <mesh key={k} position={[0, 0.6, 0]}><coneGeometry args={[0.45, 1.1, 3]} /><meshBasicMaterial color="#3f9a5a" /></mesh>)}</group>
  </group>
}

// ---------- device markers ----------
const geoHead = { fire: new THREE.SphereGeometry(0.42, 14, 10), cctv: new THREE.ConeGeometry(0.45, 0.9, 4), access: new THREE.BoxGeometry(0.7, 0.7, 0.7), nms: new THREE.OctahedronGeometry(0.5), bms: new THREE.CylinderGeometry(0.42, 0.42, 0.6, 12), dc: new THREE.BoxGeometry(0.6, 0.9, 0.6), elec: new THREE.OctahedronGeometry(0.5), water: new THREE.SphereGeometry(0.45, 14, 10), gas: new THREE.TetrahedronGeometry(0.55) }
const ringGeo = new THREE.RingGeometry(0.7, 0.95, 28)
const stemGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6)

function Marker({ d, y, small, selected, status, onHover }) {
  const ref = useRef(), pulse = useRef()
  const col = status === 'ok' || status === 'run' ? SYSTEMS[d.sys].color : (STATUS[status] || STATUS.ok).color
  const selectDevice = useStore(s => s.selectDevice)
  const alarmish = status === 'alarm'
  useFrame(({ clock }) => {
    if (pulse.current) { const k = (clock.elapsedTime * 1.4) % 1; pulse.current.scale.setScalar(1 + k * (alarmish ? 3.2 : 1.6)); pulse.current.material.opacity = (1 - k) * (alarmish ? 0.9 : 0.6) }
    if (ref.current && selected) ref.current.rotation.y = clock.elapsedTime
  })
  const s = small ? 1.5 : 1
  return (
    <group position={[d.x, y, d.z]} scale={s}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} geometry={ringGeo}><meshBasicMaterial color={col} transparent opacity={0.85} side={THREE.DoubleSide} /></mesh>
      {(alarmish || selected || status === 'warn') && <mesh ref={pulse} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]} geometry={ringGeo}><meshBasicMaterial color={selected && !alarmish ? AMBER : col} transparent side={THREE.DoubleSide} depthWrite={false} /></mesh>}
      <mesh position={[0, 0.85, 0]} geometry={stemGeo}><meshBasicMaterial color={col} /></mesh>
      <mesh ref={ref} position={[0, 1.9, 0]} geometry={geoHead[d.sys]}
        onPointerOver={(e) => { e.stopPropagation(); onHover(d.id); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = '' }}
        onClick={(e) => { e.stopPropagation(); selectDevice(d.id) }}>
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={alarmish ? 0.9 : 0.35} roughness={0.4} />
      </mesh>
      {d.type === 'camera' && d.fov != null && <mesh position={[Math.cos(d.fov) * 4.2, 1.5, -Math.sin(d.fov) * 4.2]} rotation={[0, d.fov + Math.PI, -Math.PI / 2]}>
        <coneGeometry args={[3, 8, 24, 1, true]} /><meshBasicMaterial color={col} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>}
    </group>
  )
}

function Devices({ selIdx, explode, layer, view, setHover }) {
  const status = useStore(s => s.status), device = useStore(s => s.device), alarms = useStore(s => s.alarms), filters = useStore(s => s.filters)
  const act = useMemo(() => new Set(activeAlarms(alarms).map(a => a.dev)), [alarms])
  const list = useMemo(() => {
    if (selIdx != null) {
      const lv = LEVELS[selIdx].id
      return DEVICES.filter(d => d.level === lv && (!layer || d.sys === layer) && (filters.status === 'all' || status[d.id] === filters.status || (filters.status === 'alarm' && act.has(d.id))))
    }
    // whole building: show only layer devices, or devices in alarm/non-normal
    return DEVICES.filter(d => (layer ? d.sys === layer : (act.has(d.id) || ['alarm'].includes(status[d.id]))))
  }, [selIdx, layer, status, act, filters.status])
  return (
    <group>
      {list.map(d => {
        const i = LEVEL[d.level].index
        const y = LEVEL[d.level].y + explodeOffset(i, selIdx, explode) + 0.45
        if (view === '2d' && selIdx != null && i !== selIdx) return null
        const st = act.has(d.id) && status[d.id] === 'ok' ? 'warn' : status[d.id]
        return <Marker key={d.id} d={d} y={y} small={selIdx == null} selected={device === d.id} status={st} onHover={setHover} />
      })}
    </group>
  )
}

// zone highlight for fire alarms
function ZoneGlow({ selIdx, explode }) {
  const alarms = useStore(s => s.alarms)
  const zones = useMemo(() => {
    const m = new Map()
    activeAlarms(alarms).filter(a => a.sev === 'critical' && a.zone).forEach(a => m.set(a.zone, a))
    return [...m.keys()]
  }, [alarms])
  const ref = useRef()
  useFrame(({ clock }) => { if (ref.current) ref.current.children.forEach(c => { c.material.opacity = 0.18 + 0.16 * Math.sin(clock.elapsedTime * 4) }) })
  return <group ref={ref}>{zones.map(z => {
    const [lv, q] = z.split('-'), L = LEVEL[lv]; if (!L) return null
    const x = q === 'Z1' || q === 'Z3' ? -16 : 15, zz = q === 'Z1' || q === 'Z2' ? -8 : 8
    return <mesh key={z} position={[x, L.y + explodeOffset(L.index, selIdx, explode) + 2.2, zz]}><boxGeometry args={[30, FLOOR_H - 0.6, 15.5]} /><meshBasicMaterial color={RED} transparent opacity={0.25} depthWrite={false} /></mesh>
  })}</group>
}

// utility risers with flowing particles
function Risers({ layer, selIdx, explode }) {
  const cfg = { elec: { x: -12, z: -3, c: '#d49b2a' }, water: { x: 4.5, z: -3, c: '#3f86a8' }, gas: { x: -22, z: -6, c: '#b0703a' }, nms: { x: -12, z: -6, c: AMBER }, dc: { x: -12, z: -6, c: '#5a6f8f' } }[layer]
  const ref = useRef()
  const top = LEVELS.at(-1).y + explodeOffset(7, selIdx, explode) + 1
  useFrame(({ clock }) => { if (ref.current) ref.current.children.forEach((c, k) => { c.position.y = ((clock.elapsedTime * 7 + k * (top / 10)) % top) }) })
  if (!cfg) return null
  return <group position={[cfg.x, 0, cfg.z]}>
    <mesh position={[0, top / 2, 0]}><cylinderGeometry args={[0.14, 0.14, top, 8]} /><meshBasicMaterial color={cfg.c} transparent opacity={0.6} /></mesh>
    <group ref={ref}>{Array.from({ length: 10 }, (_, k) => <mesh key={k}><sphereGeometry args={[0.32, 10, 8]} /><meshBasicMaterial color={cfg.c} /></mesh>)}</group>
  </group>
}


// projects DOM labels onto the canvas every frame (no React work per frame)
const _v = new THREE.Vector3()
function Projector({ labels, els }) {
  useFrame(({ camera, size }) => {
    labels.forEach((l, i) => {
      const el = els.current[i]; if (!el) return
      _v.set(l.x, (LEVEL_Y[l.lv] ?? LEVEL[l.lv].y) + l.y, l.z).project(camera)
      if (_v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) { el.style.visibility = 'hidden'; return }
      el.style.visibility = 'visible'
      el.style.transform = `translate(${((_v.x + 1) / 2 * size.width).toFixed(1)}px, ${((1 - _v.y) / 2 * size.height).toFixed(1)}px) translate(-50%, ${l.d ? '-100%' : '-50%'})`
    })
  })
  return null
}

// leader lines from the floating data cards to their anchor points on the model
function CardLinks({ refs }) {
  useFrame(({ camera, size }) => {
    const { els, lines, anchors } = refs.current
    anchors.forEach((a, i) => {
      const el = els[i], ln = lines[i]; if (!el || !ln || !a) return
      if (!el.offsetParent) { ln.path.setAttribute('d', ''); ln.dot.setAttribute('r', 0); return } else ln.dot.setAttribute('r', 3.5)
      _v.set(a.x, (LEVEL_Y[a.lv] ?? LEVEL[a.lv].y) + a.y, a.z).project(camera)
      const px = (_v.x + 1) / 2 * size.width, py = (1 - _v.y) / 2 * size.height
      const left = !!el.closest('.l')
      const ox = el.offsetLeft + (el.offsetParent ? el.offsetParent.offsetLeft : 0), oy = el.offsetTop + (el.offsetParent ? el.offsetParent.offsetTop : 0)
      const cx = left ? ox + el.offsetWidth : ox, cy = oy + el.offsetHeight / 2
      const mx = left ? cx + 24 : cx - 24
      ln.path.setAttribute('d', `M${cx},${cy} L${mx},${cy} L${px.toFixed(1)},${py.toFixed(1)}`)
      ln.dot.setAttribute('cx', px.toFixed(1)); ln.dot.setAttribute('cy', py.toFixed(1))
    })
  })
  return null
}

// ---------- camera rig ----------
function Rig({ controls, compact }) {
  const { camera } = useThree()
  const level = useStore(s => s.level), device = useStore(s => s.device), view = useStore(s => s.view), focusTick = useStore(s => s.focusTick), explode = useStore(s => s.explode)
  const goal = useRef(null)
  useEffect(() => {
    const selIdx = level ? LEVEL[level].index : null
    let target, off
    if (device && DEV[device]) {
      const d = DEV[device], L = LEVEL[d.level]
      target = new THREE.Vector3(d.x, L.y + explodeOffset(L.index, selIdx, explode) + 1, d.z); off = new THREE.Vector3(18, 22, 26)
    } else if (level) {
      const L = LEVEL[level]; target = new THREE.Vector3(0, L.y + 1, 0); off = new THREE.Vector3(52, 50, 68)
    } else { target = new THREE.Vector3(0, 13, 0); off = new THREE.Vector3(92, 58, 106) }
    if (compact && !device) off.multiplyScalar(level ? 0.8 : 0.62)
    if (view === '2d') off = new THREE.Vector3(0, device ? 45 : 78, 0.001)
    goal.current = { target, pos: target.clone().add(off), t: 0 }
  }, [level, device, view, focusTick, explode, compact])
  useFrame((_, dt) => {
    const c = controls.current; if (!c || !goal.current) return
    const k = Math.min(1, dt * 3.2)
    camera.position.lerp(goal.current.pos, k); c.target.lerp(goal.current.target, k); c.update()
    goal.current.t += dt
    if (goal.current.t > 1.8) goal.current = null
  })
  return null
}

export default function Twin({ layer: fixedLayer, compact = false }) {
  const g = useGeoms()
  const level = useStore(s => s.level), explode = useStore(s => s.explode), view = useStore(s => s.view), storeLayer = useStore(s => s.layer), alarms = useStore(s => s.alarms)
  const layer = storeLayer ?? fixedLayer ?? null
  const selIdx = level ? LEVEL[level].index : null
  const [hovered, setHovered] = useState(null)
  const [hoverDev, setHoverDev] = useState(null)
  const status = useStore(s => s.status)
  const labelEls = useRef([])
  const labels = useMemo(() => {
    const out = []
    const lvl = level
    if (lvl) LEVEL[lvl].rooms.forEach(r => out.push({ k: r.id, lv: lvl, x: r.cx, y: 0.7, z: r.cz, text: r.name }))
    if (hoverDev) { const d = DEV[hoverDev]; out.push({ k: 'tip', lv: d.level, x: d.x, y: 3.8, z: d.z, d }) }
    return out
  }, [level, hoverDev, view])
  const controls = useRef()
  const [cards, setCards] = useState(true)
  const device = useStore(s => s.device)
  const cardsOn = cards && !compact && !level && !device && view === '3d'
  const cardRefs = useRef({ els: [], lines: [], anchors: [] })
  const lvAlarm = useMemo(() => {
    const m = {}; activeAlarms(alarms).forEach(a => { if (!a.level) return; const R = { critical: 3, major: 2, minor: 1, info: 0 }; if (!m[a.level] || (R[a.sev] ?? 0) > (R[m[a.level]] ?? 0)) m[a.level] = a.sev }); return m
  }, [alarms])
  useEffect(() => () => { document.body.style.cursor = '' }, [])
  return (
    <div className={'twin' + (compact ? ' compact' : '')}>
      <Canvas shadows={false} dpr={[1, 2]} camera={{ position: [92, 71, 106], fov: 38, near: 1, far: 800 }} gl={{ antialias: true, alpha: true, localClippingEnabled: true }} onCreated={({ gl }) => { gl.localClippingEnabled = true }}
        onPointerMissed={() => useStore.getState().selectDevice(null)}>
        <fog attach="fog" args={['#0b1729', 190, 460]} />
        <ambientLight intensity={0.25} color="#9fb6d6" />
        <hemisphereLight args={['#a9c6ff', '#0b1220', 0.7]} />
        <directionalLight position={[60, 90, 40]} intensity={1.1} color="#dce8ff" />
        <directionalLight position={[-60, 25, 70]} intensity={0.55} color="#ffd6a3" />
        <Podium />
        <group>
          {LEVELS.map(L => <Level key={L.id} L={L} g={g} selIdx={selIdx} explode={explode} view={view} hovered={hovered} setHovered={setHovered} alarmLv={lvAlarm[L.id]} layer={layer} />)}
          <Devices selIdx={selIdx} explode={explode} layer={layer} view={view} setHover={setHoverDev} />
          <Projector labels={labels} els={labelEls} />
          {cardsOn && <CardLinks refs={cardRefs} />}
          <ZoneGlow selIdx={selIdx} explode={explode} />
          {layer && <Risers layer={layer} selIdx={selIdx} explode={explode} />}
        </group>
        <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={14} maxDistance={260}
          maxPolarAngle={view === '2d' ? 0.001 : Math.PI / 2.05} minPolarAngle={0} enableRotate={view !== '2d'} screenSpacePanning />
        <Rig controls={controls} compact={compact} />
      </Canvas>
      <div className="labels" aria-hidden="true">{labels.map((l, i) => l.d
        ? <div key={l.k} ref={el => (labelEls.current[i] = el)} className="twin-tip"><b>{l.d.name}</b><span>{l.d.room} · {ZONE_NAMES[l.d.zone.split('-')[1]]}</span><i style={{ color: (STATUS[status[l.d.id]] || STATUS.ok).color }}>● {(STATUS[status[l.d.id]] || STATUS.ok).label}</i></div>
        : <div key={l.k} ref={el => (labelEls.current[i] = el)} className="room-label">{l.text}</div>)}</div>
      {cardsOn && <TwinCards refs={cardRefs} />}
      <TwinUI controls={controls} layer={layer} fixedLayer={fixedLayer} hovered={hovered} lvAlarm={lvAlarm} compact={compact} cards={cards} setCards={setCards} />
    </div>
  )
}
