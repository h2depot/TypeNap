import { createElement, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import TN_Dialog from '../../../TNDesignSystem/TN_Dialog.jsx'
import TN_TextField from '../../../TNDesignSystem/TN_TextField.jsx'
import { useTNTheme } from '../../../TNDesignSystem/theme.jsx'
import { Clock3, Smile, UserRound, Leaf, Pizza, Car, Trophy, Lightbulb, Heart, Flag, RotateCcw, LayoutGrid, Check, ChevronDown } from 'lucide-react'
import { Search } from '../../../../assets/original_icons/index.js'
import { describeEmoji, emojiCatalogue, findEmojis, readRecentEmojis, saveRecentEmojis, withSkinTone } from './documentEmojiData.js'
import './DocumentEmojiPicker.css'

const categories = [
  { id: 'recent', label: '最近使った絵文字', icon: Clock3 },
  { id: 0, label: '顔と気持ち', icon: Smile },
  { id: 1, label: '人とからだ', icon: UserRound },
  { id: 3, label: '動物と自然', icon: Leaf },
  { id: 4, label: '食べ物と飲み物', icon: Pizza },
  { id: 5, label: '乗り物と場所', icon: Car },
  { id: 6, label: '遊びとイベント', icon: Trophy },
  { id: 7, label: '道具ともの', icon: Lightbulb },
  { id: 8, label: '記号とハート', icon: Heart },
  { id: 9, label: '旗', icon: Flag },
]
const skinTones = ['標準', '薄い肌色', 'やや薄い肌色', '中間の肌色', 'やや濃い肌色', '濃い肌色']
const skinColors = ['#f8ca4a', '#ffddbd', '#ebbf93', '#bd8a64', '#8e6046', '#553d32']
const suggested = ['😭', '🤔', '🎉', '⚠️', '⚙️', '🎃', '👾', '💀', '👻', '❤️', '😊', '😂', '🤣', '😍', '🙄', '👌', '😘', '💕', '😁', '👍', '🙌', '🤦', '🐑', '✨']

export default function DocumentEmojiPicker({ value, onSelect, onClose, theme: themeOverride }) {
  const theme = useTNTheme(themeOverride)
  const dialogRef = useRef(null)
  const scrollRef = useRef(null)
  const resultsId = useId()
  const [recent, setRecent] = useState(readRecentEmojis)
  const [category, setCategory] = useState('recent')
  const [query, setQuery] = useState('')
  const [tone, setTone] = useState(0)
  const [toneOpen, setToneOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const [preview, setPreview] = useState(() => value ? describeEmoji(value) : null)
  const searching = query.trim().length > 0
  const activeCategory = categories.find(item => item.id === category)
  const items = useMemo(() => {
    if (searching) return findEmojis(query, tone)
    if (category === 'recent') return (recent.length ? recent : suggested).map(describeEmoji)
    return emojiCatalogue.filter(emoji => emoji.group === category).map(emoji => withSkinTone(emoji, tone))
  }, [searching, query, tone, category, recent])
  const heading = searching ? '検索結果' : category === 'recent' ? recent.length ? '最近使った絵文字' : 'おすすめ' : activeCategory.label

  useLayoutEffect(() => {
    const previousFocus = document.activeElement
    dialogRef.current?.querySelector('input[type="search"]')?.focus()
    return () => previousFocus?.focus?.({ preventScroll: true })
  }, [])

  useLayoutEffect(() => { scrollRef.current?.scrollTo(0, 0) }, [query, category, compact])

  function selectEmoji(unicode) {
    if (unicode) saveRecentEmojis([unicode, ...readRecentEmojis().filter(item => item !== unicode)])
    onSelect(unicode)
  }

  function changeCategory(next) {
    setCategory(next)
    setQuery('')
    setToneOpen(false)
    setPreview(value ? describeEmoji(value) : null)
  }

  function navigateCategories(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const buttons = [...event.currentTarget.querySelectorAll('button')]
    const index = buttons.indexOf(event.target)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
    changeCategory(categories[next].id)
    buttons[next].focus()
  }

  function navigateGrid(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    const buttons = [...event.currentTarget.querySelectorAll('button')]
    const index = buttons.indexOf(event.target)
    if (index < 0) return
    event.preventDefault()
    const columns = getComputedStyle(event.currentTarget).gridTemplateColumns.split(' ').length
    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key]
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + offset))
    buttons[next].focus()
  }

  function handleDialogKeyDown(event) {
    event.stopPropagation()
    if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      onClose()
    }
    if (event.key !== 'Tab') return
    const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')]
      .filter(control => control.getClientRects().length > 0)
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return createPortal(
    <div ref={dialogRef} className="nodrag nopan nowheel" onKeyDown={handleDialogKeyDown}
      onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
      onDoubleClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
    <TN_Dialog isOpen theme={theme} title="絵文字" onClose={onClose} maxWidth="456px"
      bodyStyle={{ padding: 0, maxHeight: 'none', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <div className="document-emoji-picker" data-theme={theme}>
      <header className="document-emoji-picker__header">
        <div className="document-emoji-picker__title"><span>ノートに、ひとつの表情を。</span></div>
        <div className="document-emoji-picker__header-actions">
          <button type="button" className="document-emoji-picker__tool" aria-label="コンパクト表示" aria-pressed={compact} title="表示サイズを切り替え" onClick={() => setCompact(!compact)}><LayoutGrid size={18} /></button>
        </div>
      </header>

      <div className="document-emoji-picker__categories" role="toolbar" aria-label="絵文字のカテゴリ" onKeyDown={navigateCategories}>
        {categories.map(item => <button key={item.id} type="button" aria-label={item.label} title={item.label} aria-pressed={!searching && category === item.id} onClick={() => changeCategory(item.id)}>{createElement(item.icon, { size: 21, strokeWidth: 1.7 })}</button>)}
      </div>

      <div className="document-emoji-picker__search">
        <TN_TextField type="search" theme={theme} value={query}
          aria-label="絵文字の検索" placeholder="絵文字の検索" icon={<Search size={18} aria-hidden="true" />} borderRadius="10px"
          onChange={event => { setQuery(event.target.value); setPreview(null) }} autoComplete="off" spellCheck={false} />
      </div>

      <div className="document-emoji-picker__section-heading">
        <h3 id={resultsId}>{heading}<span aria-live="polite">{items.length}</span></h3>
        {category === 'recent' && !searching && recent.length > 0 && <button type="button" className="document-emoji-picker__text-button" onClick={() => { saveRecentEmojis([]); setRecent([]) }}>履歴をクリア</button>}
        <div className="document-emoji-picker__skin-control">
          <button type="button" className="document-emoji-picker__skin-trigger" aria-label={`肌の色：${skinTones[tone]}`} aria-expanded={toneOpen} onClick={() => setToneOpen(!toneOpen)}><span style={{ background: skinColors[tone] }} /><ChevronDown size={13} /></button>
          {toneOpen && <div className="document-emoji-picker__skin-options" role="group" aria-label="肌の色">
            {skinTones.map((label, index) => <button key={label} type="button" aria-label={label} title={label} aria-pressed={tone === index} onClick={() => { setTone(index); setToneOpen(false) }} style={{ background: skinColors[index] }}>{tone === index && <Check size={14} />}</button>)}
          </div>}
        </div>
      </div>

      <div className="document-emoji-picker__scroll" ref={scrollRef}>
        {items.length > 0 ? <div className="document-emoji-picker__grid" data-compact={compact} role="group" aria-labelledby={resultsId} onKeyDown={navigateGrid}>
          {items.map(item => <button key={item.unicode} type="button" className="document-emoji-picker__emoji" aria-label={item.label} title={item.label} aria-pressed={value === item.unicode} onMouseEnter={() => setPreview(item)} onFocus={() => setPreview(item)} onClick={() => selectEmoji(item.unicode)}><span aria-hidden="true">{item.unicode}</span></button>)}
        </div> : <div className="document-emoji-picker__empty"><Search size={32} /><strong>見つからなかったみたい</strong><p>「ねこ」「ハート」などで探してみてね。<br />好きな絵文字を貼り付けても選べるよ。</p><button type="button" onClick={() => setQuery('')}>検索をクリア</button></div>}
      </div>

      <footer className="document-emoji-picker__footer">
        <div className="document-emoji-picker__preview" aria-hidden="true"><span>{preview?.unicode || '✨'}</span><div><strong>{preview?.label || 'どんな気分のノート？'}</strong><small>{preview ? 'クリックしてアイコンに設定' : '絵文字を選んで、自分らしく'}</small></div></div>
        <button className="document-emoji-picker__reset" type="button" title="元のアイコンに戻す" onClick={() => selectEmoji('')}><RotateCcw size={15} /><span>元に戻す</span></button>
      </footer>
    </div>
    </TN_Dialog>
    </div>, document.body,
  )
}
