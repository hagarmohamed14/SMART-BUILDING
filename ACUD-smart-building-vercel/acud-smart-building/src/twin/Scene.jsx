// Visual "skin" of the twin: half realistic (lit glass, interiors, landscape),
// half X-ray (blue wireframe with MEP services) — split by a vertical clipping plane.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FLOOR_H, FOOT, LEVEL } from '../data/building'

export const SPLIT = 2
export const CLIP_L = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), SPLIT)] // keeps x <= SPLIT (realistic)
export const CLIP_R = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -SPLIT)] // keeps x >= SPLIT (x-ray)
export const XC = '#6cc4ff'
export const MEP = { duct: '#4aa3ff', chw: '#3fd08a', hw: '#ffad4a', fire: '#ff5d5d', elec: '#ffd84d', data: '#b58bff' }

export function footShape(inset = 0) {
  const { w, d, rFront, rBack } = FOOT
  const x0 = -w / 2 + inset, x1 = w / 2 - inset, y0 = -d / 2 + inset, y1 = d / 2 - inset // shape y = -world z
  const rf = Math.max(0.1, rFront - inset), rb = Math.max(0.1, rBack - inset)
  const s = new THREE.Shape()
  s.moveTo(x0 + rb, y0)
  s.lineTo(x1 - rf, y0); s.quadraticCurveTo(x1, y0, x1, y0 + rf)
  s.lineTo(x1, y1 - rb); s.quadraticCurveTo(x1, y1, x1 - rb, y1)
  s.lineTo(x0 + rb, y1); s.quadraticCurveTo(x0, y1, x0, y1 - rb)
  s.lineTo(x0, y0 + rb); s.quadraticCurveTo(x0, y0, x0 + rb, y0)
  return s
}
const ring = (a, b) => { const s = footShape(a); s.holes.push(new THREE.Path(footShape(b).getPoints(24).reverse())); return s }

export function useGeoms() {
  return useMemo(() => {
    const slab = new THREE.ExtrudeGeometry(footShape(0), { depth: 0.45, bevelEnabled: false, curveSegments: 24 })
    slab.rotateX(-Math.PI / 2)
    const glass = new THREE.ExtrudeGeometry(ring(0.05, 0.27), { depth: FLOOR_H - 0.45, bevelEnabled: false, curveSegments: 24 })
    glass.rotateX(-Math.PI / 2); glass.translate(0, 0.45, 0)
    const interior = new THREE.ExtrudeGeometry(footShape(0.9), { depth: FLOOR_H - 0.95, bevelEnabled: false, curveSegments: 24 })
    interior.rotateX(-Math.PI / 2); interior.translate(0, 0.47, 0)
    const parapet = new THREE.ExtrudeGeometry(ring(0, 0.35), { depth: 1.2, bevelEnabled: false, curveSegments: 24 })
    parapet.rotateX(-Math.PI / 2); parapet.translate(0, 0.45, 0)
    const slabEdges = new THREE.EdgesGeometry(slab, 30)
    const pts = footShape(0.1).getSpacedPoints(96), mv = []
    pts.forEach(p => { mv.push(p.x, 0.45, -p.y, p.x, FLOOR_H, -p.y) })
    // one transom line at door-head height
    const tp = footShape(0.1).getPoints(48)
    tp.forEach((p, k) => { const q = tp[(k + 1) % tp.length]; mv.push(p.x, 3.1, -p.y, q.x, 3.1, -q.y) })
    const mull = new THREE.BufferGeometry(); mull.setAttribute('position', new THREE.Float32BufferAttribute(mv, 3))
    const fins = footShape(0).getSpacedPoints(36).filter(p => p.y < -6 && p.x > 2).filter((_, i) => i % 2 === 0)
    // west-face fins too (like the photo's left wing)
    const finsW = [-30, -22, -14].map(x => new THREE.Vector2(x, -16))
    const parapetEdges = new THREE.EdgesGeometry(parapet, 30)
    return { slab, glass, interior, parapet, parapetEdges, slabEdges, mull, fins: [...fins, ...finsW] }
  }, [])
}

