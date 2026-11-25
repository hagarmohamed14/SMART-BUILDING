// Schematic 3D site view of the selected ACUD Network Node: one block per configured building.
// Block placement is schematic (not surveyed) — positions follow profile order until drawings exist.
import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../data/store'
import { ZONE_TYPES, nodeOf } from '../data/site'

const SLOT = [[-30, -14], [0, -18], [30, -14], [-30, 16], [0, 18], [30, 16], [-56, 0], [56, 0], [0, 44], [-30, 44], [30, 44]]
const _v = new THREE.Vector3()

function Block({ b, pos, sel, onPick, hover, setHover }) {
  const z = ZONE_TYPES[b.zone] || ZONE_TYPES.admin
  const fl = b.floors ?? ({ admin: 5, telecom: 3, dc: 2, security: 1, technical: 2, outdoor: 0 }[b.zone] ?? 2)
  const h = Math.max(0.6, fl * 3.6), w = b.zone === 'outdoor' ? 22 : b.zone === 'security' ? 8 : 16, d = b.zone === 'outdoor' ? 16 : b.zone === 'security' ? 8 : 12
  const on = sel || hover
  return <group position={[pos[0], 0, pos[1]]} onClick={e => { e.stopPropagation(); onPick(b) }} onPointerOver={e => { e.stopPropagation(); setHover(b.id); document.body.style.cursor = 'pointer' }} onPointerOut={() => { setHover(null); document.body.style.cursor = '' }}>
    {b.zone === 'outdoor' ? <>
      <mesh position={[0, 0.15, 0]}><boxGeometry args={[w, 0.3, d]} /><meshStandardMaterial color={on ? '#7fae6a' : '#4e6e45'} /></mesh>
      {Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[-w / 2 + 2 + i * 3, 0.32, 0]}><boxGeometry args={[0.15, 0.02, d * 0.7]} /><meshBasicMaterial color="#e8e2d4" /></mesh>)}
      {[-1, 1].map(s => <mesh key={s} position={[s * (w / 2 - 1), 3, d / 2 - 1]}><cylinderGeometry args={[0.12, 0.12, 6]} /><meshStandardMaterial color="#9aa3ad" /></mesh>)}
    </> : <>
      <mesh position={[0, h / 2, 0]}><boxGeometry args={[w, h, d]} /><meshStandardMaterial color={on ? '#ffffff' : '#d9d2c6'} transparent opacity={0.92} /></mesh>
      <lineSegments position={[0, h / 2, 0]}><edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} /><lineBasicMaterial color={on ? '#5fd4ff' : '#7a8a99'} /></lineSegments>
      {Array.from({ length: Math.max(0, fl - 1) }, (_, i) => <mesh key={i} position={[0, (i + 1) * 3.6, d / 2 + 0.02]}><planeGeometry args={[w, 0.12]} /><meshBasicMaterial color="#8a96a3" /></mesh>)}
    </>}
    <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[Math.max(w, d) * 0.62, Math.max(w, d) * 0.66, 48]} /><meshBasicMaterial color={z.color} transparent opacity={on ? 0.95 : 0.5} /></mesh>
  </group>
}

function Labels({ items, els }) {
  useFrame(({ camera, size }) => {
    items.forEach((it, i) => {
      const el = els.current[i]; if (!el) return
      _v.set(it.p[0], it.h + 4, it.p[1]).project(camera)
      el.style.transform = `translate(-50%,-100%) translate(${(_v.x + 1) / 2 * size.width}px,${(1 - _v.y) / 2 * size.height}px)`
    })
  })
  return null
}

export default function SiteView({ onEnter }) {
  const site = useStore(s => s.site), node = useStore(s => s.node), bld = useStore(s => s.bld)
  const n = nodeOf(site, node)
  const [hover, setHover] = useState(null)
  const els = useRef([])
  const items = useMemo(() => n.buildings.map((b, i) => ({ b, p: SLOT[i % SLOT.length], h: Math.max(0.6, (b.floors ?? ({ admin: 5, telecom: 3, dc: 2, security: 1, technical: 2, outdoor: 0 }[b.zone] ?? 2)) * 3.6) })), [n])
  const pick = (b) => { useStore.getState().setSite(n.id, b.id); onEnter && onEnter(b) }
  return <div className="siteview">
    <Canvas camera={{ position: [70, 62, 90], fov: 38 }} dpr={[1, 2]} onPointerMissed={() => setHover(null)}>
      <color attach="background" args={['#0d1a2b']} />
      <ambientLight intensity={0.5} /><directionalLight position={[60, 90, 40]} intensity={1.2} /><hemisphereLight args={['#bcd4ff', '#0b1220', 0.6]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[95, 64]} /><meshStandardMaterial color="#13243a" /></mesh>
      <gridHelper args={[190, 38, '#24476b', '#1a3350']} position={[0, 0.02, 0]} />
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[78, 79, 96]} /><meshBasicMaterial color="#5fd4ff" transparent opacity={0.6} /></mesh>
      {items.map(it => <Block key={it.b.id} b={it.b} pos={it.p} sel={it.b.id === bld} hover={hover === it.b.id} setHover={setHover} onPick={pick} />)}
      <Labels items={items} els={els} />
      <OrbitControls makeDefault enablePan={false} maxPolarAngle={1.35} minDistance={60} maxDistance={220} target={[0, 4, 8]} />
    </Canvas>
    <div className="sv-labels">{items.map((it, i) => { const z = ZONE_TYPES[it.b.zone] || ZONE_TYPES.admin
      return <button key={it.b.id} ref={el => (els.current[i] = el)} className={'sv-l' + (it.b.id === bld ? ' on' : '')} style={{ '--zc': z.color }} onClick={() => pick(it.b)}>
        <b>{it.b.name}</b><small>{z.short}{it.b.floors != null ? ` · ${it.b.floors} fl.` : ''} · {it.b.verified ? 'verified' : 'template'}</small></button> })}</div>
    <div className="sv-head"><b>{n.id} · {n.name}</b><small>Schematic placement — not surveyed. Click a building to open its digital twin.</small></div>
  </div>
}
