// CCTV — wide horizontal layout: camera list | full-width video wall, with a horizontal
// toolbar (view, layout, Live / Playback / AI Analytics) and a horizontal control bar
// (PTZ, Snapshot, Record, Audio, Bookmark, Camera settings).
import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { DEVICES, LEVELS, LEVEL, DEV } from '../data/building'
import { useSnap, tms } from '../data/util'
import { hash, hstr, hourOf, occ, MIN, HOUR } from '../data/sim'
import { AlarmList, Pill } from '../components/UI'
import CamFeed, { camName, camThumb, camKind } from '../components/CamFeed'
import Twin from '../twin/LazyTwin'
import Icon from '../components/Icons'

const CAMS = DEVICES.filter(d => d.type === 'camera')
CAMS.forEach(c => camName(c)) // fix framing order
const LAYOUTS = { '1x1': 1, '2x2': 4, '3x3': 9, '4x4': 16 }

export default function CCTV() {
  const snap = useSnap(), st = useStore()
  const [q, setQ] = useState(''), [fs, setFs] = useState('all'), [fl, setFl] = useState('all'), [page, setPage] = useState(0)
  const [layout, setLayout] = useState('3x3'), [view, setView] = useState('grid'), [mode, setMode] = useState('live'), [ai, setAi] = useState(false)
  const [back, setBack] = useState(2), [ptzOn, setPtzOn] = useState(false), [ptz, setPtz] = useState({}), [audio, setAudio] = useState(false)
  const [side, setSide] = useState(false), [cfg, setCfg] = useState(false), [map, setMap] = useState(false)
  const sel = st.device && DEV[st.device]?.type === 'camera' ? st.device : null
  const night = (() => { const h = hourOf(snap.now); return h < 6 || h > 18.5 })()
  const camSt = (id) => st.status[id] === 'ok' ? 'online' : st.status[id] === 'maint' ? 'maint' : 'offline'
  const motionOf = (id) => camSt(id) === 'online' && hash(hstr(id) * 1000 + Math.floor(snap.now / (2 * MIN))) > 0.62
  const people = (c) => camSt(c.id) !== 'online' ? 0 : Math.round((['lobby', 'entrance', 'cafe', 'corridor'].includes(camKind(c)) ? 4 + 26 * hstr(c.id) : 1 + 6 * hstr(c.id)) * occ(snap.now) + hash(hstr(c.id) + Math.floor(snap.now / MIN)) * 2)
  const list = CAMS.filter(c => (fs === 'all' || camSt(c.id) === fs) && (fl === 'all' || c.level === fl) && (!q || (c.id + camName(c) + c.room).toLowerCase().includes(q.toLowerCase())))
  const on = CAMS.filter(c => camSt(c.id) === 'online').length, off = CAMS.filter(c => camSt(c.id) === 'offline').length
  const per = LAYOUTS[layout], pages = Math.max(1, Math.ceil(list.length / per))
  const pg = Math.min(page, pages - 1)
  const wall = layout === '1x1' ? [DEV[sel] || list[0]].filter(Boolean) : list.slice(pg * per, pg * per + per)
  const playTs = mode === 'playback' ? snap.now - back * HOUR : null
  const cur = sel ? DEV[sel] : wall[0]
  const recOf = (id) => (st.rec[id] || 'Continuous') !== 'Off'
  const pz = (id) => ptz[id] || { x: 0, y: 0, z: 1 }
  const movePtz = (dx, dy, dz) => { if (!cur || !st.guard()) return; const p = pz(cur.id); setPtz({ ...ptz, [cur.id]: { x: Math.max(-1, Math.min(1, p.x + dx)), y: Math.max(-1, Math.min(1, p.y + dy)), z: Math.max(1, Math.min(4, p.z + dz)) } }) }
  const snapshot = () => {
    if (!cur) return
    const cv = document.querySelector(`canvas[data-cam="${cur.id}"]`)
    if (cv) { const a = document.createElement('a'); a.href = cv.toDataURL('image/jpeg', 0.9); a.download = `${cur.id}_${Math.floor(snap.now / 1000)}.jpg`; a.click() }
    st.toast(`Snapshot saved: ${cur.id}_${Math.floor(snap.now / 1000)}.jpg`)
  }
  const motionEvents = useMemo(() => {
    const out = []
    for (let k = 0; k < 18; k++) { const t = snap.now - k * 2 * MIN; CAMS.forEach(c => { if (st.status[c.id] === 'ok' && hash(hstr(c.id) * 1000 + Math.floor(t / (2 * MIN))) > 0.86) out.push({ ts: Math.floor(t / (2 * MIN)) * 2 * MIN, cam: c, cls: hash(hstr(c.id) + k) > 0.7 ? 'Vehicle' : 'Person' }) }) }
    return out.slice(0, 24)
  }, [Math.floor(snap.now / (2 * MIN)), st.status])
  const nAl = useStore(s => s.alarms).filter(a => a.sys === 'cctv' && a.state !== 'resolved').length
  const swap = (c) => { st.selectDevice(c.id); setLayout(layout === '1x1' ? '3x3' : '1x1') }

  return (
    <div className="mod cctv">
      {/* ---------- horizontal toolbar ---------- */}
      <div className="cc-bar top">
        <div className="seg" role="group" aria-label="View">
          <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} title="Grid view"><Icon n="grid" s={15} /></button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} title="List view"><Icon n="list" s={15} /></button>
        </div>
        <select className="tsel" value={layout} onChange={e => { setLayout(e.target.value); setPage(0) }} aria-label="Layout">{Object.keys(LAYOUTS).map(k => <option key={k}>{k}</option>)}</select>
        <select className="tsel" value={fl} onChange={e => { setFl(e.target.value); setPage(0) }} aria-label="Floor"><option value="all">All floors</option>{LEVELS.map(L => <option key={L.id} value={L.id}>{L.id} · {L.use}</option>)}</select>
        <div className="seg sm">{[['all', 'All'], ['online', 'Online'], ['offline', 'Offline'], ['maint', 'Maint.']].map(([k, l]) => <button key={k} className={fs === k ? 'on' : ''} onClick={() => { setFs(k); setPage(0) }}>{l}</button>)}</div>
        <span className="cc-sep" />
        <button className={'cc-btn' + (mode === 'live' ? ' on live' : '')} onClick={() => setMode('live')}><i className="rec-dot" />Live</button>
        <button className={'cc-btn' + (mode === 'playback' ? ' on' : '')} onClick={() => setMode('playback')}><Icon n="history" s={15} />Playback</button>
        {mode === 'playback' && <label className="cc-scrub">−{back.toFixed(1)} h<input type="range" min="0.1" max="24" step="0.1" value={back} onChange={e => setBack(+e.target.value)} aria-label="Playback offset" /></label>}
        <button className={'cc-btn' + (ai ? ' on' : '')} onClick={() => setAi(!ai)} aria-pressed={ai}><Icon n="sparkle" s={15} />AI Analytics</button>
        <span className="cc-time"><Icon n="history" s={14} />{new Date(playTs || snap.now).toLocaleString('en-GB', { hour12: false }).replace(',', '')}</span>
        <span className="cc-sp" />
        <span className="demo-tag">Demo feeds · not live footage</span>
        {night && <em className="cc-ir">IR night mode</em>}
        <button className={'cc-btn' + (map ? ' on' : '')} onClick={() => setMap(!map)} title="Camera map on the digital twin"><Icon n="cube" s={15} />Map</button>
        <button className={'cc-btn' + (side ? ' on' : '')} onClick={() => setSide(!side)}><Icon n="bell" s={15} />Events{nAl > 0 && <em>{nAl}</em>}</button>
        <button className="cc-btn ic" onClick={() => document.querySelector('.cc-main')?.requestFullscreen?.()} title="Full screen" aria-label="Full screen"><Icon n="expand" s={15} /></button>
      </div>

      <div className="cc-body">
        {/* ---------- camera list ---------- */}
        <aside className="cc-list">
          <div className="cc-search"><Icon n="search" s={14} /><input value={q} onChange={e => { setQ(e.target.value); setPage(0) }} placeholder="Search camera…" aria-label="Search camera" /></div>
          <div className="cc-items">{list.map(c => <button key={c.id} className={sel === c.id ? 'on' : ''} onClick={() => st.selectDevice(c.id)} onDoubleClick={() => { st.selectDevice(c.id); setLayout('1x1') }}>
            <img src={camThumb(c)} alt="" className={camSt(c.id) !== 'online' ? 'off' : ''} />
            <div><b>{camName(c)}</b><span><i className={'st ' + camSt(c.id)} />{camSt(c.id) === 'online' ? 'Online' : camSt(c.id) === 'maint' ? 'Maintenance' : 'Offline'}{motionOf(c.id) && <em>motion</em>}</span><small>{c.id}</small></div>
          </button>)}</div>
        </aside>

        {/* ---------- video wall ---------- */}
        <section className="cc-main">
          {map ? <div className="cc-map"><Twin layer="cctv" /></div>
            : view === 'list' ? <div className="cc-table"><table className="ftbl"><thead><tr><th>Camera</th><th>Location</th><th>Status</th><th>People</th><th>Recording</th><th>Stream</th><th /></tr></thead>
              <tbody>{list.map(c => <tr key={c.id} className={'click' + (sel === c.id ? ' on' : '')} onClick={() => st.selectDevice(c.id)}>
                <td><b>{camName(c)}</b> <small>{c.id}</small></td><td>{LEVEL[c.level].name} · {c.room}</td><td><Pill s={camSt(c.id) === 'online' ? 'ok' : camSt(c.id) === 'maint' ? 'maint' : 'offline'}>{camSt(c.id)}</Pill></td>
                <td>{people(c)}</td><td>{st.rec[c.id] || 'Continuous'}</td><td>4K · H.265 · 25 fps</td><td><button className="lnk" onClick={e => { e.stopPropagation(); st.selectDevice(c.id); setView('grid'); setLayout('1x1') }}>Open</button></td></tr>)}</tbody></table></div>
            : <div className={'cc-wall n' + per}>{wall.map(c => <div key={c.id} className={'cc-tile' + (sel === c.id ? ' on' : '')} onClick={() => st.selectDevice(c.id)} onDoubleClick={() => swap(c)}>
              <CamFeed d={c} big={per <= 4} offline={camSt(c.id) !== 'online' || st.mode === 'offline'} night={night} motion={motionOf(c.id)} ai={ai} ptz={pz(c.id)} playTs={playTs} rec={recOf(c.id)} />
              <div className="cc-cap"><i className={'st ' + camSt(c.id)} /><b>{camName(c)}</b><span>{tms(playTs || snap.now)}</span><button title={layout === '1x1' ? 'Back to grid' : 'Single view'} onClick={e => { e.stopPropagation(); swap(c) }}><Icon n="expand" s={12} /></button></div>
              {ai && camSt(c.id) === 'online' && <div className="cc-ppl"><Icon n="user" s={12} />{people(c)}</div>}
            </div>)}
              {layout !== '1x1' && pages > 1 && <div className="cc-pager"><button onClick={() => setPage((pg - 1 + pages) % pages)} aria-label="Previous page">‹</button><span>{pg + 1}/{pages}</span><button onClick={() => setPage((pg + 1) % pages)} aria-label="Next page">›</button></div>}
            </div>}
          {side && <div className="cc-side">
            <div className="pop-h"><b>Video alarms</b><button onClick={() => setSide(false)}>Close</button></div>
            <AlarmList sys="cctv" limit={5} compact empty="No video alarms" />
            <div className="pop-h" style={{ marginTop: 10 }}><b>Motion & analytics events</b></div>
            <div className="hist">{motionEvents.map((m, i) => <div key={i} className="click" onClick={() => st.selectDevice(m.cam.id)}><span>{tms(m.ts)}</span><Pill s={m.cls === 'Person' ? 'warn' : 'maint'}>{m.cls}</Pill><b>{camName(m.cam)}</b><em>{m.cam.id}</em></div>)}</div>
          </div>}
        </section>
      </div>

      {/* ---------- horizontal control bar ---------- */}
      <div className="cc-bar bottom">
        <div className="cc-count">
          <Icon n="check" s={20} c="#5f8a52" />
          <div><small>Total cameras</small><b>{CAMS.length}</b></div>
          <div><small><i className="st online" />Online</small><b>{on}</b></div>
          <div><small><i className="st offline" />Offline</small><b>{off}</b></div>
        </div>
        <div className="cc-sel">{cur ? <><b>{camName(cur)}</b><small>{cur.id} · {LEVEL[cur.level].name}</small></> : <small>No camera selected</small>}</div>
        <div className="cc-ctl">
          <div className="ptz-wrap">
            <button className={ptzOn ? 'on' : ''} onClick={() => setPtzOn(!ptzOn)} disabled={!cur}><Icon n="move" s={16} />PTZ Control</button>
            {ptzOn && cur && <div className="ptz-pad" onMouseLeave={() => setPtzOn(false)}>
              <button style={{ gridArea: 'u' }} onClick={() => movePtz(0, -0.25, 0)} aria-label="Tilt up">▲</button>
              <button style={{ gridArea: 'l' }} onClick={() => movePtz(-0.25, 0, 0)} aria-label="Pan left">◀</button>
              <button style={{ gridArea: 'c' }} onClick={() => setPtz({ ...ptz, [cur.id]: { x: 0, y: 0, z: 1 } })} title="Home preset">⌂</button>
              <button style={{ gridArea: 'r' }} onClick={() => movePtz(0.25, 0, 0)} aria-label="Pan right">▶</button>
              <button style={{ gridArea: 'd' }} onClick={() => movePtz(0, 0.25, 0)} aria-label="Tilt down">▼</button>
              <button style={{ gridArea: 'zi' }} onClick={() => movePtz(0, 0, 0.5)}>Zoom +</button>
              <button style={{ gridArea: 'zo' }} onClick={() => movePtz(0, 0, -0.5)}>Zoom −</button>
              <small style={{ gridArea: 'i' }}>{cur.id} · {pz(cur.id).z.toFixed(1)}×</small>
            </div>}
          </div>
          <button onClick={snapshot} disabled={!cur}><Icon n="camera" s={16} />Take Snapshot</button>
          <button className={cur && recOf(cur.id) ? 'rec' : ''} onClick={() => cur && st.setRec(cur.id, recOf(cur.id) ? 'Off' : 'Continuous')} disabled={!cur}><Icon n="rec" s={16} />{cur && recOf(cur.id) ? 'Recording' : 'Record'}</button>
          <button onClick={() => cur && st.toast(`Bookmark saved on ${cur.id} at ${tms(playTs || snap.now)}`)} disabled={!cur}><Icon n="layers" s={16} />Bookmark</button>
          <label className="cc-audio"><Icon n={audio ? 'volume' : 'mute'} s={16} />Audio
            <input type="checkbox" checked={audio} onChange={e => { setAudio(e.target.checked); if (e.target.checked) st.toast('Audio channel opened — demo cameras carry no audio track') }} /><span className="sw" /></label>
        </div>
        <div className="cfg-wrap">
          <button className="cc-btn" onClick={() => setCfg(!cfg)} disabled={!cur}><Icon n="gear" s={15} />Camera Settings</button>
          {cfg && cur && <div className="cfg-pop" onMouseLeave={() => setCfg(false)}>
            <b>{cur.id}</b>
            <label>Recording<div className="seg sm">{['Continuous', 'Motion', 'Off'].map(v => <button key={v} className={(st.rec[cur.id] || 'Continuous') === v ? 'on' : ''} onClick={() => st.setRec(cur.id, v)}>{v}</button>)}</div></label>
            <div className="cfg-kv"><span>Stream</span><b>4K · H.265 · 25 fps</b><span>Retention</span><b>30 days</b><span>Mode</span><b>{night ? 'IR on' : 'Day'}</b><span>Last service</span><b>{new Date(snap.now - (5 + Math.floor(hstr(cur.id) * 80)) * 24 * HOUR).toLocaleDateString('en-GB')}</b></div>
            <button onClick={() => st.setDevStatus(cur.id, st.status[cur.id] === 'maint' ? 'ok' : 'maint')}>{st.status[cur.id] === 'maint' ? 'Return to service' : 'Put in maintenance'}</button>
          </div>}
        </div>
      </div>
    </div>
  )
}
