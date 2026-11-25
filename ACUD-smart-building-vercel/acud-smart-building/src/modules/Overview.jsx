import { animate } from '../components/Anim'
import { useMemo, useState, useEffect } from 'react'
import { useStore, activeAlarms } from '../data/store'
import { DEVICES, LEVELS, SYSTEMS, DEV, LEVEL } from '../data/building'
import { useSnap, fmt, fmtK, STATUS, SEV } from '../data/util'
import { electricity, water, gas, dailyTotals, series, DAY } from '../data/sim'
import { Panel, Kpi, AlarmList, Seg } from '../components/UI'
import { Spark, Bars, Gauge, LineChart } from '../components/Charts'
import Twin from '../twin/LazyTwin'
import PhotoHero from '../components/PhotoHero'
import { lazy, Suspense } from 'react'
const SiteView = lazy(() => import('../twin/SiteView'))
import Icon from '../components/Icons'

export function useHealth() {
  const status = useStore(s => s.status), alarms = useStore(s => s.alarms)
  return useMemo(() => {
    const act = activeAlarms(alarms)
    const bySys = {}
    Object.keys(SYSTEMS).forEach(k => {
      const devs = DEVICES.filter(d => d.sys === k), ok = devs.filter(d => ['ok', 'run'].includes(status[d.id])).length
      const al = act.filter(a => a.sys === k)
      const crit = al.some(a => a.sev === 'critical'), maj = al.some(a => a.sev === 'major')
      bySys[k] = { total: devs.length, ok, avail: devs.length ? ok / devs.length * 100 : 100, alarms: al.length, state: crit ? 'alarm' : maj ? 'warn' : al.length ? 'warn' : 'ok' }
    })
    const okAll = DEVICES.filter(d => ['ok', 'run'].includes(status[d.id])).length
    const score = Math.max(0, 100 - act.reduce((s, a) => s + (a.sev === 'critical' ? 12 : a.sev === 'major' ? 4 : 1.2), 0))
    return { bySys, avail: okAll / DEVICES.length * 100, okAll, score, act }
  }, [status, alarms])
}

