import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { positionRoadMapNodes, positionRoadMapDrag, prepareRoadMapNodes, previewStoryOrder, roadMapScrollBounds, storyInsertions, storySlots, timelineSegments, withStorySlots } from './roadMapLayout.js'
import { createRoadMapState, roadMapReducer } from './roadMapState.js'
import { initialRoadMap } from './roadMapData.js'

export default function useRoadMap(theme, interactive = true) {
  const [state, dispatch] = useReducer(roadMapReducer, initialRoadMap, createRoadMapState)
  const dragging = !!state.drag && !state.drag.cancelled
  const addStory = useCallback((afterId, data) => dispatch({ type: 'addStory', id: `story-${crypto.randomUUID()}`, afterId, data }), [dispatch])
  const updateStory = useCallback((id, data) => dispatch({ type: 'updateStory', id, data }), [dispatch])
  const selectStory = useCallback(id => dispatch({ type: 'selectStory', id }), [dispatch])
  const reorderStory = useCallback((id, overId) => dispatch({ type: 'reorderStory', id, overId }), [dispatch])
  const toggleFold = useCallback((afterId, targetId) => {
    if (interactive) dispatch({ type: 'toggleFold', afterId, targetId })
  }, [dispatch, interactive])
  const onNodesChange = useCallback(changes => dispatch({ type: 'nodesChange', changes }), [dispatch])
  const onNodeDragStart = useCallback((_event, node) => dispatch({ type: 'dragStart', node }), [dispatch])
  const onNodeDrag = useCallback((_event, node) => dispatch({ type: 'dragMove', node }), [dispatch])
  const onNodeDragStop = useCallback((_event, node, cancelled) => dispatch({ type: 'dragStop', node, cancelled }), [dispatch])
  const resize = useCallback((width, height) => dispatch({ type: 'resize', width, height }), [dispatch])
  // Freeze slots during a drag preview; only committed order changes the folds.
  const capacity = Object.values(state.folds).includes(false) ? state.layout.maxColumns : state.layout.columns
  const placement = useMemo(() => storySlots(state.storyOrder, state.layout.columns, state.folds, capacity), [state.storyOrder, state.layout.columns, state.folds, capacity])
  const layout = useMemo(() => withStorySlots(state.layout, placement), [state.layout, placement])
  const dragId = state.drag?.id
  const dragIndex = state.drag?.index
  const dragCancelled = state.drag?.cancelled
  // Pointer coordinates do not change the slot order. Keep the layout and
  // card data stable until the pointer actually crosses into another slot.
  const previewOrder = useMemo(() => previewStoryOrder(state.storyOrder,
    dragId ? { id: dragId, index: dragIndex, cancelled: dragCancelled } : null),
  [state.storyOrder, dragId, dragIndex, dragCancelled])

  useEffect(() => {
    if (!dragging) return
    const cancel = () => dispatch({ type: 'dragCancel' })
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancel()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('blur', cancel)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('touchcancel', cancel)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('touchcancel', cancel)
    }
  }, [dragging, dispatch])

  const cards = useMemo(() => prepareRoadMapNodes(state.nodes, previewOrder, placement)
      .map(node => ({ ...node, ariaLabel: node.data.name, data: {
        ...node.data, theme, interactive, reordering: dragging, added: node.id === state.addedStoryId, onUpdateStory: updateStory,
      } })),
  [state.nodes, state.addedStoryId, previewOrder, placement, theme, interactive, updateStory, dragging])
  const positionedCards = useMemo(() => positionRoadMapNodes(cards, layout), [cards, layout])
  const nodes = useMemo(() => positionRoadMapDrag(positionedCards, state.drag), [positionedCards, state.drag])
  // React Flow keeps insertion order; the list follows the current story sequence.
  const orderedStories = useMemo(() => [...cards].sort((a, b) => a.data.orderIndex - b.data.orderIndex), [cards])

  const insertionData = useMemo(() => {
    const names = new Map(state.nodes.map(node => [node.id, node.data.name]))
    const afterIds = previewOrder.length ? previewOrder : [null]
    return new Map(afterIds.map((afterId, index) => [afterId, {
      theme, afterId, targetId: previewOrder[index + 1], terminal: index === afterIds.length - 1, disabled: dragging || !interactive,
      folded: placement.slots[index]?.row !== placement.slots[index + 1]?.row,
      autoFolded: state.folds[afterId] === false && placement.slots[index]?.row !== placement.slots[index + 1]?.row,
      afterName: names.get(afterId), onInsertStory: addStory, onToggleFold: toggleFold,
    }]))
  }, [state.nodes, state.folds, previewOrder, placement, theme, addStory, toggleFold, interactive, dragging])
  const inserts = useMemo(() => storyInsertions(previewOrder, layout)
      .filter(insert => !dragging || insert.terminal)
      .map(insert => ({
        ...insert,
        id: `roadmap-insert:${insert.afterId ?? 'first'}`,
        data: insertionData.get(insert.afterId),
      })),
  [previewOrder, layout, dragging, insertionData])

  const timeline = useMemo(() => timelineSegments(previewOrder, layout), [previewOrder, layout])
  const scrollBounds = useMemo(() => roadMapScrollBounds(state.storyOrder.length, layout, state.canvasHeight), [state.storyOrder.length, layout, state.canvasHeight])

  return {
    nodes, inserts, orderedStories,
    timeline, scrollBounds, dragging, addStory, updateStory, resize, selectStory, reorderStory, toggleFold, settling: state.settling, layoutReady: state.layoutReady,
    storyCount: state.storyOrder.length,
    onNodesChange,
    onNodeDragStart, onNodeDrag, onNodeDragStop,
  }
}