// ---------- shared materials helpers ----------
const box = new THREE.BoxGeometry(1, 1, 1)
const boxEdges = new THREE.EdgesGeometry(box)
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 18)
const cylEdges = new THREE.EdgesGeometry(cyl, 25)

// equipment block: solid metal on the realistic side, cyan wire on the x-ray side
export function Equip({ p, s, round, col = '#9aa6b2' }) {
  const g = round ? cyl : box, e = round ? cylEdges : boxEdges
  return <group position={p} scale={s}>
    <mesh geometry={g}><meshStandardMaterial color={col} metalness={0.55} roughness={0.45} clippingPlanes={CLIP_L} /></mesh>
    <lineSegments geometry={e}><lineBasicMaterial color="#2a3542" clippingPlanes={CLIP_L} /></lineSegments>
    <mesh geometry={g}><meshBasicMaterial color={XC} transparent opacity={0.07} depthWrite={false} blending={THREE.AdditiveBlending} clippingPlanes={CLIP_R} toneMapped={false} /></mesh>
    <lineSegments geometry={e}><lineBasicMaterial color={XC} transparent opacity={0.9} clippingPlanes={CLIP_R} toneMapped={false} /></lineSegments>
  </group>
}

// ---------- interior: desks + ceiling lights (realistic half) ----------
const deskGeo = new THREE.BoxGeometry(2.4, 0.08, 1.1)
const lampGeo = new THREE.BoxGeometry(3.2, 0.05, 0.35)
const _m = new THREE.Matrix4()
export function Interior({ L, addMat, idx }) {
  const { desks, lamps } = useMemo(() => {
    const desks = [], lamps = []
    L.rooms.forEach(r => {
      if (r.x0 > SPLIT) return
      const x1 = Math.min(r.x1, SPLIT + 1)
      if (['office', 'exec', 'meeting', 'lobby', 'retail', 'security', 'noc', 'kitchen'].includes(r.type))
        for (let x = r.x0 + 2.5; x < x1 - 1.5; x += 4.2) for (let z = r.z0 + 2.4; z < r.z1 - 1.5; z += 3.4) desks.push([x, 1.2, z])
      for (let x = r.x0 + 2; x < x1 - 1; x += 5) for (let z = r.z0 + 2; z < r.z1 - 1; z += 4.5) lamps.push([x, FLOOR_H - 0.55, z])
    })
    return { desks, lamps }
  }, [L])
  const set = (list) => (m) => { if (!m) return; list.forEach((p, k) => { _m.makeTranslation(...p); m.setMatrixAt(k, _m) }); m.instanceMatrix.needsUpdate = true }
  return <group>
    {desks.length > 0 && <instancedMesh ref={set(desks)} args={[deskGeo, undefined, desks.length]}>
      <meshStandardMaterial ref={addMat(idx)} color="#e2cfae" emissive="#6b5233" emissiveIntensity={0.4} roughness={0.8} transparent clippingPlanes={CLIP_L} userData={{ base: 1 }} />
    </instancedMesh>}
    {lamps.length > 0 && <instancedMesh ref={set(lamps)} args={[lampGeo, undefined, lamps.length]}>
      <meshBasicMaterial ref={addMat(idx + 1)} color="#fff1d6" transparent clippingPlanes={CLIP_L} toneMapped={false} userData={{ base: 1 }} />
    </instancedMesh>}
  </group>
}

