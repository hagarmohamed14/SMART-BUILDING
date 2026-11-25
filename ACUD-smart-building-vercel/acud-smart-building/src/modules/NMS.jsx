import { useMemo, useState, useRef, useLayoutEffect } from 'react'
import { useStore } from '../data/store'
import { DEVICES, DEV } from '../data/building'
import { useSnap, fmt, STATUS } from '../data/util'
import { network, series, hash, hstr } from '../data/sim'
import { Panel, Kpi, AlarmList, Pill, Table } from '../components/UI'
import { LineChart, Meter } from '../components/Charts'
import Twin from '../twin/LazyTwin'

// ---------- topology ----------
const N = []
const node = (id, label, kind, x, y, dev, extra = {}) => { N.push({ id, label, kind, x, y, dev, ...extra }); return id }
node('isp1', 'ISP-A 1 Gb/s', 'cloud', 0.32, 0.07); node('isp2', 'ISP-B 1 Gb/s', 'cloud', 0.68, 0.07)
node('er1', 'ER-1', 'router', 0.32, 0.2, 'ROUTER-L1-01'); node('er2', 'ER-2', 'router', 0.68, 0.2, 'ROUTER-L1-02')
node('fw1', 'FW-1', 'firewall', 0.32, 0.33, 'FIREWALL-L1-01'); node('fw2', 'FW-2', 'firewall', 0.68, 0.33, 'FIREWALL-L1-02')
node('cs1', 'CS-1', 'core', 0.38, 0.48, 'CORE-L1-01'); node('cs2', 'CS-2', 'core', 0.62, 0.48, 'CORE-L1-02')
node('spine', 'DC Spine', 'dist', 0.08, 0.64, null, { desc: '2 × 32×100G spine, 16 ToR pairs' })
node('ot', 'OT / BMS', 'dist', 0.92, 0.64, null, { desc: 'Isolated OT switch stack: BMS, fire, gas, meters' })
const SW = DEVICES.filter(d => d.type === 'switch')
SW.forEach((d, i) => node(d.id, d.level + (d.name.endsWith('A') ? '-A' : '-B'), 'access', 0.2 + i * (0.6 / (SW.length - 1)), 0.68, d.id))
const APS = DEVICES.filter(d => d.type === 'ap')
const L = []
const link = (a, b, cap, fiber = true) => L.push({ a, b, cap, fiber })
link('isp1', 'er1', 1000, true); link('isp2', 'er2', 1000, true); link('er1', 'fw1', 10000); link('er2', 'fw2', 10000); link('er1', 'fw2', 10000); link('er2', 'fw1', 10000)
link('fw1', 'cs1', 40000); link('fw2', 'cs2', 40000); link('cs1', 'cs2', 100000)
link('cs1', 'spine', 100000); link('cs2', 'spine', 100000); link('cs1', 'ot', 10000); link('cs2', 'ot', 10000)
SW.forEach(d => { link('cs1', d.id, 10000); link('cs2', d.id, 10000) })
const apParent = (ap) => SW.find(s => s.level === ap.level)?.id || 'ot'

export const VLANS = [
  [10, 'Corporate LAN', 'cs1', 412], [20, 'Guest Wi-Fi', 'cs1', 230], [30, 'CCTV', 'ot', 26], [40, 'Access control', 'ot', 31], [50, 'BMS / OT', 'ot', 188],
  [60, 'VoIP', 'cs2', 260], [100, 'DC servers', 'spine', 342], [999, 'Management', 'cs2', 64],
]

function useSize() { const ref = useRef(), [s, setS] = useState([800, 500]); useLayoutEffect(() => { const ro = new ResizeObserver(([e]) => setS([e.contentRect.width, e.contentRect.height])); ro.observe(ref.current); return () => ro.disconnect() }, []); return [ref, s] }

