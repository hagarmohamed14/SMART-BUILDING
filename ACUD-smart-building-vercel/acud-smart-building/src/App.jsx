import { useEffect, lazy, Suspense } from 'react'
import { useStore } from './data/store'
import { Header, NavRail, OfflineBanner, SimPanel, CritBanner } from './components/Shell'
import { IncidentDrawer, Toasts } from './components/UI'
import Overview from './modules/Overview'
import BMS from './modules/BMS'
import Access from './modules/Access'
import Fire from './modules/Fire'
import CCTV from './modules/CCTV'
import DataCenter from './modules/DataCenter'
import NMS from './modules/NMS'
import Electricity from './modules/Electricity'
import Water from './modules/Water'
import Gas from './modules/Gas'
import Energy, { EnergyTabs, ENERGY_MODULES } from './modules/Energy'
import HVAC from './modules/HVAC'

const VIEWS = { overview: Overview, bms: BMS, access: Access, fire: Fire, cctv: CCTV, dc: DataCenter, nms: NMS, elec: Electricity, water: Water, gas: Gas, energy: Energy, hvac: HVAC }

export default function App() {
  const mode = useStore(s => s.mode), module = useStore(s => s.module), theme = useStore(s => s.theme)
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => { document.documentElement.dataset.mode = mode }, [mode])
  useEffect(() => {
    if (mode === 'offline') return
    const id = setInterval(() => useStore.getState().step(), mode === 'live' ? 2000 : 1000)
    return () => clearInterval(id)
  }, [mode])
  // deep links: #module
  useEffect(() => {
    const apply = () => { const m = location.hash.slice(1); if (VIEWS[m]) useStore.getState().go(m) }
    apply(); window.addEventListener('hashchange', apply); return () => window.removeEventListener('hashchange', apply)
  }, [])
  useEffect(() => { if (location.hash.slice(1) !== module) history.replaceState(null, '', '#' + module) }, [module])
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { const s = useStore.getState(); if (s.openAlarm) s.closeIncident(); else if (s.device) s.selectDevice(null); else if (s.level) s.setLevel(null) } }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])
  const View = VIEWS[module]
  return (
    <div className={'app mode-' + mode}>
      <Header />
      <NavRail />
      <CritBanner />
      <OfflineBanner />
      <div className="body">
        {ENERGY_MODULES.includes(module)
          ? <div className="main stack"><EnergyTabs /><main key={module} className="main"><View /></main></div>
          : <main key={module} className="main"><View /></main>}
      </div>
      <SimPanel />
      <IncidentDrawer />
      <Toasts />
    </div>
  )
}
