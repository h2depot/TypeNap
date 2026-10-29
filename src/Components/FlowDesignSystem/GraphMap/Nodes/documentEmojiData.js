import japanese from 'emojibase-data/ja/compact.json' with { type: 'json' }
import english from 'emojibase-data/en/compact.json' with { type: 'json' }

const RECENT_KEY = 'typenap.document-emojis.recent.v1'
const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' })
const englishByCode = new Map(english.map(emoji => [emoji.hexcode, emoji]))

export function normalizeSearch(value) {
  return value.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60))
}

export function isSingleEmoji(value) {
  return typeof value === 'string' && value.length <= 32 &&
    [...segmenter.segment(value)].length === 1 &&
    /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(value)
}

// Keep labels and search terms offline, and leave standalone emoji components out.
export const emojiCatalogue = japanese
  .filter(emoji => emoji.group !== undefined && emoji.group !== 2)
  .sort((a, b) => a.order - b.order)
  .map(emoji => {
    const en = englishByCode.get(emoji.hexcode)
    return { ...emoji, search: normalizeSearch([emoji.label, ...(emoji.tags || []), en?.label, ...(en?.tags || [])].join(' ')) }
  })

const emojiByUnicode = new Map(emojiCatalogue.flatMap(emoji => [emoji, ...(emoji.skins || [])].map(item => [item.unicode, item])))

export function withSkinTone(emoji, tone) {
  if (!tone) return emoji
  const modifier = (0x1F3FA + tone).toString(16).toUpperCase()
  return emoji.skins?.find(variant => {
    const modifiers = variant.hexcode.match(/1F3F[B-F]/g) || []
    return modifiers.length > 0 && modifiers.every(code => code === modifier)
  }) || emoji
}

export function findEmojis(query, tone = 0) {
  const trimmed = query.trim()
  if (isSingleEmoji(trimmed)) return [emojiByUnicode.get(trimmed) || { unicode: trimmed, label: 'この絵文字を使う', hexcode: trimmed }]
  const terms = normalizeSearch(trimmed).split(/\s+/).filter(Boolean)
  return emojiCatalogue.filter(emoji => terms.every(term => emoji.search.includes(term))).map(emoji => withSkinTone(emoji, tone))
}

export function describeEmoji(unicode) {
  return emojiByUnicode.get(unicode) || { unicode, label: unicode, hexcode: unicode }
}

export function readRecentEmojis() {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(stored) ? [...new Set(stored.filter(isSingleEmoji))].slice(0, 36) : []
  } catch { return [] }
}

export function saveRecentEmojis(values) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(values.slice(0, 36))) } catch { /* Selection also works when storage is unavailable. */ }
}