// ---------- MEP services (x-ray half) ----------
export function Services({ L, addMat, idx }) {
  const items = useMemo(() => {
    const out = [], H = FLOOR_H
    const X0 = SPLIT + 0.6, X1 = 29
    // main supply duct along the corridor + branches
    out.push({ k: 'd0', c: MEP.duct, p: [(X0 + X1) / 2, H - 0.8, -0.6], s: [X1 - X0, 0.5, 0.9] })
    ;[8, 15, 22].forEach((x, i) => {
      out.push({ k: 'db' + i, c: MEP.duct, p: [x, H - 0.75, -7.5], s: [0.45, 0.32, 12] })
      out.push({ k: 'df' + i, c: MEP.duct, p: [x, H - 0.75, 6.8], s: [0.45, 0.32, 10.6] })
      out.push({ k: 'fcuA' + i, c: MEP.duct, p: [x, H - 0.95, -12.5], s: [1.6, 0.5, 1.2], wire: true })
      out.push({ k: 'fcuB' + i, c: MEP.duct, p: [x, H - 0.95, 11.5], s: [1.6, 0.5, 1.2], wire: true })
    })
    // chilled / hot water pipes and the sprinkler main
    out.push({ k: 'chw', c: MEP.chw, p: [(X0 + X1) / 2, H - 0.42, 0.7], s: [X1 - X0, 0.16, 0.16] })
    out.push({ k: 'hw', c: MEP.hw, p: [(X0 + X1) / 2, H - 0.42, 1.1], s: [X1 - X0, 0.12, 0.12] })
    out.push({ k: 'spr', c: MEP.fire, p: [(X0 + X1) / 2, H - 0.3, -2.2], s: [X1 - X0, 0.09, 0.09] })
    ;[6, 11, 16, 21, 26].forEach((x, i) => out.push({ k: 'sb' + i, c: MEP.fire, p: [x, H - 0.3, -2], s: [0.06, 0.06, 26] }))
    // cable tray (electrical + data)
    out.push({ k: 'tray', c: MEP.elec, p: [(X0 + X1) / 2, H - 1.25, -1.6], s: [X1 - X0, 0.08, 0.5] })
    out.push({ k: 'data', c: MEP.data, p: [(X0 + X1) / 2, H - 1.4, -1.6], s: [X1 - X0, 0.06, 0.3] })
    // vertical risers through the slab (shaft next to the core)
    const R = [['rd', MEP.duct, 0, 1.0], ['rc', MEP.chw, 1.3, 0.3], ['rh', MEP.hw, 1.8, 0.25], ['rf', MEP.fire, 2.3, 0.25], ['re', MEP.elec, 2.8, 0.35]]
    R.forEach(([k, c, dx, w]) => out.push({ k, c, p: [SPLIT + 2 + dx, H / 2 + 0.2, -3.4], s: [w, H + 0.1, w] }))
    // plant rooms get equipment silhouettes
    if (L.id === 'B1') {
      out.push({ k: 'gen', c: MEP.elec, p: [12, 1.8, -8], s: [7, 2.6, 3.2], wire: true })
      out.push({ k: 'gas', c: MEP.hw, p: [24, 1.3, -8], s: [3, 1.6, 2], wire: true })
      ;[[10, 6], [15, 6], [20, 6]].forEach(([x, z], i) => out.push({ k: 'pmp' + i, c: MEP.chw, p: [x, 1, z], s: [1.6, 1, 1.2], wire: true }))
    }
    if (L.id === 'L1') {
      out.push({ k: 'ups1', c: MEP.elec, p: [10, 1.4, -8], s: [5, 2, 1.4], wire: true })
      out.push({ k: 'ups2', c: MEP.elec, p: [14.5, 1.4, -8], s: [2.6, 2, 1.4], wire: true })
      ;[20, 22.5, 25, 27.5].forEach((x, i) => out.push({ k: 'mdf' + i, c: MEP.data, p: [x, 1.6, -9], s: [1.2, 2.3, 1.1], wire: true }))
    }
    if (L.id === 'GF') out.push({ k: 'fcc', c: MEP.fire, p: [19, 1.4, 8], s: [3, 1.8, 1.2], wire: true })
    return out
  }, [L])
  return <group>{items.map((it, n) => it.wire
    ? <lineSegments key={it.k} geometry={boxEdges} position={it.p} scale={it.s}>
      <lineBasicMaterial ref={addMat(idx + n)} color={it.c} transparent toneMapped={false} userData={{ base: 0.95 }} />
    </lineSegments>
    : <mesh key={it.k} geometry={box} position={it.p} scale={it.s}>
      <meshBasicMaterial ref={addMat(idx + n)} color={it.c} transparent opacity={0.8} depthWrite={false} toneMapped={false} userData={{ base: 0.8 }} />
    </mesh>)}</group>
}

