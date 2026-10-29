import { useId, useRef, useState } from 'react'
import { Search, Plus, User, Entity, Map, Page, Memo, LeftArrow, RightArrow } from '../../../assets/IconList.js'
import TN_TextField from '../../TNDesignSystem/TN_TextField.jsx'
import TN_DropdownMenu from '../../TNDesignSystem/TN_DropdownMenu.jsx'
import TN_Button from '../../TNDesignSystem/TN_Button.jsx'
import TN_IconButton from '../../TNDesignSystem/TN_IconButton.jsx'
import { TN_ListView, TN_ListItem } from '../../TNDesignSystem/TN_ListView.jsx'
import './GraphMapToolbar.css'
import { contentTypeForNode, findContentNode } from './graphContent.js'

export const graphNodeOptions = [
  { type: 'character', label: 'キャラクター', Icon: User, width: 200 },
  { type: 'entity', label: 'エンティティ', Icon: Entity, width: 240 },
  { type: 'world', label: 'ワールド', Icon: Map, width: 300 },
  { type: 'document', label: 'ドキュメント', Icon: Page, width: 300 },
  { type: 'memo', label: 'メモ', Icon: Memo, width: 340 },
]

const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase()

export default function GraphMapToolbar({ nodes, contents = [], onLocate, onAdd, ready, theme,
  canUndo, canRedo, onUndo, onRedo }) {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const searchId = useId()
  const [contentQuery, setContentQuery] = useState('')
  const normalizedQuery = normalize(query).trim()
  const results = nodes.filter(node => normalize(node.data.name).includes(normalizedQuery)
    || normalize(node.data.summary).includes(normalizedQuery))
  const searching = searchOpen && normalizedQuery !== ''

  const closeSearch = () => {
    searchRef.current?.querySelector('input')?.focus()
    setSearchOpen(false)
  }

  const locate = node => {
    if (!ready) return
    onLocate(node)
    closeSearch()
  }

  const handleSearchKeyDown = event => {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSearch()
      return
    }
    if (!searching) return
    const items = [...event.currentTarget.querySelectorAll('[data-graph-result]')]
    if (!items.length) return
    const index = items.indexOf(document.activeElement)
    let next
    if (event.key === 'ArrowDown') next = (index + 1) % items.length
    if (event.key === 'ArrowUp') next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length
    if (index >= 0 && event.key === 'Home') next = 0
    if (index >= 0 && event.key === 'End') next = items.length - 1
    if (next !== undefined) {
      event.preventDefault()
      items[next].focus()
    }
  }

  return <div className="graph-toolbar nodrag nopan nowheel"
    onKeyDown={event => {
      if (['Backspace', 'Delete'].includes(event.key)) event.stopPropagation()
    }}>
    <div ref={searchRef} className="graph-toolbar__search" role="search"
      onKeyDown={handleSearchKeyDown}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false)
      }}>
      <TN_TextField
        theme={theme}
        value={query}
        onChange={event => { setQuery(event.target.value); setSearchOpen(true) }}
        onFocus={() => setSearchOpen(true)}
        placeholder="Nodeを検索…"
        aria-label="Nodeを検索"
        aria-expanded={searching}
        aria-controls={searching ? searchId : undefined}
        icon={<Search size={18} aria-hidden="true" />}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing && searching && results.length) {
            event.preventDefault()
            locate(results[0])
          }
        }}
      />
      {searching && <div id={searchId} className="graph-toolbar__results" aria-label="検索結果">
        <TN_ListView theme={theme} maxWidth="100%" style={{ margin: 0, background: 'var(--flow-surface)' }}>
          <TN_ListItem title={`検索結果 ${results.length}件`} role="status"
            description={results.length ? undefined : '別のキーワードで検索してみてください。'} />
          {results.map(node => {
            const option = graphNodeOptions.find(option => option.type === node.type)
            const Icon = option?.Icon ?? Page
            return <TN_ListItem key={node.id}
              icon={<Icon size={20} aria-hidden="true" />}
              title={node.data.name || '名称未設定'}
              description={option?.label ?? node.type}
              disabled={!ready}
              onClick={() => locate(node)}
              role="button" tabIndex={ready ? 0 : -1} aria-disabled={!ready}
              data-graph-result
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  locate(node)
                }
              }} />
          })}
        </TN_ListView>
      </div>}
    </div>
    <div className="graph-toolbar__add">
      <TN_DropdownMenu
        theme={theme}
        trigger={<TN_Button theme={theme} variant="proceed" borderRadius="16px" disabled={!ready}
          style={{ height: '56px' }}><Plus size={18} aria-hidden="true" />Nodeを追加</TN_Button>}
        items={graphNodeOptions.map(({ type, label, Icon }) => {
          const item = { id: type, label, icon: <Icon size={18} aria-hidden="true" />, disabled: !ready }
          if (type === 'memo') return { ...item, onClick: () => onAdd(type) }
          const candidates = contents.filter(info => info.content_type === contentTypeForNode(type)
            && normalize(info.name).includes(normalize(contentQuery).trim()))
          return { ...item, submenu: {
            onOpen: () => setContentQuery(''),
            search: { value: contentQuery, onChange: setContentQuery,
              placeholder: `${label}を検索…`, label: `${label}の候補を検索` },
            title: label,
            emptyLabel: contentQuery.trim() ? '一致するコンテンツがありません。' : 'この種類のコンテンツはまだありません。',
            items: candidates.map(info => ({
              id: info.access_id, label: info.name, badge: findContentNode(nodes, info) ? '配置済み' : undefined,
              icon: <Icon size={18} aria-hidden="true" />,
              onClick: () => { onAdd(type, info); setSearchOpen(false) },
            })),
          } }
        })}
      />
    </div>
    <div className="graph-toolbar__history" role="group" aria-label="編集履歴">
      <TN_IconButton theme={theme} icon={<LeftArrow aria-hidden="true" />} size="small" borderRadius="10px"
        aria-label="元に戻す" title="元に戻す"
        disabled={!ready || !canUndo} onClick={onUndo} />
      <TN_IconButton theme={theme} icon={<RightArrow aria-hidden="true" />} size="small" borderRadius="10px"
        aria-label="やり直す" title="やり直す"
        disabled={!ready || !canRedo} onClick={onRedo} />
    </div>
  </div>
}
