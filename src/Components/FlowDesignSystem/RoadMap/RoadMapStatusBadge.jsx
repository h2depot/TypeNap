import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion as Motion, useReducedMotion } from 'framer-motion'
import { Check, Circle, Pencil, RefreshCw } from 'lucide-react'
import TN_FloatingLayer from '../../TNDesignSystem/TN_FloatingLayer.jsx'
import { normalizeWritingStatus, writingStatuses } from './writingStatus.js'

const statusIcons = { not_started: Circle, writing: Pencil, draft_complete: Check, revising: RefreshCw }

function StatusIcon({ value }) {
  const Icon = statusIcons[value]
  return <Icon size={12} strokeWidth={2.4} aria-hidden="true" />
}

export default function RoadMapStatusBadge({ name, value, theme, disabled, onChange, onInteractionChange }) {
  const status = normalizeWritingStatus(value)
  const label = writingStatuses.find(item => item.value === status).label
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const anchorRef = useRef(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()
  const tipId = useId()
  const reduceMotion = useReducedMotion()
  const close = useCallback(() => {
    setOpen(false)
    buttonRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => { onInteractionChange(open || hovered || focused) }, [open, hovered, focused, onInteractionChange])
  useEffect(() => {
    if (disabled) { setOpen(false); setHovered(false); setFocused(false) }
  }, [disabled])
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true })
    const outside = event => {
      if (!anchorRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) close()
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [open, close])

  const keyboard = event => {
    event.stopPropagation()
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (event.key === 'Tab') { close(); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const buttons = [...menuRef.current.querySelectorAll('[role="menuitemradio"]')]
    const current = buttons.indexOf(document.activeElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next]?.focus()
  }

  return <div ref={anchorRef} className="roadmap-status nodrag nopan" data-open={open}
    onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
    onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <button ref={buttonRef} type="button" className="roadmap-status__button" disabled={disabled}
      aria-label={`${name}の執筆状態: ${label}`} aria-haspopup="menu" aria-expanded={open}
      aria-controls={open ? menuId : undefined} aria-describedby={!open && (hovered || focused) ? tipId : undefined}
      onClick={() => open ? close() : setOpen(true)}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) }
      }}>
      <span className="roadmap-status__badge" data-status={status}>
        <AnimatePresence initial={false}>
          <Motion.span key={status} className="roadmap-status__glyph" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.12 }}>
            <StatusIcon value={status} />
          </Motion.span>
        </AnimatePresence>
      </span>
    </button>
    {!open && (hovered || focused) && !disabled && <span id={tipId} role="tooltip" className="roadmap-status__tip">{label}</span>}
    {open && <TN_FloatingLayer anchorRef={anchorRef} interactive>
      <div id={menuId} ref={menuRef} role="menu" aria-label={`${name}の執筆状態`} data-tn-popup-panel data-theme={theme}
        className="roadmap-status-menu" onKeyDown={keyboard}
        onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
        <div className="roadmap-status-menu__heading">執筆状態</div>
        {writingStatuses.map(item => <button key={item.value} type="button" role="menuitemradio"
          aria-checked={status === item.value} tabIndex={status === item.value ? 0 : -1}
          onClick={() => { onChange(item.value); close() }}>
          <span className="roadmap-status__badge" data-status={item.value}><StatusIcon value={item.value} /></span>
          <span>{item.label}</span>
          {status === item.value && <Check size={16} className="roadmap-status-menu__check" aria-hidden="true" />}
        </button>)}
      </div>
    </TN_FloatingLayer>}
  </div>
}
