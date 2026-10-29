import { applyNodeChanges } from '@xyflow/react'
import { createStoryLayout, previewStoryOrder, reorderStories, storyDropIndex, storyPosition, storySlots, withStorySlots } from './roadMapLayout.js'
import { normalizeWritingStatus } from './writingStatus.js'
import { roadMapTextNameError } from './roadMapText.js'

export function createRoadMapState({ nodes, storyOrder, storySerial }) {
  const stories = nodes.filter(node => node.type === 'roadmapStory').map(node => ({ ...node, selected: false }))
  const ids = new Set(stories.map(node => node.id))
  const order = storyOrder.filter(id => ids.has(id))
  return {
    nodes: stories, storyOrder: order, folds: {},
    layout: createStoryLayout(), layoutReady: false, canvasHeight: 1,
    drag: null, selectedStoryId: null, addedStoryId: null, settling: null,
    storySerial: Number.isInteger(storySerial) && storySerial > 0 ? storySerial : order.length + 1,
  }
}

function selectStory(state, id) {
  const selectedStoryId = state.storyOrder.includes(id) ? id : null
  if (state.selectedStoryId === selectedStoryId) return state
  return { ...state, selectedStoryId, nodes: state.nodes.map(node => ({ ...node, selected: node.id === selectedStoryId })) }
}

export function roadMapReducer(state, action) {
  switch (action.type) {
    case 'toggleFold': {
      const index = state.storyOrder.indexOf(action.afterId)
      if (index < 0 || index >= state.storyOrder.length - 1 || state.storyOrder[index + 1] !== action.targetId || (state.drag && !state.drag.cancelled)) return state
      const { slots } = storySlots(state.storyOrder, state.layout.columns, state.folds, state.layout.maxColumns)
      const folded = slots[index].row !== slots[index + 1].row
      if (state.folds[action.afterId] === !folded) return state
      return { ...state, folds: { ...state.folds, [action.afterId]: !folded }, settling: 'commit' }
    }
    case 'selectStory':
      return selectStory(state, action.id)
    case 'reorderStory': {
      const index = state.storyOrder.indexOf(action.overId)
      if (index < 0 || action.id === action.overId || !state.storyOrder.includes(action.id)) return state
      return {
        ...selectStory(state, action.id),
        storyOrder: reorderStories(state.storyOrder, action.id, index),
        drag: null, settling: 'commit',
      }
    }
    case 'updateStory': {
      const story = state.nodes.find(node => node.id === action.id)
      if (!story) return state
      const patch = { ...action.data }
      if ('name' in patch) {
        if (roadMapTextNameError(state.nodes, patch.name, action.id)) return state
        patch.name = patch.name.trim()
      }
      if ('writingStatus' in patch) patch.writingStatus = normalizeWritingStatus(patch.writingStatus)
      if (Object.entries(patch).every(([key, value]) => story.data[key] === value)) return state
      return { ...state, nodes: state.nodes.map(node => node.id === action.id ? { ...node, data: { ...node.data, ...patch } } : node) }
    }
    case 'resize': {
      const layout = createStoryLayout(action.width)
      const canvasHeight = Math.max(1, Math.ceil(action.height ?? state.canvasHeight))
      const layoutChanged = layout.canvasWidth !== state.layout.canvasWidth
      if (state.layoutReady && !layoutChanged && canvasHeight === state.canvasHeight) return state
      return {
        ...state, layout: layoutChanged ? layout : state.layout, layoutReady: true, canvasHeight,
        settling: layoutChanged ? 'resize' : state.settling,
        drag: layoutChanged && state.drag ? { ...state.drag, cancelled: true } : state.drag,
      }
    }
    case 'nodesChange': {
      const ids = new Set(state.nodes.map(node => node.id))
      const changes = action.changes.filter(change => ids.has(change.id) && change.type !== 'position')
      if (!changes.length) return state
      // Story positions only come from storyOrder or the temporary drag state.
      const nodes = applyNodeChanges(changes, state.nodes).filter(node => node.type === 'roadmapStory')
      const remaining = new Set(nodes.map(node => node.id))
      const selectedChange = changes.findLast(change => change.type === 'select' && change.selected && remaining.has(change.id))
      const selectedStoryId = selectedChange?.id ?? (remaining.has(state.selectedStoryId)
        && !changes.some(change => change.id === state.selectedStoryId && change.type === 'select' && !change.selected) ? state.selectedStoryId : null)
      return {
        ...state,
        selectedStoryId,
        settling: nodes.length !== state.nodes.length ? null : state.settling,
        nodes: nodes.map(node => node.selected === (node.id === selectedStoryId) ? node : { ...node, selected: node.id === selectedStoryId }),
        storyOrder: state.storyOrder.filter(id => remaining.has(id)),
        folds: nodes.length === state.nodes.length ? state.folds : Object.fromEntries(Object.entries(state.folds).filter(([id]) => remaining.has(id))),
        drag: state.drag && remaining.has(state.drag.id) ? state.drag : null,
      }
    }
    case 'addStory': {
      if (action.data?.name !== undefined && roadMapTextNameError(state.nodes, action.data.name)) return state
      const afterId = action.afterId === undefined
        ? state.nodes.find(node => node.selected && state.storyOrder.includes(node.id))?.id ?? state.storyOrder.at(-1)
        : action.afterId
      const index = afterId ? state.storyOrder.indexOf(afterId) + 1 : state.storyOrder.length
      const storyOrder = [...state.storyOrder]
      storyOrder.splice(index, 0, action.id)
      return {
        ...state, storyOrder, storySerial: state.storySerial + 1, drag: null, settling: null,
        selectedStoryId: action.id, addedStoryId: action.id,
        nodes: [...state.nodes.map(node => ({ ...node, selected: false })), {
          id: action.id, type: 'roadmapStory', position: storyPosition(index, state.layout), selected: true,
          data: { role: 'story', name: action.data?.name?.trim() ?? `新しいストーリー ${state.storySerial}`, emoji: '📖', content: action.data?.content ?? 'ここから、新しい場面がはじまる。', writingStatus: 'not_started' },
        }],
      }
    }
    case 'dragStart':
      return state.storyOrder.includes(action.node.id)
        ? { ...selectStory(state, action.node.id), settling: null, drag: { id: action.node.id, position: action.node.position, index: state.storyOrder.indexOf(action.node.id), cancelled: false } }
        : state
    case 'dragMove':
      if (!state.drag || state.drag.id !== action.node.id || state.drag.cancelled) return state
      return { ...state, drag: { ...state.drag, position: action.node.position, index: storyDropIndex(state.storyOrder.length, { x: action.node.position.x + state.layout.width / 2, y: action.node.position.y + state.layout.diameter / 2 }, withStorySlots(state.layout, storySlots(state.storyOrder, state.layout.columns, state.folds, state.layout.maxColumns))) } }
    case 'dragCancel':
      return state.drag ? { ...state, settling: 'cancel', drag: { ...state.drag, cancelled: true } } : state
    case 'dragStop': {
      if (!state.drag || state.drag.id !== action.node.id) return state
      return {
        ...state, drag: null,
        settling: action.cancelled || state.drag.cancelled ? 'cancel' : 'commit',
        // Commit the same slot used by the live reorder preview.
        storyOrder: action.cancelled ? state.storyOrder : previewStoryOrder(state.storyOrder, state.drag),
      }
    }
    default:
      return state
  }
}
