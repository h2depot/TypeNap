import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TN_ListItem } from '../../TNDesignSystem/TN_ListView.jsx'
import TN_Menu from '../../TNDesignSystem/TN_Menu.jsx'
import TN_IconButton from '../../TNDesignSystem/TN_IconButton.jsx'
import { EllipsisVertical } from '../../../assets/IconList.js'
import { useTranslation } from 'react-i18next'

export default function RoadMapListItem({ story, index, theme, active, sortable, onAction }) {
  const { id, data } = story
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isSorting } = useSortable({
    id, disabled: !active || !sortable,
  })
  const start = (event, listener) => {
    // Menu events bubble through React's portal but must not start a row drag.
    if (event.currentTarget && !event.currentTarget.contains(event.target)) return
    if (!active || !sortable || event.target.closest?.('button, input, textarea, a, [role="menuitem"], [data-tn-list-control]')) return
    listener?.(event)
  }

  return <TN_ListItem {...attributes}
    onMouseDown={event => start(event, listeners?.onMouseDown)}
    onTouchStart={event => start(event, listeners?.onTouchStart)}
    onKeyDown={event => start(event, listeners?.onKeyDown)}
    ref={element => { setNodeRef(element); setActivatorNodeRef(element) }}
    theme={theme} role="listitem" tabIndex={active && sortable ? 0 : -1}
    aria-label={`${index + 1}. ${data.name}`} aria-roledescription={sortable ? '並べ替えできるストーリー' : undefined}
    data-story-id={id} data-dragging={isDragging || undefined}
    className="roadmap-list__item" interactive={active && !isSorting}
    style={{
      // dnd-kit owns the row transform; the shared ListView owns icon feedback.
      transform: CSS.Transform.toString(transform),
      transition: [transition, 'background-color 180ms ease', 'box-shadow 180ms ease'].filter(Boolean).join(', '),
      cursor: active && sortable ? isDragging ? 'grabbing' : 'grab' : 'default',
      zIndex: isDragging ? 1 : undefined,
    }}
    icon={<span className="roadmap-list__identity">
      <span className="roadmap-list__number" aria-label={`順番 ${index + 1}`}>{index + 1}</span>
      <span className="roadmap-list__emoji" aria-hidden="true">{data.emoji || '📖'}</span>
    </span>}
    title={data.name} description={<span className="roadmap-list__summary">{data.content}</span>}
    control={<TN_Menu key={active && !isSorting ? 'active' : 'inactive'} theme={theme}
      trigger={<TN_IconButton type="button" theme={theme} variant="ghost" subtle size="small"
        className="roadmap-list__menu-button" icon={<EllipsisVertical size={18} />} disabled={!active || isSorting}
        aria-label={`${data.name}のメニュー`} title={`${data.name}のメニュー`} />}
      items={[
        { id: 'rename', label: t('common.rename'), onClick: () => onAction?.('rename', story) },
        { id: 'delete', label: t('common.delete'), isDanger: true, onClick: () => onAction?.('delete', story) },
      ]} />} />
}
