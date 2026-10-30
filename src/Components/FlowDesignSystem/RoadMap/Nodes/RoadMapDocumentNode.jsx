import { ROADMAP_NODE_SIZES } from '../roadMapNodeSizes.js'
import { lazy, Suspense, useId, useLayoutEffect, useRef, useState } from 'react'
import { motion as Motion, MotionConfig } from 'framer-motion'
import './RoadMapDocumentNode.css'
const DocumentEmojiPicker = lazy(() => import('../../GraphMap/Nodes/DocumentEmojiPicker.jsx'))

export default function RoadMapDocumentNode({ name = 'StoryName', emoji, onEmojiChange, width = ROADMAP_NODE_SIZES.document.width, defaultExpanded = false, expanded, onExpandedChange, children, style }) {
  const [localEmoji, setLocalEmoji] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const selectedEmoji = emoji ?? localEmoji
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded)
  const isExpanded = expanded ?? localExpanded
  const contentId = useId()
  const contentRef = useRef(null)

  useLayoutEffect(() => {
    const content = contentRef.current
    // Recalculate during expansion and resizing, using local layout dimensions
    // so React Flow's viewport zoom does not change the number of visible lines.
    const fitLines = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(content).lineHeight)
      const lines = Math.max(1, Math.floor(content.clientHeight / lineHeight))
      content.style.setProperty('--roadmap-document-content-lines', lines)
    }
    fitLines()
    const observer = new ResizeObserver(fitLines)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  function toggle(event) {
    event.stopPropagation()
    const next = !isExpanded
    if (expanded === undefined) setLocalExpanded(next)
    onExpandedChange?.(next)
  }

  return (
    <MotionConfig reducedMotion="never">
    <Motion.section
      className="roadmap-document-node"
      aria-label={name}
      data-expanded={isExpanded}
      style={{ width, '--roadmap-document-collapsed-size': `${ROADMAP_NODE_SIZES.document.collapsedRatio * 100}%`, '--roadmap-document-expanded-size': `${ROADMAP_NODE_SIZES.document.expandedRatio * 100}%`, ...style }}
      initial="rest"
      animate="rest"
      whileTap="tap"
      variants={{
        rest: { transform: 'translateY(0px) scale(1)', filter: 'drop-shadow(0px 3px 2px rgba(0, 0, 0, 0.12))' },
        tap: {
          transform: 'translateY(2px) scale(0.97)',
          filter: 'drop-shadow(1px 2px 1px rgba(0, 0, 0, 0.18))',
          transition: { duration: 0.12, ease: [0.2, 0.8, 0.2, 1] },
        },
      }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="roadmap-document-node__header">
        <button className="roadmap-document-node__icon-button nodrag nopan" type="button" aria-label={`${name}のアイコンを変更`} aria-haspopup="dialog" onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setPickerOpen(true) }}>
        {selectedEmoji ? <span className="roadmap-document-node__emoji" aria-hidden="true">{selectedEmoji}</span> : (
        <svg className="roadmap-document-node__icon" viewBox="0 0 200 200" fill="none" aria-hidden="true">
          <rect width="200" height="200" rx="30" fill="#222221" />
          <path d="M62 45h37a6 6 0 0 1 6 6v28a6 6 0 0 0 6 6h28a6 6 0 0 1 6 6v58a6 6 0 0 1-6 6H61a6 6 0 0 1-6-6V51a6 6 0 0 1 7-6Z" fill="#D4CFBF" />
          <path d="M110 52a3 3 0 0 1 5-2l25 25a3 3 0 0 1-2 5h-25a3 3 0 0 1-3-3Z" fill="#D4CFBF" />
          <path d="M74 104h52M74 121h52M74 139h32" stroke="#222221" strokeWidth="7.5" strokeLinecap="round" />
        </svg>
        )}
        </button>
        <span className="roadmap-document-node__title">{name}</span>
      </div>
      <div ref={contentRef} id={contentId} className="roadmap-document-node__content" aria-hidden={!isExpanded} inert={!isExpanded} onKeyDown={(event) => event.stopPropagation()}>
        <div className="roadmap-document-node__text">{children}</div>
      </div>
      <button className="roadmap-document-node__toggle nodrag nopan" type="button" aria-expanded={isExpanded} aria-controls={contentId} aria-label={`${name}を${isExpanded ? '閉じる' : '開く'}`} onClick={toggle} onDoubleClick={(event) => event.stopPropagation()}>
        <svg viewBox="0 0 60 40" fill="none" aria-hidden="true">
          <path d="m8 9 22 22L52 9" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </Motion.section>
    {pickerOpen && <Suspense fallback={null}><DocumentEmojiPicker value={selectedEmoji} onClose={() => setPickerOpen(false)} onSelect={next => { if (emoji === undefined) setLocalEmoji(next); onEmojiChange?.(next); setPickerOpen(false) }} /></Suspense>}
    </MotionConfig>
  )
}
