import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react'

const limit = 100
const contentData = ({ theme, ...data } = {}) => data
const signature = graph => JSON.stringify({
  nodes: graph.nodes.map(({ id, type, position, data }) => ({ id, type, position, data: contentData(data) })),
  edges: graph.edges.map(({ selected, data, ...edge }) => ({ ...edge, data: contentData(data) })),
})
const snapshot = graph => ({
  nodes: graph.nodes.map(node => ({ ...node, selected: false, dragging: false, resizing: false })),
  edges: graph.edges.map(edge => ({ ...edge, selected: false })),
})

export const createGraphHistory = graph => ({ past: [], present: graph, future: [], group: null })

export function graphHistoryReducer(state, action) {
  if (action.type === 'endEdit') return state.group ? { ...state, group: null } : state
  if (action.type === 'undo') return state.past.length ? {
    past: state.past.slice(0, -1), present: state.past.at(-1),
    future: [snapshot(state.present), ...state.future], group: null,
  } : state
  if (action.type === 'redo') return state.future.length ? {
    past: [...state.past, snapshot(state.present)].slice(-limit), present: state.future[0],
    future: state.future.slice(1), group: null,
  } : state

  let present = state.present
  let group = null
  let endGroup = false
  if (action.type === 'nodes') {
    const nodes = applyNodeChanges(action.changes, present.nodes)
    const removed = new Set(action.changes.filter(change => change.type === 'remove').map(change => change.id))
    present = { nodes, edges: present.edges.filter(edge => !removed.has(edge.source) && !removed.has(edge.target)) }
    const edits = action.changes.filter(change => ['position', 'replace'].includes(change.type))
    if (edits.length && action.changes.every(change => ['position', 'replace', 'select', 'dimensions'].includes(change.type))) {
      group = `nodes:${edits.map(change => `${change.type}:${change.id}`).sort().join(',')}`
      endGroup = edits.some(change => change.type === 'position' && change.dragging === false)
    }
  } else if (action.type === 'edges') {
    present = { ...present, edges: applyEdgeChanges(action.changes, present.edges) }
    if (action.changes.every(change => ['replace', 'select'].includes(change.type))) {
      group = `edges:${action.changes.filter(change => change.type === 'replace').map(change => change.id).sort().join(',')}`
    }
  } else if (action.type === 'connect') {
    present = { ...present, edges: addEdge(action.connection, present.edges) }
  } else if (action.type === 'delete') {
    const nodeIds = new Set(action.nodes.map(node => node.id))
    const edgeIds = new Set(action.edges.map(edge => edge.id))
    present = {
      nodes: present.nodes.filter(node => !nodeIds.has(node.id)),
      edges: present.edges.filter(edge => !edgeIds.has(edge.id) && !nodeIds.has(edge.source) && !nodeIds.has(edge.target)),
    }
  } else return state

  // Selection and React Flow measurements don't create edits or clear redo.
  if (signature(present) === signature(state.present)) {
    return { ...state, present, group: endGroup ? null : state.group }
  }
  return {
    past: group && group === state.group ? state.past : [...state.past, snapshot(state.present)].slice(-limit),
    present, future: [], group: endGroup ? null : group,
  }
}
