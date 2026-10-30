import { useState } from 'react'
import { Plus } from '../../../assets/IconList.js'
import TabularActionButton from './TabularActionButton.jsx'
import TN_IconButton from '../../TNDesignSystem/TN_IconButton.jsx'
import TN_DropdownMenu from '../../TNDesignSystem/TN_DropdownMenu.jsx'
import { graphNodeOptions } from '../GraphMap/GraphMapToolbar.jsx'
import { elementTypes } from './tabularState.js'
import { findCandidateRow, tabularRowCandidates } from './tabularRows.js'

const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase()

export default function TabularRowMenu({ contents = [], elements = [], rows, theme, onAdd, ready = true, prominent = false }) {
  const [query, setQuery] = useState('')
  return <TN_DropdownMenu theme={theme}
    trigger={prominent ? <TabularActionButton theme={theme} disabled={!ready} variant="secondary"
      icon={<Plus size={18} aria-hidden="true" />}>
      {ready ? '行を追加' : '読み込み中…'}
    </TabularActionButton> : <TN_IconButton theme={theme} disabled={!ready} subtle variant="ghost" size="small"
      borderRadius="4px" style={{ width: 26, height: 26 }}
      aria-label={ready ? '行を追加' : '読み込み中…'} title={ready ? '行を追加' : '読み込み中…'}
      icon={<Plus size={16} aria-hidden="true" />} />}
    items={graphNodeOptions.filter(option => option.type === 'memo' || Object.hasOwn(elementTypes, option.type)).map(({ type, label, Icon }) => {
      const item = { id: type, label: type === 'memo' ? 'Memo' : label, icon: <Icon size={18} aria-hidden="true" />, disabled: !ready }
      if (type === 'memo') return { ...item, onClick: () => onAdd('note') }
      const candidates = tabularRowCandidates(type, contents, elements)
        .filter(candidate => normalize(candidate.name).includes(normalize(query).trim()))
      return { ...item, submenu: {
        onOpen: () => setQuery(''),
        title: label,
        search: { value: query, onChange: setQuery, placeholder: `${label}を検索…`, label: `${label}の候補を検索` },
        emptyLabel: query.trim() ? '一致するコンテンツがありません。' : 'この種類のコンテンツはまだありません。',
        items: candidates.map(candidate => {
          const added = !!findCandidateRow(rows, candidate)
          return { id: candidate.id, label: candidate.name || '名称未設定', icon: <Icon size={18} aria-hidden="true" />,
            badge: added ? '追加済み' : undefined, disabled: !ready || added,
            onClick: () => { if (ready && !added) onAdd(type, candidate) } }
        }),
      } }
    })} />
}