// ---------- roof plant (whole-building view) ----------
export function RoofPlant() {
  const pv = useMemo(() => { const o = []; for (let x = -9; x < 23; x += 3.3) for (let z = 3; z < 13.5; z += 2.6) o.push([x, z]); return o }, [])
  const fan = useRef()
  useFrame((_, dt) => { if (fan.current) fan.current.children.forEach(c => { c.rotation.y += dt * 3 }) })
  return <group position={[0, 0.45, 0]}>
    {/* chillers, boiler, cooling towers (realistic side) */}
    <Equip p={[-12, 1.2, -11]} s={[9, 2.4, 3]} />
    <Equip p={[-12, 1.2, -5.5]} s={[9, 2.4, 3]} />
    <Equip p={[-24, 1.5, -8]} s={[8, 3, 6]} col="#b9c0c7" />
    {[[-25, 5], [-17, 5], [-25, 11], [-17, 11]].map(([x, z], i) => <Equip key={i} p={[x, 1.6, z]} s={[6, 3.2, 5]} col="#c3c9cf" />)}
    <group ref={fan}>{[[-25, 5], [-17, 5], [-25, 11], [-17, 11]].map(([x, z], i) =>
      <mesh key={i} position={[x, 3.35, z]}><cylinderGeometry args={[2, 2, 0.25, 6]} /><meshStandardMaterial color="#56606b" metalness={0.6} roughness={0.4} clippingPlanes={CLIP_L} /></mesh>)}</group>
    {/* stair / lift overrun */}
    <Equip p={[0, 2, -8]} s={[10, 4, 11]} col="#d5dade" />
    {/* x-ray side: roof tank + AHUs */}
    <Equip p={[10, 1.8, -8]} s={[6, 3.6, 6]} round />
    <Equip p={[18, 1.6, -11]} s={[6, 3.2, 3.4]} />
    <Equip p={[26, 1.6, -11]} s={[6, 3.2, 3.4]} />
    <Equip p={[22, 1.6, -4.5]} s={[12, 3.2, 3.4]} />
    {/* PV array — spans the split */}
    {pv.map(([x, z], i) => <group key={i} position={[x, 0.9, z]} rotation={[-0.3, 0, 0]}>
      <mesh><boxGeometry args={[3, 0.06, 2.2]} /><meshStandardMaterial color="#1d3b6b" metalness={0.5} roughness={0.25} emissive="#0d2a55" emissiveIntensity={0.4} clippingPlanes={CLIP_L} /></mesh>
      <lineSegments><edgesGeometry args={[new THREE.BoxGeometry(3, 0.06, 2.2)]} /><lineBasicMaterial color={XC} transparent opacity={0.7} clippingPlanes={CLIP_R} toneMapped={false} /></lineSegments>
    </group>)}
  </group>
}

