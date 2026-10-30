import { useReactFlow } from '@xyflow/react'
import { useEffect, useRef } from 'react'
import RoadMapCharacterNode from './RoadMapCharacterNode.jsx'
import RoadMapEntityNode from './RoadMapEntityNode.jsx'
import RoadMapWorldNode from './RoadMapWorldNode.jsx'
import RoadMapMemoNode from './RoadMapMemoNode.jsx'
import RoadMapDocumentNode from './RoadMapDocumentNode.jsx'
import TN_NodeTip from '../../../TNDesignSystem/TN_NodeTip.jsx'
import TN_IconButton from '../../../TNDesignSystem/TN_IconButton.jsx'
import { Trash2 } from '../../../../assets/original_icons/index.js'
import { ROADMAP_STAMP_SCALE, roadMapNodeWidth } from '../roadMapNodeSizes.js'
import { stampDragRotation, stampRotation } from '../roadMapStamps.js'
import './RoadMapNode.css'

const cards = {
  character: RoadMapCharacterNode,
  entity: RoadMapEntityNode,
  world: RoadMapWorldNode,
  memo: RoadMapMemoNode,
  document: RoadMapDocumentNode,
}
const rotationCorners = [
  ['top-left', '左上'], ['top-right', '右上'], ['bottom-left', '左下'], ['bottom-right', '右下'],
]

// Adapted from GraphMap's StoryNode; RoadMap owns the cards, styling and sizing.
export default function RoadMapNode({ id, data, type, selected }) {
  const { updateNodeData, deleteElements } = useReactFlow()
  const rotationSurface = useRef(null)
  const rotationDrag = useRef(null)
  const rotation = stampRotation(data.rotation)
  useEffect(() => {
    if (!selected || !data.interactive) rotationDrag.current = null
    return () => { rotationDrag.current = null }
  }, [selected, data.interactive])
  const rotateToPointer = event => {
    const drag = rotationDrag.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const angle = Math.atan2(event.clientY - drag.center.y, event.clientX - drag.center.x)
    updateNodeData(id, { rotation: stampDragRotation(drag.rotation, drag.angle, angle, event.shiftKey, true) })
  }
  const finishRotation = (event, cancelled = false, pointerId = event.pointerId) => {
    const drag = rotationDrag.current
    if (!drag || drag.pointerId !== pointerId) return
    event.stopPropagation()
    if (cancelled) updateNodeData(id, { rotation: drag.rotation })
    else rotateToPointer(event)
    rotationDrag.current = null
    if (event.currentTarget.hasPointerCapture(pointerId)) event.currentTarget.releasePointerCapture(pointerId)
  }
  const Card = cards[type]
  const hasTip = ['character', 'entity', 'world'].includes(type)
  return (
    <div className={`roadmap-node roadmap-node--${type}`} style={{ zoom: ROADMAP_STAMP_SCALE }}>
      {/* Static rotation has its own wrapper; the card keeps its Motion transforms. */}
      <div ref={rotationSurface} className="roadmap-node__rotation" style={{ transform: `rotate(${rotation}deg)` }}>
      <TN_NodeTip name={data.name} summary={data.summary} theme={data.theme} disabled={!hasTip || !data.interactive}>
        <div className="roadmap-node__card">
          <Card
            name={data.name}
            summary={data.summary}
            imagePaths={data.imagePaths}
            tooltip={false}
            interactive={data.interactive}
            theme={data.theme}
            width={roadMapNodeWidth(type)}
            {...(type === 'document' ? { emoji: data.emoji ?? '', onEmojiChange: emoji => updateNodeData(id, { emoji }) } : {})}
            {...(type === 'memo' ? { content: data.content, onContentChange: content => updateNodeData(id, { content }) } : {})}
          >
            {type === 'document' ? data.content : undefined}
          </Card>
          <div
            className="roadmap-node__delete nodrag nopan"
            onPointerDown={event => event.stopPropagation()}
            onDoubleClick={event => event.stopPropagation()}
            onKeyDown={event => event.stopPropagation()}
          >
            <TN_IconButton
              type="button"
              icon={<Trash2 />}
              size="small"
              theme={data.theme ?? 'light'}
              disabled={!data.interactive}
              aria-label={`${data.name || type}を削除`}
              title="ノードを削除"
              onClick={event => { event.stopPropagation(); deleteElements({ nodes: [{ id }] }) }}
            />
          </div>
        </div>
      </TN_NodeTip>
      {selected && data.interactive && rotationCorners.map(([corner, label]) => <button key={corner} type="button"
        className={`roadmap-node__rotate-corner roadmap-node__rotate-corner--${corner} nodrag nopan nowheel`}
        aria-label={`${data.name || type}を回転（${label}）`} title="ドラッグして回転（90度ごとにスナップ・Shiftで15度刻み）"
        role="slider" aria-valuemin={-180} aria-valuemax={180} aria-valuenow={rotation} aria-valuetext={`${rotation}度`}
        onPointerDown={event => {
          if (event.button !== 0) return
          event.preventDefault()
          event.stopPropagation()
          const bounds = rotationSurface.current.getBoundingClientRect()
          const center = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
          rotationDrag.current = { pointerId: event.pointerId, center, rotation,
            angle: Math.atan2(event.clientY - center.y, event.clientX - center.x) }
          event.currentTarget.focus({ preventScroll: true })
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={rotateToPointer}
        onPointerUp={event => finishRotation(event)}
        onPointerCancel={event => finishRotation(event, true)}
        onLostPointerCapture={event => finishRotation(event, true)}
        onDoubleClick={event => { event.stopPropagation(); updateNodeData(id, { rotation: 0 }) }}
        onKeyDown={event => {
          event.stopPropagation()
          if (event.key === 'Escape' && rotationDrag.current) {
            event.preventDefault()
            finishRotation(event, true, rotationDrag.current.pointerId)
          } else if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home'].includes(event.key)) {
            event.preventDefault()
            const step = event.shiftKey ? 15 : 1
            const delta = ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -step : step
            updateNodeData(id, { rotation: event.key === 'Home' ? 0 : stampDragRotation(rotation, 0, delta * Math.PI / 180) })
          }
        }} />)}
      </div>
    </div>
  )
}
