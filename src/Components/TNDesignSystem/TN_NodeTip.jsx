import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './TN_NodeTip.css'

export default function TN_NodeTip({ children, name = '', summary = '', maxLength = 120, theme, disabled = false }) {
  const anchor = useRef(null)
  const card = useRef(null)
  const id = useId()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [position, setPosition] = useState(null)
  const open = !disabled && !dismissed && (hovered || focused)
  const characters = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(typeof summary === 'string' ? summary : ''), ({ segment }) => segment)
  const limit = Number.isFinite(maxLength) ? Math.max(0, Math.floor(maxLength)) : 120
  const description = characters.length > limit ? `${characters.slice(0, limit).join('')}...` : characters.join('')

  useLayoutEffect(() => {
    if (!open) return
    let frame
    const update = () => {
      const bounds = anchor.current.getBoundingClientRect()
      const tip = card.current.getBoundingClientRect()
      const margin = 12
      const gap = 12
      const available = [
        { side: 'right', space: window.innerWidth - bounds.right - gap - margin, needed: tip.width },
        { side: 'left', space: bounds.left - gap - margin, needed: tip.width },
        { side: 'bottom', space: window.innerHeight - bounds.bottom - gap - margin, needed: tip.height },
        { side: 'top', space: bounds.top - gap - margin, needed: tip.height },
      ]
      const side = (available.find((item) => item.space >= item.needed) || available.sort((a, b) => (b.space - b.needed) - (a.space - a.needed))[0]).side
      let left = bounds.left + (bounds.width - tip.width) / 2
      let top = bounds.top
      if (side === 'right') left = bounds.right + gap
      if (side === 'left') left = bounds.left - tip.width - gap
      if (side === 'bottom') top = bounds.bottom + gap
      if (side === 'top') top = bounds.top - tip.height - gap
      left = Math.max(margin, Math.min(left, window.innerWidth - tip.width - margin))
      top = Math.max(margin, Math.min(top, window.innerHeight - tip.height - margin))
      const resolvedTheme = theme || anchor.current.closest('[data-theme]')?.getAttribute('data-theme') || (getComputedStyle(anchor.current).colorScheme === 'light' ? 'light' : 'dark')
      setPosition((previous) => previous?.left === left && previous?.top === top && previous?.theme === resolvedTheme ? previous : { left, top, theme: resolvedTheme })
      frame = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(frame)
  }, [open, theme])

  return (
    <span ref={anchor} className="TN-node-tip-anchor" tabIndex={disabled ? undefined : 0}
      aria-describedby={open ? id : undefined}
      onPointerEnter={() => { setHovered(true); setDismissed(false) }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => { setFocused(true); setDismissed(false) }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}
      onKeyDown={(event) => { if (event.key === 'Escape') setDismissed(true) }}>
      {children}
      {open && createPortal(
        <div ref={card} id={id} role="tooltip" className="TN-node-tip" data-theme={position?.theme || theme || 'dark'}
          style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden' }}>
          <strong className="TN-node-tip__name">{name}</strong>
          {description && <p className="TN-node-tip__summary">{description}</p>}
        </div>, document.body)}
    </span>
  )
}
