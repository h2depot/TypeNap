import { useState } from 'react'
import { graphNodeOptions } from '../GraphMap/GraphMapToolbar.jsx'
import { contentTypeForNode } from '../GraphMap/graphContent.js'
import { stampTypes } from './roadMapStamps.js'
import TN_DropdownMenu from '../../TNDesignSystem/TN_DropdownMenu.jsx'
import TN_Button from '../../TNDesignSystem/TN_Button.jsx'
import { Plus } from '../../../assets/original_icons/index.js'

const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().trim()

export default function RoadMapStampMenu({ theme, contents, onAdd, ready }) {
  const [query, setQuery] = useState('')
  return <div className="nodrag nopan nowheel" onKeyDown={event => {
    if (['Backspace', 'Delete'].includes(event.key)) event.stopPropagation()
  }}>
    <TN_DropdownMenu theme={theme}
      trigger={<TN_Button theme={theme} variant="proceed" disabled={!ready} aria-label="スタンプを追加">
        <Plus size={18} aria-hidden="true" />スタンプを追加
      </TN_Button>}
      items={graphNodeOptions.filter(option => stampTypes.includes(option.type)).map(({ type, label, Icon }) => {
        const item = { id: type, label, icon: <Icon size={18} aria-hidden="true" />, disabled: !ready }
        if (type === 'memo') return { ...item, onClick: () => onAdd(type) }
        return { ...item, submenu: {
          title: label, onOpen: () => setQuery(''),
          search: { value: query, onChange: setQuery, placeholder: `${label}を検索…`, label: `${label}の候補を検索` },
          emptyLabel: query.trim() ? '一致するコンテンツがありません。' : 'この種類のコンテンツはまだありません。',
          items: contents.filter(info => info.content_type === contentTypeForNode(type) && normalize(info.name).includes(normalize(query)))
            .map(info => ({ id: info.access_id, label: info.name, icon: <Icon size={18} aria-hidden="true" />,
              onClick: () => onAdd(type, info) })),
        } }
      })} />
  </div>
}
