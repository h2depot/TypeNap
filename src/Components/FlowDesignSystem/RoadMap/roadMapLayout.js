import { ROADMAP_NODE_SIZES } from './roadMapNodeSizes.js'

export const STORY_LAYOUT = {
  x: 40, y: 80, columns: 5, gap: 48, rowStep: 240, turnOffset: 110, turnRadius: 56,
  ...ROADMAP_NODE_SIZES.story,
}

// Wrap after five stories, using fewer columns only when the container is too narrow.
export function createStoryLayout(canvasWidth = 1200) {
  const width = Math.max(1, Math.round(canvasWidth))
  const usableWidth = Math.max(STORY_LAYOUT.width, width - STORY_LAYOUT.x * 2)
  const maxColumns = Math.max(1, Math.floor((usableWidth + STORY_LAYOUT.gap) / (STORY_LAYOUT.width + STORY_LAYOUT.gap)))
  const columns = Math.min(STORY_LAYOUT.columns, maxColumns)
  const step = STORY_LAYOUT.width + STORY_LAYOUT.gap
  const centeredX = (width - STORY_LAYOUT.width - (columns - 1) * step) / 2
  return {
    ...STORY_LAYOUT, canvasWidth: width, x: Math.max(STORY_LAYOUT.x, centeredX), columns, maxColumns,
    step: columns > 1 ? step : 0,
    turnOffset: Math.min(STORY_LAYOUT.turnOffset, Math.max(STORY_LAYOUT.x, centeredX) + STORY_LAYOUT.width / 2 - 20),
  }
}

export function storySlots(storyOrder, columns, folds = {}, maxColumns = columns) {
  const slots = []
  let row = 0
  let column = 0
  let minColumn = 0
  let maxColumn = columns - 1
  for (let index = 0; index <= storyOrder.length; index++) {
    slots.push({ row, column })
    if (index === storyOrder.length) break
    const fold = folds[storyOrder[index]]
    const nextColumn = column + (row % 2 ? -1 : 1)
    const outside = nextColumn < minColumn || nextColumn > maxColumn
    const canExtend = maxColumn - minColumn + 1 < maxColumns
    if (fold === true || (outside && (fold !== false || !canExtend))) {
      // Reverse direction on the next row without changing the current X slot.
      row++
    } else {
      column = nextColumn
      minColumn = Math.min(minColumn, column)
      maxColumn = Math.max(maxColumn, column)
    }
  }
  return { slots, columns: maxColumn - minColumn + 1, minColumn }
}

export function withStorySlots(layout, placement) {
  const step = layout.width + layout.gap
  const gridWidth = layout.width + (placement.columns - 1) * step
  const canvasWidth = layout.canvasWidth
  const x = Math.max(0, (canvasWidth - gridWidth) / 2)
  return { ...layout, ...placement, viewportWidth: layout.canvasWidth, canvasWidth, x,
    step: placement.columns > 1 ? step : 0,
    turnOffset: Math.min(STORY_LAYOUT.turnOffset, x + layout.width / 2 - 20) }
}

export function storySlot(index, layout) {
  return layout.slots?.[index] ?? { row: Math.floor(index / layout.columns), column: index % layout.columns }
}

export function storyPosition(index, layout = createStoryLayout()) {
  const { row, column } = storySlot(index, layout)
  const visualColumn = layout.slots ? column - layout.minColumn : row % 2 ? layout.columns - 1 - column : column
  return { x: layout.x + visualColumn * layout.step, y: layout.y + row * layout.rowStep }
}

export function storyCenter(index, layout = createStoryLayout()) {
  const position = storyPosition(index, layout)
  return { x: position.x + layout.width / 2, y: position.y + layout.diameter / 2 }
}

export function storyInsertions(storyOrder, layout) {
  const between = storyOrder.slice(0, -1).map((id, index) => {
    const source = storyCenter(index, layout)
    const target = storyCenter(index + 1, layout)
    const { row } = storySlot(index, layout)
    const center = source.y === target.y
      ? { x: (source.x + target.x) / 2, y: source.y }
      : { x: (row % 2 ? Math.min(source.x, target.x) - layout.turnOffset : Math.max(source.x, target.x) + layout.turnOffset), y: (source.y + target.y) / 2 }
    return { afterId: id, terminal: false, size: 48, position: { x: center.x - 24, y: center.y - 24 } }
  })
  const end = storyCenter(storyOrder.length, layout)
  return [...between, {
    afterId: storyOrder.at(-1) ?? null, terminal: true, size: layout.diameter,
    position: { x: end.x - layout.diameter / 2, y: end.y - layout.diameter / 2 },
  }]
}

