import { lazy, memo, Suspense, useEffect, useState } from 'react'
import { useReactFlow, ViewportPortal } from '@xyflow/react'
import { motion as Motion, MotionConfig, useReducedMotion } from 'framer-motion'
import TN_IconButton from '../../TNDesignSystem/TN_IconButton.jsx'
import TN_NodeTip from '../../TNDesignSystem/TN_NodeTip.jsx'
import { Plus, Settings, Trash2 } from '../../../assets/original_icons/index.js'
import { ROADMAP_NODE_SIZES } from './roadMapNodeSizes.js'
import RoadMapStatusBadge from './RoadMapStatusBadge.jsx'

const DocumentEmojiPicker = lazy(() => import('../GraphMap/Nodes/DocumentEmojiPicker.jsx'))
const storyTipSides = ['left', 'bottom', 'top']
const storyEntranceVariants = {
  enter: { opacity: 0, scale: 0.96 },
  rest: { opacity: 1, scale: 1 },
  dragging: { opacity: 1, scale: 1 },
}
const storyIconVariants = {
  rest: { y: 0, scale: 1, rotate: 0, boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.14)' },
  tap: { y: 2, scale: 0.97, rotate: 0, boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.16)' },
  dragging: { y: 0, scale: 1, rotate: 0, boxShadow: '0px 12px 24px rgba(0, 0, 0, 0.34)' },
}

const RoadMapStoryCard = memo(function RoadMapStoryCard({ id, data, dragging }) {
  const { deleteElements } = useReactFlow()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [statusInteracting, setStatusInteracting] = useState(false)
  // Only the entrance follows the OS preference. The explicitly requested
  // tap feedback stays enabled. CSS owns the hover border color.
  const reduceEntranceMotion = useReducedMotion()
  useEffect(() => { if (!data.interactive) setPickerOpen(false) }, [data.interactive])
  const size = ROADMAP_NODE_SIZES.story
  const content = typeof data.content === 'string' ? data.content.trim() : ''
  return (
    <MotionConfig reducedMotion="never">
      <Motion.div className="roadmap-node roadmap-story" variants={storyEntranceVariants} initial={data.added && !reduceEntranceMotion ? 'enter' : false} animate={dragging ? 'dragging' : 'rest'} whileTap={data.interactive && !data.reordering ? 'tap' : undefined} transition={{ duration: reduceEntranceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }} style={{ width: size.width, height: size.height, '--roadmap-story-diameter': `${size.diameter}px` }} data-dragging={dragging} data-story-order={data.orderIndex + 1} data-story-row={data.row}>
        <span className="roadmap-story__number">{data.orderIndex + 1}</span>
        <TN_NodeTip name={data.name} summary={content} theme={data.theme} maxLength={data.tooltipMaxLength} preferredSides={storyTipSides} disabled={!data.interactive || !content || dragging || data.reordering || pickerOpen || statusInteracting}>
          <Motion.div className="roadmap-story__icon" variants={storyIconVariants} transition={{ type: 'tween', duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }}>
            <span className="roadmap-story__hit" aria-hidden="true" />
            <span className="roadmap-story__emoji" aria-hidden="true">{data.emoji || '📖'}</span>
            <RoadMapStatusBadge name={data.name} value={data.writingStatus} theme={data.theme} disabled={!data.interactive || data.reordering}
              onChange={writingStatus => data.onUpdateStory(id, { writingStatus })} onInteractionChange={setStatusInteracting} />
          </Motion.div>
        </TN_NodeTip>
        <div className="roadmap-story__actions nodrag nopan" onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
          <TN_IconButton type="button" theme={data.theme} size="small" variant="secondary" icon={<Settings />} aria-label={`${data.name}のアイコンを変更`} title="絵文字を変更" onClick={event => { event.stopPropagation(); setPickerOpen(true) }} />
          <TN_IconButton type="button" theme={data.theme} size="small" variant="secondary" icon={<Trash2 />} aria-label={`${data.name}を削除`} title="ストーリーを削除" onClick={event => { event.stopPropagation(); deleteElements({ nodes: [{ id }] }) }} />
        </div>
      </Motion.div>
      {pickerOpen && <Suspense fallback={null}><DocumentEmojiPicker value={data.emoji ?? ''} theme={data.theme} onClose={() => setPickerOpen(false)} onSelect={emoji => { data.onUpdateStory(id, { emoji }); setPickerOpen(false) }} /></Suspense>}
    </MotionConfig>
  )
})

export const RoadMapStoryNode = memo(function RoadMapStoryNode({ id, data, positionAbsoluteX, positionAbsoluteY, dragging }) {
  const size = ROADMAP_NODE_SIZES.story
  return <>
    <RoadMapStoryCard id={id} data={data} dragging={dragging} />
    <ViewportPortal>
      <div className="roadmap-story-label" data-dragging={dragging} style={{ width: size.width, transform: `translate(${positionAbsoluteX}px, ${positionAbsoluteY + size.diameter}px)` }} aria-hidden="true">
        <span className="roadmap-story__title">{data.name}</span>
      </div>
    </ViewportPortal>
  </>
})

export const RoadMapInsertNode = memo(function RoadMapInsertNode({ data }) {
  const foldLabel = data.autoFolded ? '幅に合わせて自動折り返し中（広げると元に戻ります）' : data.folded ? `${data.afterName}の後の折り返しを解除` : `${data.afterName}の後で折り返す`
  const buttonStyle = data.terminal ? undefined : { width: '32px', height: '32px' }
  return (
    <div className={`roadmap-insert nodrag nopan${data.terminal ? ' roadmap-insert--terminal' : ''}`} data-folded={data.folded}
      onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <TN_IconButton
        type="button" theme={data.theme} style={buttonStyle} size={data.terminal ? 'large' : 'small'} icon={<Plus size={data.terminal ? Math.round(ROADMAP_NODE_SIZES.story.diameter * 0.4) : 16} />} disabled={data.disabled}
        aria-label={data.afterId ? data.terminal ? '末尾にストーリーを追加' : `${data.afterName}の後にストーリーを追加` : '最初のストーリーを追加'}
        title={data.afterId ? data.terminal ? '末尾にストーリーを追加' : 'この位置にストーリーを挿入' : '最初のストーリーを追加'}
        onClick={event => { event.stopPropagation(); data.onInsertStory(data.afterId) }}
      />
      {!data.terminal && data.targetId && <TN_IconButton type="button" theme={data.theme} size="small" style={buttonStyle}
        disabled={data.disabled || data.autoFolded} title={foldLabel} aria-label={foldLabel} aria-pressed={data.folded}
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={data.folded ? 'M4 12H20M16 8L20 12L16 16' : 'M4 6H15A5 5 0 0 1 15 16H5M9 12L5 16L9 20'} />
        </svg>}
        onClick={event => { event.stopPropagation(); data.onToggleFold(data.afterId, data.targetId) }} />}
    </div>
  )
})

