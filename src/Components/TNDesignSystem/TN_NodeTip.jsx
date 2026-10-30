import './TN_Selection.css';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './TN_NodeTip.css'

const defaultTipSides = ['right', 'left', 'bottom', 'top']

export default function TN_NodeTip({ children, name = '', summary = '', maxLength = 120, theme, disabled = false, actions, preferredSides = defaultTipSides }) {
  const anchor = useRef(null)
  const card = useRef(null)
  const closeTimer = useRef(null)
  const pointerFocus = useRef(false)
  const id = useId()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [position, setPosition] = useState(null)
  const open = !disabled && !dismissed && (hovered || focused)
  const characters = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(typeof summary === 'string' ? summary : ''), ({ segment }) => segment)
  const limit = Number.isFinite(maxLength) ? Math.max(0, Math.floor(maxLength)) : 120
  const description = characters.length > limit ? `${characters.slice(0, limit).join('')}...` : characters.join('')

  useEffect(() => () => clearTimeout(closeTimer.current), [])
  const enter = () => {
    clearTimeout(closeTimer.current)
    setHovered(true)
    setDismissed(false)
  }
  const leave = event => {
    if (anchor.current?.contains(event.relatedTarget) || card.current?.contains(event.relatedTarget)) return
    clearTimeout(closeTimer.current)
    if (actions) closeTimer.current = setTimeout(() => setHovered(false), 250)
    else setHovered(false)
  }
  const blur = event => {
    if (!anchor.current?.contains(event.relatedTarget) && !card.current?.contains(event.relatedTarget)) {
      pointerFocus.current = false
      setFocused(false)
    }
  }
  const focus = () => {
    // Pointer clicks must not pin a hover tip open after the pointer leaves.
    setFocused(!pointerFocus.current)
    setDismissed(false)
  }
  const keyboard = event => {
    if (event.key !== 'Escape' || event.nativeEvent?.isComposing) return
    event.stopPropagation()
    if (card.current?.contains(event.target)) anchor.current?.focus({ preventScroll: true })
    setDismissed(true)
  }

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
      const preferred = preferredSides.map(side => available.find(item => item.side === side)).filter(Boolean)
      const candidates = preferred.length ? preferred : available
      const side = (candidates.find((item) => item.space >= item.needed) || candidates.sort((a, b) => (b.space - b.needed) - (a.space - a.needed))[0]).side
      let left = bounds.left + (bounds.width - tip.width) / 2
      let top = bounds.top
      if (side === 'right') left = bounds.right + gap
      if (side === 'left') left = bounds.left - tip.width - gap
      if (side === 'bottom') top = bounds.bottom + gap
      if (side === 'top') top = bounds.top - tip.height - gap
      left = Math.max(margin, Math.min(left, window.innerWidth - tip.width - margin))
      top = Math.max(margin, Math.min(top, window.innerHeight - tip.height - margin))
      const resolvedTheme = theme || anchor.current.closest('[data-theme]')?.getAttribute('data-theme') || (getComputedStyle(anchor.current).colorScheme === 'light' ? 'light' : 'dark')
      setPosition((previous) => previous?.left === left && previous?.top === top && previous?.theme === resolvedTheme && previous?.side === side ? previous : { left, top, theme: resolvedTheme, side })
      frame = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(frame)
  }, [open, theme, preferredSides])

  return (
    <span data-tn-ui ref={anchor} className="TN-node-tip-anchor" tabIndex={disabled ? undefined : 0}
      aria-describedby={open ? id : undefined}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onPointerDownCapture={() => { pointerFocus.current = true; setFocused(false) }}
      onKeyDownCapture={() => { pointerFocus.current = false }}
      onFocus={focus}
      onBlur={blur}
      onKeyDown={keyboard}>
      {children}
      {open && createPortal(
        <div data-tn-ui ref={card} className={`TN-node-tip-layer${actions ? ' TN-node-tip-layer--interactive' : ''}`}
          data-side={position?.side} role={actions ? 'group' : undefined} aria-label={actions ? `${name}の操作` : undefined}
          style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden' }}
          onPointerEnter={actions ? enter : undefined} onPointerLeave={actions ? leave : undefined}
          onFocus={actions ? focus : undefined} onBlur={actions ? blur : undefined}
          onPointerDown={actions ? event => event.stopPropagation() : undefined}
          onDoubleClick={actions ? event => event.stopPropagation() : undefined}
          onKeyDown={actions ? event => { keyboard(event); event.stopPropagation() } : undefined}
          onClick={actions ? event => event.stopPropagation() : undefined}>
          <div id={id} role="tooltip" className="TN-node-tip" data-theme={position?.theme || theme || 'dark'}>
            <strong className="TN-node-tip__name">{name}</strong>
            {description && <p className="TN-node-tip__summary">{description}</p>}
          </div>
          {actions && <div className="TN-node-tip__actions" onClick={event => { event.stopPropagation(); setDismissed(true) }}>
            {actions}
          </div>}
        </div>, document.body)}
    </span>
  )
}
