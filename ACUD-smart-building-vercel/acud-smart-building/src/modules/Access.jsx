import { useMemo, useState } from 'react'
import { useStore, DOOR_LIST, doorGroup, ACCESS_GROUPS } from '../data/store'
import { LEVELS, DEV } from '../data/building'
import { useSnap, fmt, tms, STATUS } from '../data/util'
import { occ, hash, HOUR } from '../data/sim'
import { Panel, Kpi, AlarmList, Seg, Pill } from '../components/UI'
import { Bars, Donut } from '../components/Charts'
import Twin from '../twin/LazyTwin'
import Icon from '../components/Icons'
import Tracking from './Tracking'

function AccessOverview() {
  const snap = useSnap(), st = useStore()
  const [tab, setTab] = useState('events'), [res, setRes] = useState('all'), [fl, setFl] = useState('all'), [q, setQ] = useState('')
  const ev = st.events
  const today = ev.filter(e => e.ts > snap.now - 12 * HOUR)
  const granted = today.filter(e => e.result === 'Granted').length, denied = today.filter(e => ['Denied', 'Forced'].includes(e.result)).length
  const unlocked = Object.values(st.doors).filter(d => !d.locked).length
  const inside = Math.round(snap.climate.L3.occ * 612 + 18)
  const hourly = useMemo(() => {
    const out = []; const h0 = new Date(snap.now).getHours()
    for (let i = 11; i >= 0; i--) { const t = snap.now - i * HOUR; const o = occ(t), o1 = occ(t - HOUR); const base = 40 + 260 * Math.max(0, o - o1 + 0.12) * (1 + 0.2 * hash(i + h0)), ex = 30 + 260 * Math.max(0, o1 - o + 0.1)
      out.push({ label: String(new Date(t).getHours()).padStart(2, '0'), full: `${String(new Date(t).getHours()).padStart(2, '0')}:00`, parts: [{ name: 'Entries', v: base, color: '#8a6d9e' }, { name: 'Exits', v: ex, color: '#cbbfa9' }] }) }
    return out
  }, [Math.floor(snap.now / HOUR)])
  const creds = ['RFID', 'Biometric', 'QR', 'RFID + PIN'].map((k, i) => ({ name: k, v: st.users.filter(u => u.cred === k).length, color: ['#8a6d9e', '#c98a2e', '#4f7a92', '#a89c8c'][i] }))
  const doors = DOOR_LIST.filter(d => fl === 'all' || d.level === fl)
  const evs = ev.filter(e => (res === 'all' || (res === 'denied' ? ['Denied', 'Forced'].includes(e.result) : e.result === 'Granted')) && (!q || (e.user + e.doorName + e.card).toLowerCase().includes(q.toLowerCase()))).slice(0, 60)
  const users = st.users.filter(u => !q || (u.name + u.dept + u.card).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="mod">
      <div className="cols">
        <div className="col left">
          <Panel title="Access overview" sub="last 12 h">
            <div className="kgrid k3">
              <Kpi label="People inside" value={fmt(inside)} sub="by entry/exit balance" />
              <Kpi label="Granted" value={fmt(granted)} sub="valid credentials" />
              <Kpi label="Denied / forced" value={fmt(denied)} color={denied ? '#c4553f' : null} sub="see log" onClick={() => { setTab('events'); setRes('denied') }} />
              <Kpi label="Access points" value={DOOR_LIST.length} sub={`${unlocked} unlocked`} />
              <Kpi label="Cardholders" value={st.users.length} sub={`${st.users.filter(u => u.status !== 'Active').length} inactive`} onClick={() => setTab('users')} />
              <Kpi label="Readers online" value={`${DOOR_LIST.filter(d => st.status[d.id] !== 'offline').length}/${DOOR_LIST.length}`} />
            </div>
            <Bars h={110} stacked data={hourly} unit="people" />
            <div className="row-c"><Donut size={92} parts={creds} center={st.users.length} sub="cards" /><div className="lg-v">{creds.map(c => <span key={c.name}><i style={{ background: c.color }} />{c.name}<b>{c.v}</b></span>)}</div></div>
          </Panel>
          <Panel title="Doors & access points" right={<select className="tsel sm" value={fl} onChange={e => setFl(e.target.value)}><option value="all">All floors</option>{LEVELS.map(L => <option key={L.id}>{L.id}</option>)}</select>}>
            <div className="doors">{doors.map(d => { const s = st.doors[d.id], a = st.status[d.id]
              return <div key={d.id} className={'door' + (st.device === d.id ? ' on' : '')} onClick={() => st.selectDevice(d.id)}>
                <Icon n={s.locked ? 'lock' : 'unlock'} s={15} c={s.locked ? '#5f8a52' : '#d08a1e'} />
                <div><b>{d.name}</b><span>{d.level} · {s.reader} · {s.mode}{a !== 'ok' ? ` · ${STATUS[a]?.label}` : ''}</span></div>
                <button onClick={e => { e.stopPropagation(); st.doorCmd(d.id, s.locked ? 'unlock' : 'lock') }}>{s.locked ? 'Unlock' : 'Lock'}</button>
                <button onClick={e => { e.stopPropagation(); st.doorCmd(d.id, 'pulse') }} title="Momentary unlock 5 s">5 s</button>
              </div> })}</div>
          </Panel>
        </div>
        <div className="col center"><Twin layer="access" /></div>
        <div className="col right">
          <Panel title="Security alerts" src={false}><AlarmList sys="access" limit={6} compact empty="No security alerts" /></Panel>
          <Panel title={tab === 'events' ? 'Access log' : 'Users & permissions'} right={<Seg small value={tab} options={[['events', 'Log'], ['users', 'Users']]} onChange={setTab} />} className="grow">
            <div className="tool-row">
              <div className="search sm"><Icon n="search" s={13} /><input placeholder={tab === 'events' ? 'Search name, door, card…' : 'Search users…'} value={q} onChange={e => setQ(e.target.value)} /></div>
              {tab === 'events' && <Seg small value={res} options={[['all', 'All'], ['granted', 'Granted'], ['denied', 'Denied']]} onChange={setRes} />}
            </div>
            {tab === 'events' ? <div className="log">{evs.map(e => <button key={e.id} className={'lg ' + e.result.toLowerCase()} onClick={() => st.selectDevice(e.door)}>
              <span className="t">{tms(e.ts)}</span><i /><div><b>{e.user}</b><span>{e.doorName} · {e.level} · {e.cred}{e.dir !== '—' ? ` · ${e.dir}` : ''}</span>{e.reason && <em>{e.reason}</em>}</div><strong>{e.result}</strong></button>)}</div>
              : <div className="users">{users.map(u => <div key={u.id} className="usr">
                <div className="av">{u.name.split(' ').map(x => x[0]).join('')}</div>
                <div className="u-m"><b>{u.name}</b><span>{u.dept} · {u.card} · {u.cred}</span>
                  <div className="grp">{ACCESS_GROUPS.map(g => <button key={g} className={u.groups.includes(g) ? 'on' : ''} onClick={() => st.userCmd(u.id, { groups: u.groups.includes(g) ? u.groups.filter(x => x !== g) : [...u.groups, g] })}>{g}</button>)}</div></div>
                <div className="u-s"><Pill s={u.status === 'Active' ? 'ok' : u.status === 'Suspended' ? 'alarm' : 'offline'}>{u.status}</Pill>
                  <button onClick={() => st.userCmd(u.id, { status: u.status === 'Active' ? 'Suspended' : 'Active' })}>{u.status === 'Active' ? 'Suspend' : 'Activate'}</button></div>
              </div>)}</div>}
          </Panel>
        </div>
      </div>
    </div>
  )
}

// Access Control: overview (doors, log, users) + employee tracking
export default function Access() {
  const [view, setView] = useState('overview')
  return <div className="mod acc">
    <div className="subtabs" role="tablist" aria-label="Access control">
      <b><Icon n="access" s={15} />Access Control</b>
      {[['overview', 'Doors & log', 'lock'], ['track', 'Employee tracking', 'user']].map(([id, l, ic]) =>
        <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => setView(id)}><Icon n={ic} s={14} />{l}</button>)}
    </div>
    {view === 'overview' ? <AccessOverview /> : <Tracking />}
  </div>
}