// ---------- podium, landscaping, ground ----------
function Tree({ p, s = 1 }) {
  return <group position={p} scale={s}>
    <mesh position={[0, 1.4, 0]}><cylinderGeometry args={[0.18, 0.25, 2.8, 6]} /><meshStandardMaterial color="#4a3a2c" /></mesh>
    <mesh position={[0, 3.6, 0]}><icosahedronGeometry args={[1.9, 1]} /><meshStandardMaterial color="#3f7a46" roughness={0.9} emissive="#16351b" emissiveIntensity={0.5} flatShading /></mesh>
  </group>
}
export function Podium() {
  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(footShape(-8), { depth: 0.8, bevelEnabled: false, curveSegments: 24 }); g.rotateX(-Math.PI / 2); g.translate(0, -0.8, 0); return g
  }, [])
  const edge = useMemo(() => new THREE.BufferGeometry().setFromPoints(footShape(-8).getPoints(40).map(p => new THREE.Vector3(p.x, 0.02, -p.y))), [])
  const rings = useMemo(() => [62, 70, 82].map(r => new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0, 0, r, r).getPoints(160).map(p => new THREE.Vector3(p.x, -0.75, p.y)))), [])
  const lights = []
  for (let x = -36; x <= 36; x += 6) lights.push([x, 25.5])
  for (let z = -18; z <= 20; z += 6) lights.push([-41.5, z])
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.82, 0]}><circleGeometry args={[150, 96]} /><meshStandardMaterial color="#0c1a2c" roughness={0.35} metalness={0.4} /></mesh>
    <gridHelper args={[300, 75, '#18334f', '#12273f']} position={[0, -0.8, 0]} />
    {rings.map((g, k) => <line key={k} geometry={g}><lineBasicMaterial color={XC} transparent opacity={k === 0 ? 0.35 : 0.14} toneMapped={false} /></line>)}
    <mesh geometry={geo}><meshStandardMaterial color="#3a4452" roughness={0.75} /></mesh>
    <line geometry={edge}><lineBasicMaterial color="#9cc9ee" transparent opacity={0.55} toneMapped={false} /></line>
    {/* hedges & planters */}
    {[[-30, 21.5, 14], [21, 21.5, 14], [-41, 4, 4]].map(([x, z, w], i) => <mesh key={i} position={[x, 0.5, z]} rotation={[0, i === 2 ? Math.PI / 2 : 0, 0]}><boxGeometry args={[w, 1, 2.6]} /><meshStandardMaterial color="#2f5a35" roughness={1} /></mesh>)}
    {[[-35, 21.5], [-26, 21.5], [17, 21.5], [26, 21.5], [-41, -8], [-41, 12], [-41, -16]].map(([x, z], i) => <Tree key={i} p={[x, 0, z]} s={i % 2 ? 0.9 : 1.1} />)}
    {/* path lights */}
    {lights.map(([x, z], i) => <group key={i} position={[x, 0, z]}>
      <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.12, 0.12, 1, 6]} /><meshBasicMaterial color="#ffe3b0" toneMapped={false} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}><circleGeometry args={[1.4, 16]} /><meshBasicMaterial color="#ffcf8a" transparent opacity={0.16} depthWrite={false} /></mesh>
    </group>)}
    {/* entrance steps */}
    {[0, 1, 2].map(k => <mesh key={k} position={[0, -0.6 + k * 0.2, 25 - k * 0.8]}><boxGeometry args={[14, 0.2, 0.8]} /><meshStandardMaterial color="#5b6573" /></mesh>)}
  </group>
}

export function Canopy() {
  return (<group>
    <mesh position={[0, FLOOR_H - 0.4, 20]}><boxGeometry args={[24, 0.35, 9]} /><meshStandardMaterial color="#e6eaee" roughness={0.5} /></mesh>
    <mesh position={[0, FLOOR_H - 0.6, 20]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[23, 8.4]} /><meshBasicMaterial color="#ffd9a0" toneMapped={false} /></mesh>
    {[-7, 7].map(x => <mesh key={x} position={[x, (FLOOR_H - 0.4) / 2, 23]}><cylinderGeometry args={[0.25, 0.25, FLOOR_H - 0.4]} /><meshStandardMaterial color="#c9d1d9" /></mesh>)}
  </group>)
}

export const levelOf = (id) => LEVEL[id]
