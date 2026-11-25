// Loads the three.js twin only when a 3D view is actually opened (keeps first paint fast).
import { lazy, Suspense } from 'react'
const Twin = lazy(() => import('./Twin'))
export default function LazyTwin(props) {
  return <Suspense fallback={<div className="twin-loading"><i /><span>Loading 3D twin…</span></div>}><Twin {...props} /></Suspense>
}
