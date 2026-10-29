import { useRef } from 'react'
import { clampTabularSize, TABULAR_SIZES } from './tabularSizing.js'

export default function TabularResizeHandle({ kind, value, label, onChange, onStart, onEnd }) {
  const drag = useRef(null)
  const vertical = kind === 'row'
  const limits = TABULAR_SIZES[kind]

  function finish(event, cancel = false) {
    const current = drag.current
    if (!current) return
    drag.current = null
    if (cancel) onChange(current.value)
    onEnd()
    if (event.currentTarget.hasPointerCapture(current.id)) event.currentTarget.releasePointerCapture(current.id)
  }

  return <div className={`tabular__resize-handle tabular__resize-handle--${vertical ? 'row' : 'column'}`}
    role="separator" tabIndex={0} aria-label={label} aria-orientation={vertical ? 'horizontal' : 'vertical'}
    aria-valuemin={limits.min} aria-valuemax={limits.max} aria-valuenow={value} aria-valuetext={`${value}px`}
    title={`${label}：ドラッグ・矢印キーで調整、ダブルクリックで初期サイズに戻す`}
    onPointerDown={event => {
      if (event.button !== 0 || drag.current) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.focus()
      onStart()
      drag.current = { id: event.pointerId, coordinate: vertical ? event.clientY : event.clientX, value }
      event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerMove={event => {
      const current = drag.current
      if (!current || event.pointerId !== current.id) return
      event.preventDefault()
      const delta = (vertical ? event.clientY : event.clientX) - current.coordinate
      onChange(clampTabularSize(current.value + delta, kind))
    }}
    onPointerUp={event => { if (event.pointerId === drag.current?.id) finish(event) }}
    onPointerCancel={event => { if (event.pointerId === drag.current?.id) finish(event, true) }}
    onLostPointerCapture={() => { if (drag.current) { drag.current = null; onEnd() } }}
    onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); onStart(); onChange(limits.default); onEnd() }}
    onKeyDown={event => {
      if (event.key === 'Escape' && drag.current) { event.preventDefault(); event.stopPropagation(); finish(event, true); return }
      if (drag.current) return
      const decrease = vertical ? 'ArrowUp' : 'ArrowLeft'
      const increase = vertical ? 'ArrowDown' : 'ArrowRight'
      if (![decrease, increase, 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      const step = event.shiftKey ? 32 : 8
      const next = event.key === 'Home' ? limits.min : event.key === 'End' ? limits.max
        : value + (event.key === decrease ? -step : step)
      onStart(); onChange(clampTabularSize(next, kind)); onEnd()
    }} />
}
