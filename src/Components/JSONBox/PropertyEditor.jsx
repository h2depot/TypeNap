import { useLayoutEffect, useRef } from 'react'
import { Plus, X } from '../../assets/IconList'
import { useId } from 'react'
import styles from './jsonbox.module.css'

// A single logical line, with textarea wrapping and automatic visual height.
export function MultilineField({ value, onChange, onKeyDown, ...props }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const field = ref.current
    const resize = () => {
      field.style.height = 'auto'
      field.style.height = `${field.scrollHeight}px`
    }
    resize()
    let width = field.getBoundingClientRect().width
    const observer = new ResizeObserver(() => {
      const nextWidth = field.getBoundingClientRect().width
      if (nextWidth !== width) { width = nextWidth; resize() }
    })
    observer.observe(field)
    return () => observer.disconnect()
  }, [value])
  return <textarea {...props} ref={ref} className={styles['property-input']} rows={1} value={value}
    onKeyDown={event => {
      onKeyDown?.(event)
      if (!event.defaultPrevented && !event.nativeEvent.isComposing && event.keyCode !== 229 && event.key === 'Enter') {
        event.preventDefault()
        event.currentTarget.blur()
      }
    }}
    onChange={event => {
      const field = event.currentTarget
      const normalize = text => text.replace(/\r\n|[\n\r\u0085\u2028\u2029]/g, ' ')
      const next = normalize(field.value)
      if (next !== field.value) {
        const start = normalize(field.value.slice(0, field.selectionStart)).length
        const end = normalize(field.value.slice(0, field.selectionEnd)).length
        field.value = next
        field.setSelectionRange(start, end)
      }
      onChange?.(event)
    }} />
}

export function StringList({ name, values, onChange, deletionLocked }) {
  return <div className={styles['string-list']}>
    {values.length === 0 && <span className={styles['list-empty']}>まだ項目がありません</span>}
    {values.map((value, index) => <div className={styles['list-item']} key={index}>
      <MultilineField aria-label={`${name}の項目${index + 1}`} placeholder="項目を入力…" value={value} onChange={e => onChange(values.map((item, i) => i === index ? e.target.value : item))} />
      {!deletionLocked && <button type="button" className={styles['quiet-action']} aria-label={`${name}の項目${index + 1}を削除`} onClick={() => { if (!deletionLocked) onChange(values.filter((_, i) => i !== index)) }}><X size={14} /></button>}
    </div>)}
    <button type="button" className={styles['list-add']} onClick={() => onChange([...values, ''])}><Plus size={14} />項目を追加</button>
  </div>
}

export function PropertySection({ title, count, expanded, onToggle, actions, children }) {
  const sectionId = useId()
  return <section className={styles.properties} aria-label={title}>
    <div className={styles['section-heading']}>
      <h2><button type="button" data-template-heading className={styles.sectionToggle} aria-expanded={expanded} aria-controls={sectionId} onClick={onToggle}><span className={styles.sectionTriangle} data-expanded={expanded} aria-hidden="true" />{title}</button></h2>
      <div className={styles.propertyTools}><span className={styles['section-count']}>{count}</span>{actions}</div>
    </div>
    <div id={sectionId} hidden={!expanded}>{children}</div>
  </section>
}

