import { applyNodeChanges } from '@xyflow/react'
import { roadMapStampWidth } from './roadMapNodeSizes.js'

export const stampTypes = ['character', 'entity', 'world', 'memo']

export function stampRotation(value) {
  return Number.isFinite(value) ? Math.max(-180, Math.min(180, Math.round(value))) : 0
}

export function stampDragRotation(rotation, startAngle, angle, snap = false, snapRightAngles = false) {
  const degrees = rotation + (angle - startAngle) * 180 / Math.PI
  const rightAngle = Math.round(degrees / 90) * 90
  const next = snapRightAngles && Math.abs(degrees - rightAngle) <= 5 ? rightAngle
    : snap ? Math.round(degrees / 15) * 15 : degrees
  return stampRotation(((next + 180) % 360 + 360) % 360 - 180)
}

export function changeRoadMapStamps(nodes, changes) {
  const ids = new Set(nodes.map(node => node.id))
  const relevant = changes.filter(change => ids.has(change.id))
  return relevant.length ? applyNodeChanges(relevant, nodes) : nodes
}

// Stamps have their own positions and never enter the story sequence or folds.
export function stampScrollBounds(bounds, nodes) {
  if (!nodes.length) return bounds
  const bottom = Math.max(...nodes.map(node => {
    const height = node.measured?.height ?? node.height ?? 340
    const width = node.measured?.width ?? roadMapStampWidth(node.type)
    const radians = stampRotation(node.data?.rotation) * Math.PI / 180
    const rotatedHeight = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))
    return node.position.y + height + Math.max(0, (rotatedHeight - height) / 2) + 80
  }))
  const contentHeight = Math.max(bounds.contentHeight, bottom)
  const viewportHeight = bounds.translateExtent[1][1] + bounds.minY
  return {
    ...bounds, contentHeight, minY: Math.min(0, viewportHeight - contentHeight),
    translateExtent: [bounds.translateExtent[0], [bounds.translateExtent[1][0], Math.max(viewportHeight, contentHeight)]],
  }
}
