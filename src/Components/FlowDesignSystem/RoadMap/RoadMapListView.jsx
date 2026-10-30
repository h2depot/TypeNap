import { useId } from 'react'
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { TN_ListView } from '../../TNDesignSystem/TN_ListView.jsx'
import RoadMapListItem from './RoadMapListItem.jsx'
import { roadMapTextRows } from './roadMapText.js'
import TN_Button from '../../TNDesignSystem/TN_Button.jsx'

// A pointer must be over a row; keyboard sorting uses the closest row instead.
export const listCollisions = args => args.pointerCoordinates ? pointerWithin(args) : closestCenter(args)
const accessibility = { screenReaderInstructions: {
  draggable: 'スペースキーで並べ替えを開始し、上下の矢印キーで移動します。もう一度スペースキーで確定、Escapeキーでキャンセルします。',
} }

export default function RoadMapListView({ stories, theme, onReorder, onAction, query = '', onClearSearch, active = true }) {
  const sortId = useId()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const rows = roadMapTextRows(stories, query)
  const sortable = rows.length > 1 && !!onReorder
  return <div className="roadmap-list" role="region" aria-label="ストーリーの順番" tabIndex={0}>
    <div className="roadmap-list__heading">
      <h2>ストーリーの順番</h2>
      <span role="status">{rows.length === stories.length ? `${stories.length}件` : `${rows.length} / ${stories.length}件`}</span>
    </div>
    {rows.length ? <DndContext key={`${active ? 'active' : 'inactive'}:${query}`} id={sortId} sensors={sensors}
      collisionDetection={listCollisions} modifiers={[restrictToVerticalAxis, restrictToParentElement]} accessibility={accessibility}
      onDragEnd={({ active: dragged, over }) => {
        if (active && sortable && over && dragged.id !== over.id
          && rows.some(({ story }) => story.id === dragged.id) && rows.some(({ story }) => story.id === over.id)) {
          onReorder(dragged.id, over.id)
        }
      }}>
      <SortableContext items={rows.map(({ story }) => story.id)} strategy={verticalListSortingStrategy}>
        <TN_ListView theme={theme} className="roadmap-list__rows" role="list" aria-label="現在のストーリー順"
          maxWidth="900px" style={{ margin: '0 auto' }}>
          {rows.map(({ story, index }) => <RoadMapListItem key={story.id} story={story} index={index} active={active} sortable={sortable} onAction={onAction} />)}
        </TN_ListView>
      </SortableContext>
    </DndContext> : <div className="roadmap-list__empty">
      <p>{query.trim() ? '検索に一致するTextがありません。' : 'Textはまだありません。Text追加ボタンから追加できます。'}</p>
      {query.trim() && <TN_Button theme={theme} variant="secondary" onClick={onClearSearch}>検索をクリア</TN_Button>}
    </div>}
  </div>
}