const RANGE_DAYS = { '24h': 1, '7d': 7, '30d': 30 }
export default function Overview() {
  const snap = useSnap(), H = useHealth(), filters = useStore(s => s.filters), go = useStore(s => s.go), mode = useStore(s => s.mode)
  const { setFilter, setLevel, setLayer, locate } = useStore.getState()
  const [heroView, setHeroView] = useState('photo')
  const selLevel = useStore(s => s.level), selDevice = useStore(s => s.device), focusTick = useStore(s => s.focusTick)
  useEffect(() => { if (selLevel || selDevice) setHeroView('3d') }, [selLevel, selDevice, focusTick])
  const days = RANGE_DAYS[filters.range]
  const totals = useMemo(() => {
    const sc = snap.sc
    const e = dailyTotals('e', t => electricity(t, sc).kw, snap.now, days), w = dailyTotals('w', t => water(t, sc).flow, snap.now, days), g = dailyTotals('g', t => gas(t, sc).flow, snap.now, days)
    const sum = a => a.reduce((s, x) => s + x.v, 0)
    return { e: sum(e), w: sum(w), g: sum(g), es: e, ws: w, gs: g }
  }, [Math.floor(snap.now / 600000), days, snap.sc])
  const daySeries = useMemo(() => series(t => electricity(t, snap.sc).kw, snap.now, 24, 20), [Math.floor(snap.now / 300000), snap.sc])

  const q = filters.q.trim().toLowerCase()
  const matches = q.length > 1 ? DEVICES.filter(d => (d.name + d.id + d.room).toLowerCase().includes(q) && (filters.level === 'all' || d.level === filters.level) && (filters.sys === 'all' || d.sys === filters.sys)).slice(0, 12) : []
  const status = useStore(s => s.status)
  const pm = useMemo(() => PM_TASKS(snap.now), [Math.floor(snap.now / DAY)])

  const sysCard = (k, metric, unit, mod) => {
    const h = H.bySys[k]
    return <button key={k} className={'sys-card ' + h.state} onClick={() => go(mod || k)}>
      <div className="sc-h"><Icon n={k} s={16} /><b>{SYSTEMS[k].name}</b><i className="dot" style={{ background: (STATUS[h.state] || STATUS.ok).color }} /></div>
      <div className="sc-v">{animate(metric)}<small>{unit}</small></div>
      <div className="sc-f"><span>{fmt(h.avail, 1)}% avail.</span>{h.alarms > 0 ? <em>{h.alarms} alarm{h.alarms > 1 ? 's' : ''}</em> : <span>no alarms</span>}</div>
    </button>
  }
  return (
    <div className="mod overview">
      <div className="filters">
        <Icon n="filter" s={15} />
        <label>Floor<select value={filters.level} onChange={e => { setFilter('level', e.target.value); setLevel(e.target.value === 'all' ? null : e.target.value) }}>
          <option value="all">All floors</option>{LEVELS.map(L => <option key={L.id} value={L.id}>{L.id} · {L.use}</option>)}</select></label>
        <label>Subsystem<select value={filters.sys} onChange={e => { setFilter('sys', e.target.value); setLayer(e.target.value === 'all' ? null : e.target.value) }}>
          <option value="all">All subsystems</option>{Object.entries(SYSTEMS).map(([k, v]) => <option key={k} value={k}>{v.full}</option>)}</select></label>
        <label>Status<select value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="all">Any status</option><option value="alarm">In alarm</option><option value="warn">Warning</option><option value="offline">Offline</option><option value="maint">Maintenance</option><option value="ok">Normal</option></select></label>
        <label>Period<Seg small value={filters.range} options={[['24h', 'Today'], ['7d', '7 days'], ['30d', '30 days']]} onChange={v => setFilter('range', v)} /></label>
        <div className="search">
          <Icon n="search" s={14} /><input placeholder="Find equipment (e.g. AHU, rack B4, ESV)…" value={filters.q} onChange={e => setFilter('q', e.target.value)} />
          {matches.length > 0 && <div className="s-res">{matches.map(d => <button key={d.id} onClick={() => { locate(d.id); setFilter('q', '') }}>
            <i style={{ background: SYSTEMS[d.sys].color }} /><b>{d.name}</b><span>{d.level} · {d.room}</span><em style={{ color: (STATUS[status[d.id]] || STATUS.ok).color }}>{(STATUS[status[d.id]] || STATUS.ok).label}</em></button>)}</div>}
        </div>
      </div>

      <div className="cols">
        <div className="col left">
          <Panel title="Building status" sub={mode === 'offline' ? 'Last known' : 'Now'}>
            <div className="health">
              <Gauge v={H.score} label="Operational score" unit="/100" color="#5f8a52" warn={0} crit={-1} size={128} />
              <div className="h-st">
                <b className={H.act.some(a => a.sev === 'critical') ? 'crit' : H.act.some(a => a.sev === 'major') ? 'warn' : 'ok'}>
                  {H.act.some(a => a.sev === 'critical') ? 'Critical incident' : H.act.some(a => a.sev === 'major') ? 'Attention required' : 'All systems normal'}</b>
                <span>{fmt(H.avail, 1)}% equipment availability</span>
                <span>{H.okAll} / {DEVICES.length} devices normal</span>
              </div>
            </div>
            <div className="kgrid k3">
              <Kpi label="Floors" value={LEVELS.length} sub="B1 – Roof" onClick={() => setLevel(null)} />
              <Kpi label="Monitored zones" value={LEVELS.length * 4} sub="4 per floor" />
              <Kpi label="Active systems" value={Object.keys(SYSTEMS).length} sub="all reporting" />
              <Kpi label="Connected devices" value={fmt(DEVICES.length)} sub={`${DEVICES.length - H.okAll} not normal`} />
              <Kpi label="Active alarms" value={H.act.length} color={H.act.length ? SEV.major.color : null} sub={`${H.act.filter(a => a.state === 'active').length} unacknowledged`} />
              <Kpi label="Critical" value={H.act.filter(a => a.sev === 'critical').length} color={H.act.some(a => a.sev === 'critical') ? SEV.critical.color : null} sub="incidents" />
            </div>
          </Panel>
          <Panel title="Subsystems" sub="click to open" src={false}>
            <div className="sys-grid">
              {sysCard('bms', fmt(snap.climate.L3.temp, 1), '°C avg')}
              {sysCard('access', fmt(snap.climate.L3.occ * 612, 0), 'people in')}
              {sysCard('fire', snap.sc.fire ? 'FIRE' : 'Normal', '')}
              {sysCard('cctv', H.bySys.cctv.ok + '/' + H.bySys.cctv.total, 'online')}
              {sysCard('dc', fmt(snap.dc.pue, 2), 'PUE')}
              {sysCard('nms', fmt(snap.net.latency, 1), 'ms latency')}
              {sysCard('elec', fmt(snap.elec.kw, 0), 'kW')}
              {sysCard('water', fmt(snap.water.flow, 1), 'm³/h')}
              {sysCard('gas', fmt(snap.gas.flow, 1), 'm³/h')}
            </div>
          </Panel>
        </div>

        <div className="col center hero-wrap">
          {heroView === 'photo' ? <PhotoHero H={H} /> : heroView === 'site' ? <Suspense fallback={<div className="twin-loading"><i /><span>Loading site view…</span></div>}><SiteView onEnter={() => setHeroView('3d')} /></Suspense> : <Twin />}
          <div className="seg hero-toggle" role="tablist" aria-label="Centre view">
            <button className={heroView === 'photo' ? 'on' : ''} onClick={() => setHeroView('photo')}><Icon n="image" s={14} />Building photo</button>
            <button className={heroView === '3d' ? 'on' : ''} onClick={() => setHeroView('3d')}><Icon n="cube" s={14} />3D digital twin</button>
            <button className={heroView === 'site' ? 'on' : ''} onClick={() => setHeroView('site')}><Icon n="site" s={14} />Site · {useStore.getState().node}</button>
          </div>
        </div>

        <div className="col right">
          <Panel title="Active alarms" sub={filters.level !== 'all' || filters.sys !== 'all' ? 'filtered' : 'all systems'} right={<button className="lnk" onClick={() => useStore.getState().ackAll()}>Ack all</button>} src={false}>
            <AlarmList sys={filters.sys === 'all' ? null : filters.sys} level={filters.level === 'all' ? null : filters.level} limit={8} compact />
          </Panel>
          <Panel title="Consumption" sub={filters.range === '24h' ? 'today so far' : `last ${days} days`}>
            <div className="cons">
              <button onClick={() => go('elec')}><Icon n="elec" s={15} c={SYSTEMS.elec.color} /><small>Electricity</small><b>{animate(fmtK(totals.e))}<em>kWh</em></b><Spark data={totals.es.length > 1 ? totals.es : daySeries} color={SYSTEMS.elec.color} /></button>
              <button onClick={() => go('water')}><Icon n="water" s={15} c={SYSTEMS.water.color} /><small>Water</small><b>{animate(fmt(totals.w, 0))}<em>m³</em></b><Spark data={totals.ws.length > 1 ? totals.ws : daySeries} color={SYSTEMS.water.color} /></button>
              <button onClick={() => go('gas')}><Icon n="gas" s={15} c={SYSTEMS.gas.color} /><small>Gas</small><b>{animate(fmt(totals.g, 0))}<em>m³</em></b><Spark data={totals.gs.length > 1 ? totals.gs : daySeries} color={SYSTEMS.gas.color} /></button>
            </div>
            <LineChart h={86} unit="kW" series={[{ name: 'Building load', color: SYSTEMS.elec.color, data: daySeries, area: true }]} />
          </Panel>
          <Panel title="Infrastructure health">
            <div className="hrow">
              <button onClick={() => go('nms')}><Gauge v={H.bySys.nms.avail} label="Network" size={84} color={SYSTEMS.nms.color} digits={1} /></button>
              <button onClick={() => go('dc')}><Gauge v={H.bySys.dc.avail} label="Data center" size={84} color={SYSTEMS.dc.color} digits={1} /></button>
              <button onClick={() => go('access')}><Gauge v={(H.bySys.access.avail + H.bySys.cctv.avail) / 2} label="Security" size={84} color={SYSTEMS.access.color} digits={1} /></button>
            </div>
            <div className="mini-t">
              <span>WAN {fmt(snap.net.wanIn, 0)} Mb/s</span><span>Loss {fmt(snap.net.loss, 2)}%</span><span>IT load {fmt(snap.dc.it, 0)} kW</span><span>Doors {H.bySys.access.ok}/{H.bySys.access.total} secure</span>
            </div>
          </Panel>
          <Panel title="Preventive maintenance" sub="next 14 days" src={false}>
            <div className="pm">{pm.map(p => <button key={p.id} onClick={() => locate(p.dev)}>
              <i style={{ background: p.due <= 2 ? SEV.critical.color : p.due <= 6 ? SEV.major.color : '#5f8a52' }} />
              <div><b>{p.task}</b><span>{DEV[p.dev].name} · {LEVEL[DEV[p.dev].level].id}</span></div><em>{p.due === 0 ? 'today' : `in ${p.due} d`}</em></button>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

export const PM_TASKS = (now) => {
  const base = [
    ['AHU-RF-02', 'Replace pre-filters', 1], ['CHILLER-RF-01', 'Quarterly chiller service', 4], ['GENERATOR-B1-01', 'Monthly load-bank test', 2],
    ['UPS-L1-01', 'Battery impedance test', 9], ['FACP-GF-01', 'Weekly sounder test', 0], ['PUMP-B1-03', 'Bearing inspection', 3],
    ['CRAC-L1-02', 'Coil cleaning', 6], ['ESV-B1-01', 'Valve stroke test', 12], ['TOWER-RF-01', 'Legionella water treatment', 5], ['TRANSFORMER-B1-01', 'Thermography survey', 11],
  ]
  const shift = Math.floor(now / DAY) % 3
  return base.map(([dev, task, due], i) => ({ id: i, dev, task, due: Math.max(0, due - shift) })).sort((a, b) => a.due - b.due).slice(0, 4)
}
