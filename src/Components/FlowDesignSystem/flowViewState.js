import { removeLegacyGraphSamples } from './GraphMap/graphMapData.js'
import { createTabularData, emptyTabularData } from './Tabular/tabularState.js'
import { duplicateName } from '../../store/duplicateName.js'

export const defaultFlowViews = [
  { id: 'graph', type: 'graph', name: 'GraphMap' },
  { id: 'tabular', type: 'tabular', name: 'Tabular' },
]

export const flowViewCatalogKey = story => `typenap.views.story.v1:${encodeURIComponent(story)}`
export const flowViewDataKey = (story, view) => view.type === 'tabular' && view.id === 'tabular'
  ? `typenap.tabular.story.v1:${encodeURIComponent(story)}`
  : `typenap.${view.type}.story.v1:${encodeURIComponent(story)}:${encodeURIComponent(view.id)}`

const normalizedName = name => name.trim().normalize('NFKC').toLocaleLowerCase()
export function flowViewNameError(views, name, type, exceptId) {
  if (!name.trim()) return 'required'
  if (name.trim().length > 100) return 'tooLong'
  if (views.some(view => view.id !== exceptId && view.type === type && normalizedName(view.name) === normalizedName(name))) return 'duplicate'
  return null
}

export function validFlowViews(views) {
  return Array.isArray(views) && new Set(views.map(view => view?.id)).size === views.length
    && views.every(view => view && ['graph', 'tabular'].includes(view.type)
      && typeof view.id === 'string' && (view.id === view.type || view.id.startsWith(`${view.type}-`))
      && typeof view.name === 'string' && !flowViewNameError(views, view.name, view.type, view.id))
}

export function loadFlowViews(storage, story) {
  try {
    const saved = JSON.parse(storage.getItem(flowViewCatalogKey(story)))
    if (saved?.schemaVersion === 1 && validFlowViews(saved.views)) return saved.views
  } catch { /* Keep existing prototype views available on a first or failed read. */ }
  return structuredClone(defaultFlowViews)
}

export function saveFlowViews(storage, story, views) {
  if (!validFlowViews(views)) return false
  try {
    storage.setItem(flowViewCatalogKey(story), JSON.stringify({ schemaVersion: 1, views }))
    return true
  } catch { return false }
}

export function addFlowView(views, { id, type, name }) {
  const next = [...views, { id, type, name: name.trim() }]
  return validFlowViews(next) ? next : views
}

export function renameFlowView(views, id, name) {
  if (!views.some(view => view.id === id)) return views
  const next = views.map(view => view.id === id ? { ...view, name: name.trim() } : view)
  return validFlowViews(next) ? next : views
}

export function duplicateFlowView(storage, story, views, id) {
  const source = views.find(view => view.id === id)
  if (!source) throw new Error('View no longer exists')
  const copy = { ...source, id: `${source.type}-${crypto.randomUUID()}`,
    name: duplicateName(source.name, views.filter(view => view.type === source.type).map(view => view.name), 100) }
  const next = addFlowView(views, copy)
  const key = flowViewDataKey(story, copy)
  let data = storage.getItem(flowViewDataKey(story, source))
  if (data === null) {
    const elements = views.filter(view => view.type === 'graph')
      .flatMap(view => loadGraphView(storage, flowViewDataKey(story, view)).nodes)
    data = JSON.stringify(source.type === 'graph' ? { schemaVersion: 1, nodes: [], edges: [] }
      : { schemaVersion: 2, data: source.id === 'tabular' ? createTabularData(elements) : emptyTabularData })
  }
  if (source.type === 'graph') {
    const graph = JSON.parse(data)
    const ids = new Map(graph.nodes.map(node => [node.id, `graph-${node.type}-${crypto.randomUUID()}`]))
    data = JSON.stringify({ ...graph,
      nodes: graph.nodes.map(node => ({ ...node, id: ids.get(node.id) })),
      edges: graph.edges.map(edge => ({ ...edge, id: `edge-${crypto.randomUUID()}`,
        source: ids.get(edge.source) ?? edge.source, target: ids.get(edge.target) ?? edge.target })),
    })
  }
  // Write content first so the catalog never points at a partially created copy.
  storage.setItem(key, data)
  if (!saveFlowViews(storage, story, next)) {
    try { storage.removeItem(key) } catch { /* Preserve the original save failure. */ }
    throw new Error('Failed to save duplicated view')
  }
  return { views: next, copy }
}

export function removeFlowView(views, id) {
  return views.filter(view => view.id !== id)
}

export function reorderFlowViews(views, activeId, overId) {
  const from = views.findIndex(view => view.id === activeId)
  const to = views.findIndex(view => view.id === overId)
  if (from < 0 || to < 0 || from === to) return views
  const next = [...views]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

export function loadGraphView(storage, key) {
  try {
    const saved = JSON.parse(storage.getItem(key))
    if (saved?.schemaVersion === 1 && Array.isArray(saved.nodes) && Array.isArray(saved.edges)
      && saved.nodes.every(node => typeof node.id === 'string' && ['character', 'world', 'entity', 'memo', 'document'].includes(node.type)
        && Number.isFinite(node.position?.x) && Number.isFinite(node.position?.y) && node.data && typeof node.data.name === 'string')
      && saved.edges.every(edge => typeof edge.id === 'string' && typeof edge.source === 'string' && typeof edge.target === 'string')) {
      return removeLegacyGraphSamples(saved)
    }
  } catch { /* New and unreadable graphs both start empty. */ }
  return { nodes: [], edges: [] }
}

export function saveGraphView(storage, key, nodes, edges) {
  try {
    const savedNodes = nodes.map(({ id, type, position, data }) => {
      const { theme, ...content } = data
      return { id, type, position, data: content }
    })
    const savedEdges = edges.map(({ selected, ...edge }) => {
      if (!edge.data) return edge
      const { theme, ...data } = edge.data
      return { ...edge, data }
    })
    storage.setItem(key, JSON.stringify({ schemaVersion: 1, nodes: savedNodes, edges: savedEdges }))
    return true
  } catch { return false }
}
