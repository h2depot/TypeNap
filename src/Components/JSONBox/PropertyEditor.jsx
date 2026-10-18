import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Plus, Trash2, X } from '../../assets/IconList'
import TN_Dropdown from '../TNDesignSystem/TN_Dropdown'
import { useId } from 'react'
import styles from './jsonbox.module.css'

function PropertyName({ name, properties, reservedNames, onRename }) {
  const [draft, setDraft] = useState(name)
  const [error, setError] = useState('')
  useEffect(() => { setDraft(name); setError('') }, [name])
  const commit = () => {
    const next = draft.trim()
    if (next === name) { setDraft(name); setError(''); return }
    if (!next || Object.hasOwn(properties, next) || reservedNames.includes(next)) {
      setError(!next ? '属性名を入力してください' : '同じ名前の属性があります')
      setDraft(name)
      return
    }
    setError('')
    onRename(next)
  }
  return <>
    <MultilineField aria-label={`${name}の属性名`} value={draft} aria-invalid={Boolean(error)}
      onChange={event => { setDraft(event.target.value); setError('') }} onBlur={commit}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
        if (event.key === 'Escape') { event.preventDefault(); setDraft(name); setError(''); }
      }} />
    {error && <small role="alert" className={styles['property-error']}>{error}</small>}
  </>
}

// A single logical line, with textarea wrapping and automatic visual height.
function MultilineField({ value, onChange, onKeyDown, ...props }) {
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

function StringList({ name, values, onChange, deletionLocked }) {
  return <div className={styles['string-list']}>
    {values.length === 0 && <span className={styles['list-empty']}>まだ項目がありません</span>}
    {values.map((value, index) => <div className={styles['list-item']} key={index}>
      <MultilineField aria-label={`${name}の項目${index + 1}`} placeholder="項目を入力…" value={value} onChange={e => onChange(values.map((item, i) => i === index ? e.target.value : item))} />
      {!deletionLocked && <button type="button" className={styles['quiet-action']} aria-label={`${name}の項目${index + 1}を削除`} onClick={() => { if (!deletionLocked) onChange(values.filter((_, i) => i !== index)) }}><X size={14} /></button>}
    </div>)}
    <button type="button" className={styles['list-add']} onClick={() => onChange([...values, ''])}><Plus size={14} />項目を追加</button>
  </div>
}

export default function PropertyEditor({ properties, onChange, reservedNames = [], deletionLocked = true }) {
  const [expanded, setExpanded] = useState(true)
  const sectionId = useId()
  const [name, setName] = useState('')
  const [type, setType] = useState('String')
  const [creating, setCreating] = useState(false)
  const createForm = useRef(null)
  const dropdownLayer = useRef(null)
  // Dropdown options live in a portal; React capture still reaches this form.
  const rememberDropdownLayer = event => {
    const layer = event.target.closest('[data-tn-floating-layer]')
    if (layer) dropdownLayer.current = layer
  }
  useEffect(() => {
    if (!creating) return
    const closeOutside = event => {
      if (createForm.current?.contains(event.target) || dropdownLayer.current?.contains(event.target)) return
      setCreating(false)
    }
    const close = () => setCreating(false)
    document.addEventListener('focusin', closeOutside)
    document.addEventListener('pointerdown', closeOutside)
    window.addEventListener('blur', close)
    return () => {
      document.removeEventListener('focusin', closeOutside)
      document.removeEventListener('pointerdown', closeOutside)
      window.removeEventListener('blur', close)
      dropdownLayer.current = null
    }
  }, [creating])
  const trimmed = name.trim()
  const duplicate = Object.hasOwn(properties, trimmed) || reservedNames.includes(trimmed)
  const setValue = (key, value) => onChange({ ...properties, [key]: value })
  return <section className={styles['properties']} aria-label="オリジナル属性">
    <div className={styles['section-heading']}><h2><button type="button" className={styles.sectionToggle} aria-expanded={expanded} aria-controls={sectionId} onClick={() => { setExpanded(open => !open); setCreating(false) }}><span className={styles.sectionTriangle} data-expanded={expanded} aria-hidden="true" />オリジナル属性</button></h2><span className={styles['section-count']}>{Object.keys(properties).length}</span></div>
    <div id={sectionId} hidden={!expanded}>
    {Object.keys(properties).length === 0 && <p className={styles['properties-empty']}>名前や特徴、背景など、残しておきたいことをひとつずつ。</p>}
    {Object.entries(properties).map(([key, value]) => {
      const isList = Array.isArray(value)
      return <div className={styles['property']} key={key}>
        <div className={styles['property-label']}><PropertyName name={key} properties={properties} reservedNames={reservedNames} onRename={next => onChange(Object.fromEntries(Object.entries(properties).map(([name, item]) => [name === key ? next : name, item])))} /></div>
        <div className={styles['property-value']}>{isList ? <StringList name={key} values={value} deletionLocked={deletionLocked} onChange={next => setValue(key, next)} /> : <MultilineField id={`prop-${key}`} aria-label={`${key}の値`} placeholder="未設定" value={value} onChange={e => setValue(key, e.target.value)} />}</div>
        {!deletionLocked && <button type="button" className={styles['quiet-action'] + ' ' + styles['property-delete']} aria-label={`${key}を削除`} onClick={() => { if (!deletionLocked) onChange(Object.fromEntries(Object.entries(properties).filter(([n]) => n !== key))) }}><Trash2 size={15} /></button>}
      </div>
    })}
    <div className={styles['property-add-area']}>
    {creating ? <form ref={createForm} className={styles['property-create']} onFocusCapture={rememberDropdownLayer} onPointerDownCapture={rememberDropdownLayer}
      onSubmit={e => { e.preventDefault(); if (trimmed && !duplicate) { setValue(trimmed, type === 'StringList' ? [] : ''); setName(''); setCreating(false) } }}>
      <MultilineField autoFocus aria-label="追加する属性名" aria-invalid={duplicate} aria-describedby={duplicate ? 'property-error' : undefined} placeholder="新しい属性名…" value={name} onChange={e => setName(e.target.value)}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing || event.keyCode === 229 || event.key !== 'Enter') return
          event.preventDefault()
          createForm.current?.requestSubmit()
        }} />
      <TN_Dropdown aria-label="属性の種類" value={type} onChange={setType} scale={0.8} width="180px"
        options={[{ value: 'String', label: 'String · 文字列' }, { value: 'StringList', label: 'StringList · リスト' }]} />
      <button className={styles['list-add']} type="submit" disabled={!trimmed || duplicate}><Plus size={14} />追加</button>
      <button type="button" className={styles['quiet-action']} aria-label="属性の追加をキャンセル" onClick={() => setCreating(false)}><X size={16} /></button>
    </form> : <button type="button" className={styles['list-add'] + ' ' + styles['property-add']} onClick={() => setCreating(true)}><Plus size={18} />オリジナル属性を追加</button>}
    {creating && duplicate && <small id="property-error" className={styles['property-error']}>同じ名前の属性があります</small>}
    </div>
    </div>
  </section>
}


