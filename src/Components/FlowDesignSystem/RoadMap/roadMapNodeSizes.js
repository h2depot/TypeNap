// RoadMap owns these sizes independently of GraphMap's cards.
export const ROADMAP_STAMP_SCALE = 2 / 3

export const ROADMAP_NODE_SIZES = {
  story: { width: 168, diameter: 88, height: 148 },
  document: { width: 300, collapsedRatio: 0.46, expandedRatio: 272 / 300 },
  character: { width: 200 },
  entity: { width: 240 },
  world: { width: 300 },
  memo: { width: 340, bodyHeight: 220 },
}

export function roadMapNodeWidth(type) {
  return ROADMAP_NODE_SIZES[type === 'roadmapStory' ? 'story' : type]?.width ?? 36
}

export function roadMapStampWidth(type) {
  return roadMapNodeWidth(type) * ROADMAP_STAMP_SCALE
}