export default function NMS() {
  const snap = useSnap(), st = useStore(), net = snap.net
  const [sel, setSel] = useState('cs1')
  const [ref, [W, H]] = useSize()
  const down = (n) => n.dev && st.status[n.dev] === 'offline'
  const byId = Object.fromEntries(N.map(n => [n.id, n]))
  const util = (l) => { const base = l.a.startsWith('isp') ? net.wanIn / 1000 : 0.12 + 0.5 * hash(hstr(l.a + l.b)) * (net.wanIn / 1600); return Math.min(0.98, base) }
  const hist = useMemo(() => ({ inb: series(t => network(t, snap.sc).wanIn, snap.now, 24, 20), out: series(t => network(t, snap.sc).wanOut, snap.now, 24, 20), lat: series(t => network(t, snap.sc).latency, snap.now, 24, 20) }), [Math.floor(snap.now / 300000), snap.sc])
  const netDevs = DEVICES.filter(d => d.sys === 'nms')
  const up = netDevs.filter(d => st.status[d.id] !== 'offline').length
  const n = byId[sel]
  const nd = n?.dev ? DEV[n.dev] : null
  const pick = (id) => { setSel(id); const x = byId[id]; if (x?.dev) st.selectDevice(x.dev) }
  const X = (x) => 30 + x * (W - 60), Y = (y) => 20 + y * (H - 40)
  return (
    <div className="mod">
      <div className="cols">
        <div className="col left">
          <Panel title="Network health">
            <div className="kgrid k3">
              <Kpi label="Devices up" value={`${up}/${netDevs.length}`} color={up < netDevs.length ? '#d08a1e' : '#5f8a52'} />
              <Kpi label="WAN in" value={fmt(net.wanIn, 0)} unit="Mb/s" sub="of 2,000" />
              <Kpi label="WAN out" value={fmt(net.wanOut, 0)} unit="Mb/s" />
              <Kpi label="Latency" value={fmt(net.latency, 1)} unit="ms" color={net.latency > 15 ? '#d08a1e' : null} />
              <Kpi label="Packet loss" value={fmt(net.loss, 2)} unit="%" color={net.loss > 0.5 ? '#c4553f' : null} />
              <Kpi label="Wi-Fi clients" value={fmt(net.wifiClients)} />
            </div>
          </Panel>
          <Panel title="WAN bandwidth" sub="24 h">
            <LineChart h={120} unit="Mb/s" series={[{ name: 'Inbound', color: '#c98a2e', data: hist.inb, area: true }, { name: 'Outbound', color: '#8a8073', data: hist.out }]} />
            <LineChart h={80} unit="ms" digits={1} series={[{ name: 'Latency', color: '#4f7a92', data: hist.lat }]} />
          </Panel>
          <Panel title="VLANs">
            <Table cols={[{ k: 'id', l: 'VLAN', f: r => <b>{r[0]}</b> }, { k: 'n', l: 'Name', f: r => r[1] }, { k: 'h', l: 'Hosts', r: 1, f: r => r[3] }, { k: 'u', l: 'Util.', r: 1, f: r => fmt(8 + 60 * hash(r[0]) * (net.wanIn / 1600), 0) + '%' },
              { k: 's', l: '', f: r => <Pill s={snap.sc.netDown && [10, 20].includes(r[0]) ? 'warn' : 'ok'}>{snap.sc.netDown && [10, 20].includes(r[0]) ? 'Degraded' : 'Up'}</Pill> }]}
              rows={VLANS.map(v => ({ ...v, id: v[0] }))} onRow={r => pick(r[2])} />
          </Panel>
        </div>
        <div className="col center split nms">
          <div className="wall-h"><b>Topology</b><span>click a node for details · line width = utilisation</span>
            <span className="lg-v"><span><i style={{ background: '#c98a2e' }} />Fibre</span><span><i style={{ background: '#a89c8c' }} />Copper</span><span><i style={{ background: '#c4553f' }} />Down</span></span></div>
          <div className="topo" ref={ref}>
            <svg width={W} height={H}>
              {[['WAN', 0.07], ['Edge', 0.2], ['Security', 0.33], ['Core', 0.48], ['Access', 0.68], ['Wireless', 0.9]].map(([t, y]) => <g key={t}><line x1={0} x2={W} y1={Y(y)} y2={Y(y)} className="lane" /><text x={6} y={Y(y) - 6} className="lane-t">{t}</text></g>)}
              {L.map((l, k) => { const a = byId[l.a], b = byId[l.b]; const dn = down(a) || down(b); const u = util(l); const d = `M${X(a.x)},${Y(a.y)} C${X(a.x)},${(Y(a.y) + Y(b.y)) / 2} ${X(b.x)},${(Y(a.y) + Y(b.y)) / 2} ${X(b.x)},${Y(b.y)}`
                return <g key={k} className={sel === l.a || sel === l.b ? 'hl' : ''}>
                  <path d={d} className="lk" stroke={dn ? '#c4553f' : l.fiber ? '#d9b27a' : '#c7bdb0'} strokeWidth={1 + u * 3.5} />
                  {!dn && <path d={d} className="flow" stroke="#c98a2e" strokeWidth={1.4 + u * 1.5} style={{ animationDuration: `${2.6 - u * 1.8}s` }} />}
                  {dn && <path d={d} stroke="#c4553f" strokeWidth={2} strokeDasharray="5 4" fill="none" />}
                </g> })}
              {APS.map((ap, i) => { const p = byId[apParent(ap)]; const sibs = APS.filter(x => apParent(x) === apParent(ap)); const j = sibs.indexOf(ap); const x = X(p.x) + (j - (sibs.length - 1) / 2) * 16, y = Y(0.9); const dn = st.status[ap.id] === 'offline'
                return <g key={ap.id} onClick={() => { setSel(apParent(ap)); st.selectDevice(ap.id) }} className="apn" style={{ cursor: 'pointer' }}>
                  <line x1={X(p.x)} y1={Y(p.y) + 12} x2={x} y2={y - 6} stroke={dn ? '#c4553f' : '#cfc4b4'} strokeDasharray={dn ? '3 3' : null} />
                  <circle cx={x} cy={y} r={6} fill={dn ? '#f3d3cb' : '#fbf8f3'} stroke={dn ? '#c4553f' : '#c98a2e'} strokeWidth={1.5} /><title>{ap.name} · {dn ? 'offline' : 'online'}</title></g> })}
              {N.map(nn => { const dn = down(nn); const isSel = sel === nn.id; const r = nn.kind === 'access' ? 13 : 18
                return <g key={nn.id} transform={`translate(${X(nn.x)},${Y(nn.y)})`} onClick={() => pick(nn.id)} className={'nd ' + nn.kind + (isSel ? ' sel' : '') + (dn ? ' down' : '')} role="button">
                  {isSel && <circle r={r + 7} className="halo" />}
                  {nn.kind === 'cloud' ? <ellipse rx={r + 14} ry={r - 4} /> : nn.kind === 'firewall' ? <rect x={-r} y={-r * 0.75} width={r * 2} height={r * 1.5} rx={4} /> : nn.kind === 'core' ? <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.5} transform="rotate(45)" /> : <circle r={r} />}
                  <text y={4} textAnchor="middle" className="ic">{nn.kind === 'cloud' ? 'WAN' : nn.kind === 'router' ? 'R' : nn.kind === 'firewall' ? 'FW' : nn.kind === 'core' ? 'CS' : nn.kind === 'dist' ? 'D' : 'SW'}</text>
                  <text y={nn.kind === 'cloud' ? -r - 6 : r + 14} textAnchor="middle" className="lb">{nn.label}</text>
                  {dn && <circle cx={r - 2} cy={-r + 2} r={5} fill="#c4553f" />}
                </g> })}
            </svg>
          </div>
          <div className="wall-twin small"><Twin layer="nms" compact /></div>
        </div>
        <div className="col right">
          <Panel title={n ? (nd ? nd.name : n.label) : 'Node'} sub={nd ? `${nd.level} · ${nd.room}` : n?.desc}>
            {n && <>
              <div className="cam-meta"><Pill s={down(n) ? 'offline' : 'ok'}>{down(n) ? 'Down' : 'Up'}</Pill><span>{n.kind === 'cloud' ? 'Carrier circuit' : `10.0.${Math.floor(hash(hstr(n.id)) * 250)}.${Math.floor(hash(hstr(n.id) + 1) * 250)}`}</span><span>Uptime {down(n) ? '0 d' : `${Math.floor(40 + 200 * hash(hstr(n.id)))} d`}</span></div>
              <div className="kgrid k3">
                <Kpi label="CPU" value={down(n) ? '—' : fmt(10 + 40 * hash(hstr(n.id) + 2) * (0.5 + net.wanIn / 2000), 0)} unit="%" />
                <Kpi label="Memory" value={down(n) ? '—' : fmt(30 + 40 * hash(hstr(n.id) + 3), 0)} unit="%" />
                <Kpi label="Temp" value={down(n) ? '—' : fmt(38 + 12 * hash(hstr(n.id) + 4), 0)} unit="°C" />
              </div>
              <h5 className="sub-h">Interfaces</h5>
              <div className="ifs">{L.filter(l => l.a === n.id || l.b === n.id).slice(0, 8).map((l, k) => { const o = byId[l.a === n.id ? l.b : l.a]; const u = util(l); const dn = down(n) || down(o)
                return <div key={k} onClick={() => pick(o.id)}><b>{k < 4 ? `Te1/0/${k + 1}` : `Hu1/0/${k - 3}`}</b><span>→ {o.label}</span><Meter v={dn ? 0 : u * 100} warn={70} crit={90} /><em>{dn ? 'down' : `${fmt(u * l.cap / 1000, 1)} / ${l.cap / 1000} G`}</em></div> })}</div>
            </>}
          </Panel>
          <Panel title="Network incidents" src={false}><AlarmList sys="nms" limit={6} compact empty="No network incidents" /></Panel>
          <Panel title="Wireless access points" className="grow">
            <div className="crah">{APS.map(ap => <button key={ap.id} onClick={() => st.selectDevice(ap.id)}><i style={{ background: (STATUS[st.status[ap.id]] || STATUS.ok).color }} /><b>{ap.name}</b><span>{st.status[ap.id] === 'offline' ? 'offline' : `${fmt(net.wifiClients / APS.length * (0.6 + 0.8 * hash(hstr(ap.id))), 0)} clients`}</span></button>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