// Hit-test fixed slots, never the other cards' animated positions.
export function storyDropIndex(storyCount, center, layout = createStoryLayout()) {
  let target = 0
  let nearest = Infinity
  for (let index = 0; index < storyCount; index++) {
    const slot = storyCenter(index, layout)
    const distance = (center.x - slot.x) ** 2 + (center.y - slot.y) ** 2
    if (distance < nearest) {
      nearest = distance
      target = index
    }
  }
  return target
}

export function reorderStories(storyOrder, draggedId, index) {
  if (!storyOrder.includes(draggedId)) return storyOrder
  const order = storyOrder.filter(id => id !== draggedId)
  order.splice(Math.max(0, Math.min(index, order.length)), 0, draggedId)
  return order
}

export function previewStoryOrder(storyOrder, drag) {
  return drag && !drag.cancelled ? reorderStories(storyOrder, drag.id, drag.index) : storyOrder
}

// Story content depends on order and row membership, not the canvas's
// continuously changing width during a navigation animation.
export function prepareRoadMapNodes(nodes, storyOrder, placement) {
  const indices = new Map(storyOrder.map((id, index) => [id, index]))
  return nodes.filter(node => indices.has(node.id)).map(node => {
    const index = indices.get(node.id)
    return {
      ...node,
      data: {
        ...node.data,
        orderIndex: index,
        row: typeof placement === 'number' ? Math.floor(index / placement) : placement.slots[index].row,
        // Arrays leave room for multiple successors when branch layout is added.
        nextStoryIds: storyOrder[index + 1] ? [storyOrder[index + 1]] : [],
      },
    }
  })
}

export function positionRoadMapNodes(nodes, layout) {
  return nodes.map(node => ({
    ...node,
    position: storyPosition(node.data.orderIndex, layout),
    dragging: false,
    zIndex: 2,
  }))
}

export function layoutRoadMapNodes(nodes, storyOrder, drag = null, layout = createStoryLayout()) {
  return positionRoadMapDrag(positionRoadMapNodes(prepareRoadMapNodes(nodes, storyOrder, layout.slots ? layout : layout.columns), layout), drag)
}

// Only the moving node needs a new object on each pointer update. In
// particular, keep its data and every stationary node referentially stable.
export function positionRoadMapDrag(nodes, drag) {
  if (!drag || drag.cancelled) return nodes
  return nodes.map(node => node.id === drag.id
    ? { ...node, position: drag.position, dragging: true, zIndex: 10 }
    : node)
}

export function timelinePath(index, layout) {
  const source = storyCenter(index, layout)
  const target = storyCenter(index + 1, layout)
  if (source.y === target.y) return `M ${source.x} ${source.y} L ${target.x} ${target.y}`
  const direction = storySlot(index, layout).row % 2 ? -1 : 1
  const outerX = direction > 0 ? Math.max(source.x, target.x) + layout.turnOffset : Math.min(source.x, target.x) - layout.turnOffset
  const midY = (source.y + target.y) / 2
  // Two cubic quarter-turns keep the curve on the existing insertion point.
  const sourceControlX = source.x + (outerX - source.x) * 0.5522847498
  const targetControlX = target.x + (outerX - target.x) * 0.5522847498
  const controlY = (target.y - source.y) / 2 * 0.5522847498
  return `M ${source.x} ${source.y} C ${sourceControlX} ${source.y} ${outerX} ${midY - controlY} ${outerX} ${midY} C ${outerX} ${midY + controlY} ${targetControlX} ${target.y} ${target.x} ${target.y}`
}

export function timelineSegments(storyOrder, layout = createStoryLayout()) {
  return storyOrder.slice(0, -1).map((id, index) => ({
    id: `sequence:${id}:${storyOrder[index + 1]}`,
    source: id, target: storyOrder[index + 1],
    // Canonical path keeps the road continuous while a card is being dragged.
    data: { kind: 'sequence', path: timelinePath(index, layout) },
  }))
}

export function roadMapScrollBounds(storyCount, layout, canvasHeight) {
  const height = Math.max(1, canvasHeight)
  const last = storyPosition(Math.max(0, storyCount - 1), layout)
  const append = storyCenter(storyCount, layout)
  const contentHeight = Math.max(last.y + layout.height, append.y + layout.diameter / 2) + 80
  const minY = Math.min(0, height - contentHeight)
  return {
    contentHeight, minY, maxY: 0, minX: Math.min(0, (layout.viewportWidth ?? layout.canvasWidth) - layout.canvasWidth), maxX: 0,
    translateExtent: [[0, 0], [layout.canvasWidth, Math.max(height, contentHeight)]],
  }
}

export function clampRoadMapViewport(viewport, bounds) {
  return { x: Math.max(bounds.minX ?? 0, Math.min(bounds.maxX ?? 0, viewport.x)), y: Math.max(bounds.minY, Math.min(bounds.maxY, viewport.y)), zoom: 1 }
}
