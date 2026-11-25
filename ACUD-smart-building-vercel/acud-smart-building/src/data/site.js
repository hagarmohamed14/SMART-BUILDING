// ACUD site model: Network Nodes (NN4, NN5, NN7, NN8) and their building profiles.
// Layouts are NOT verified: every node starts from the same six ACUD zone types and
// stays editable (names, zone type, floor count, drawings status) until official
// architectural drawings are provided. Profiles persist in the browser.
export const ZONE_TYPES = {
  admin: { name: 'Administrative Building', short: 'Admin', icon: 'bms', color: '#c98a2e', areas: ['Reception', 'Offices', 'Executive areas', 'Meeting rooms', 'Operational departments'] },
  telecom: { name: 'Telecommunications Building', short: 'Telecom', icon: 'nms', color: '#5b8fb9', areas: ['Network rooms', 'Fiber distribution', 'Routers', 'Switches', 'Communication infrastructure'] },
  dc: { name: 'Data Center', short: 'Data Center', icon: 'dc', color: '#7c78a8', areas: ['Server halls', 'Racks', 'UPS rooms', 'Cooling systems', 'Restricted-access areas'] },
  security: { name: 'Security Zones', short: 'Security', icon: 'access', color: '#c4553f', areas: ['Main gates', 'Reception checkpoints', 'Access-controlled doors', 'CCTV coverage', 'Security control room'] },
  technical: { name: 'Technical Zones', short: 'Technical', icon: 'elec', color: '#d08a1e', areas: ['Electrical rooms', 'Transformers', 'Distribution panels', 'HVAC plants', 'Pumps & mechanical rooms'] },
  outdoor: { name: 'Outdoor Zones', short: 'Outdoor', icon: 'cctv', color: '#5f8a52', areas: ['Parking', 'Perimeter security', 'External lighting', 'Landscaping', 'Utility infrastructure'] },
}
export const ZONE_ORDER = Object.keys(ZONE_TYPES)
export const NODE_IDS = ['NN4', 'NN5', 'NN7', 'NN8']

const mkNode = (id) => ({
  id, name: `ACUD Network Node ${id.slice(2)}`, location: '', verified: false,
  buildings: ZONE_ORDER.map(z => ({ id: `${id}-${z}`, name: ZONE_TYPES[z].name, zone: z, floors: null, verified: false, notes: '' })),
})
export const defaultSite = () => NODE_IDS.map(mkNode)

const KEY = 'acud-site-v1'
export function loadSite() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(s) && s.length) return s } catch { }
  return defaultSite()
}
export function saveSite(site) { try { localStorage.setItem(KEY, JSON.stringify(site)) } catch { } }

export const nodeOf = (site, id) => site.find(n => n.id === id) || site[0]
export const bldOf = (site, nodeId, bldId) => { const n = nodeOf(site, nodeId); return n.buildings.find(b => b.id === bldId) || n.buildings[0] }
