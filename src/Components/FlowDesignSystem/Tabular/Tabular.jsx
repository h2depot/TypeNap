import { useEffect, useRef, useState } from 'react'
import { Check, LeftArrow, Plus, RightArrow, Trash2 } from '../../../assets/IconList.js'
import TN_IconButton from '../../TNDesignSystem/TN_IconButton.jsx'
import TabularActionButton from './TabularActionButton.jsx'
import TabularRowMenu from './TabularRowMenu.jsx'
import TabularRowHeading from './TabularRowHeading.jsx'
import TabularTextArea from './TabularTextArea.jsx'
import TabularResizeHandle from './TabularResizeHandle.jsx'
import { TABULAR_STORAGE_KEY, emptyTabularData, createTabularHistory, loadTabularData, rowFromElement, rowName, saveTabularData, tabularReducer } from './tabularState.js'
import { getTabularLayout } from './tabularSizing.js'
import { findCandidateRow, rowFromContent } from './tabularRows.js'
import { invoke } from '@tauri-apps/api/core'
import { contentId, contentsInfo, contentTabProps, sameContent } from '../../../store/contentsInfo.js'
import { useTxtStore } from '../../../store/txtStore.js'
import { useToastStore } from '../../../store/toastStore.js'
import { useTabStore } from '../../../store/tabStore.js'
import './Tabular.css'

// Defer accessing localStorage until the guarded read/write operation.
const storage = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
}

export function PlotCell({ cell, label, onChange, onEndEdit, theme }) {
  const [editing, setEditing] = useState(false)
  const original = useRef(null)
  const buttonRef = useRef(null)
  const value = cell ?? { text: '' }

  function finish() {
    setEditing(false)
    onEndEdit()
  }

  function keyboard(event) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') {
      event.preventDefault()
      onChange(original.current)
      finish()
      requestAnimationFrame(() => buttonRef.current?.focus())
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      finish()
      requestAnimationFrame(() => buttonRef.current?.focus())
    }
  }

  return <td className="tabular__cell" data-editing={editing}>
    {editing ? <div className="tabular__cell-editor" onKeyDown={keyboard} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) finish() }}>
      <TabularTextArea autoFocus
        aria-label={`${label}の本文`} placeholder="入力…" value={value.text} onChange={event => onChange({ text: event.target.value })} />
      <div className="tabular__cell-tools">
        <TN_IconButton theme={theme} subtle variant="ghost" size="small" borderRadius="4px" style={{ width: 24, height: 24 }} aria-label="マスの編集を完了" title="編集を完了（Ctrl・⌘ + Enter）" onClick={finish} icon={<Check size={14} />} />
      </div>
    </div> : <div className="tabular__cell-body">
      {value.text && <span>{value.text}</span>}
      <button ref={buttonRef} className="tabular__cell-content" type="button" aria-label={`${label}を編集`} onClick={() => { original.current = { text: value.text }; setEditing(true) }} />
    </div>}
  </td>
}

function ColumnHeading({ column, index, dispatch, autoFocus, theme, width }) {
  return <th scope="col" className="tabular__column-heading">
    <div className="tabular__column-title">
      <input autoFocus={autoFocus} onFocus={event => { if (autoFocus) event.target.select() }} aria-label={`列 ${index + 1} の名前`} placeholder="列の名前" value={column.title} onChange={event => dispatch({ type: 'renameColumn', id: column.id, title: event.target.value, group: `column:${column.id}` })} onBlur={() => dispatch({ type: 'endEdit' })} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur() }} />
    </div>
    <span className="tabular__column-delete">
      <TN_IconButton theme={theme} size="small" style={{ width: 28, height: 28, padding: 2 }} aria-label={`${column.title || '無題の列'}列を削除`} title="列を削除（元に戻せます）" onClick={() => dispatch({ type: 'removeColumn', id: column.id })} icon={<Trash2 size={14} />} />
    </span>
    <TabularResizeHandle kind="column" value={width} label={`${column.title || `列 ${index + 1}`}の幅を変更`}
      onStart={() => dispatch({ type: 'endEdit' })} onEnd={() => dispatch({ type: 'endEdit' })}
      onChange={size => dispatch({ type: 'resizeColumn', id: column.id, size, group: `resize-column:${column.id}` })} />
  </th>
}

export default function Tabular({ theme = 'light', elements = [], contents = [], storageKey = TABULAR_STORAGE_KEY, hidden = false, empty = false }) {
  const [history, setHistory] = useState(() => createTabularHistory(loadTabularData(storage, elements, storageKey,
    empty ? emptyTabularData : undefined)))
  const historyRef = useRef(history)
  const [editingRowId, setEditingRowId] = useState(null)
  const [adding, setAdding] = useState(false)
  const addingRef = useRef(false)
  const mountedRef = useRef(true)
  const [newColumnId, setNewColumnId] = useState(null)
  const data = history.present
  const widths = getTabularLayout(data)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  function dispatch(action) {
    // One event can finish an edit and perform another action in the same batch.
    const previous = historyRef.current
    const next = tabularReducer(previous, action)
    if (next === previous) return
    historyRef.current = next
    setHistory(next)
    if (next.present !== previous.present) saveTabularData(storage, next.present, storageKey)
  }

  function addColumn() {
    const id = `column-${crypto.randomUUID()}`
    dispatch({ type: 'addColumn', id })
    setNewColumnId(id)
  }

  async function addRow(type, candidate) {
    if (addingRef.current) return
    if (candidate && findCandidateRow(historyRef.current.present.rows, candidate)) return
    const id = `row-${crypto.randomUUID()}`
    if (type === 'note') {
      dispatch({ type: 'addRow', row: { id, kind: 'note', name: 'Memo', summary: '' } })
      setEditingRowId(id)
      return
    }
    if (!candidate || (candidate.info?.content_type ?? candidate.element?.type) !== type) return
    addingRef.current = true
    setAdding(true)
    try {
      let row
      if (candidate.info) {
        const info = contentsInfo(candidate.info)
        const workspace = useTxtStore.getState().workspaces[contentId(info)]
        const content = workspace && !workspace.isLoading && !workspace.loadError ? workspace.content
          : await invoke('load_json', { contentsInfo: info })
        row = rowFromContent(info, content, id)
      } else {
        row = rowFromElement(candidate.element, id)
      }
      if (mountedRef.current && !findCandidateRow(historyRef.current.present.rows, candidate)) dispatch({ type: 'addRow', row })
    } catch (error) {
      if (mountedRef.current) useToastStore.getState().addToast(`コンテンツを読み込めませんでした: ${String(error)}`, 'error')
    } finally {
      addingRef.current = false
      if (mountedRef.current) setAdding(false)
    }
  }

  function openRowContent(row) {
    const source = row.element?.data.contentsInfo
    if (!source) return
    const info = contents.find(info => sameContent(info, source)) ?? source
    useTabStore.getState().addTab('work', info.name, contentTabProps(info))
  }

  return <section className="tabular" data-theme={theme} aria-label="プロットテーブル" hidden={hidden}>
    <div className="tabular__toolbar">
      <div className="tabular__toolbar-actions">
        <TabularRowMenu contents={contents} elements={elements} rows={data.rows} theme={theme} onAdd={addRow} ready={!adding} prominent />
        <TabularActionButton theme={theme} variant="secondary" icon={<Plus size={18} aria-hidden="true" />} onClick={addColumn}>列を追加</TabularActionButton>
      </div>
      <div className="tabular__history" role="group" aria-label="編集履歴">
        <TN_IconButton theme={theme} size="small" borderRadius="10px" aria-label="元に戻す" title="元に戻す" disabled={!history.past.length} onClick={() => dispatch({ type: 'undo' })} icon={<LeftArrow size={16} aria-hidden="true" />} />
        <TN_IconButton theme={theme} size="small" borderRadius="10px" aria-label="やり直す" title="やり直す" disabled={!history.future.length} onClick={() => dispatch({ type: 'redo' })} icon={<RightArrow size={16} aria-hidden="true" />} />
      </div>
    </div>
    <div className="tabular__viewport">
    <div className="tabular__scroll" tabIndex={0} role="region" aria-label="プロット表（縦・横にスクロールできます）">
      <table className="tabular__table" style={{ width: widths.total }}>
        <caption className="tabular__sr-only">場面ごとに、プロット・人物・世界観を並べる表。マスをクリックして編集できます。</caption>
        <colgroup><col style={{ width: widths.heading }} />{data.columns.map((column, index) => <col key={column.id} style={{ width: widths.columns[index] }} />)}<col style={{ width: widths.trailing }} /></colgroup>
        <thead><tr>
          <th className="tabular__corner" scope="col"><span className="tabular__summary">{data.rows.length} 行<span aria-hidden="true">·</span>{data.columns.length} 列</span>
            <TabularResizeHandle kind="heading" value={widths.heading} label="行見出しの幅を変更"
              onStart={() => dispatch({ type: 'endEdit' })} onEnd={() => dispatch({ type: 'endEdit' })}
              onChange={size => dispatch({ type: 'resizeHeading', size, group: 'resize-heading' })} />
          </th>
          {data.columns.map((column, index) => <ColumnHeading key={column.id} column={column} index={index} dispatch={dispatch} theme={theme} width={widths.columns[index]} autoFocus={column.id === newColumnId} />)}
          <th className="tabular__add-heading" scope="col"><TN_IconButton theme={theme} subtle variant="ghost" size="small" borderRadius="4px" style={{ width: 26, height: 26 }} aria-label="末尾に列を追加" title="列を追加" onClick={addColumn} icon={<Plus size={16} />} /></th>
        </tr></thead>
        <tbody>
          {data.rows.map((row, index) => <tr key={row.id} className="tabular__data-row" style={{ height: widths.rows[index], '--tabular-row-height': `${widths.rows[index]}px` }}>
            <TabularRowHeading row={row} theme={theme} editing={editingRowId === row.id}
              height={widths.rows[index]} onResizeStart={() => dispatch({ type: 'endEdit' })} onResizeEnd={() => dispatch({ type: 'endEdit' })}
              onResize={size => dispatch({ type: 'resizeRow', id: row.id, size, group: `resize-row:${row.id}` })}
              onEdit={() => setEditingRowId(row.id)} onCancel={() => setEditingRowId(null)}
              onSave={updated => { dispatch({ type: 'updateRow', row: updated }); setEditingRowId(null) }}
              onRename={name => dispatch({ type: 'updateRow', row: { ...row, name }, group: `row:${row.id}` })}
              onEndEdit={() => { dispatch({ type: 'endEdit' }); setEditingRowId(null) }}
              onRemove={() => dispatch({ type: 'removeRow', id: row.id })} onOpen={() => openRowContent(row)} />
            {data.columns.map(column => <PlotCell key={column.id} theme={theme} cell={data.cells[row.id]?.[column.id]} label={`${rowName(row)} / ${column.title || '無題の列'}`} onChange={patch => dispatch({ type: 'updateCell', rowId: row.id, columnId: column.id, patch, group: `cell:${row.id}:${column.id}` })} onEndEdit={() => dispatch({ type: 'endEdit' })} />)}
            <td className="tabular__trailing-cell" aria-hidden="true" />
          </tr>)}
          <tr className="tabular__add-row">
            <td className="tabular__add-row-heading"><div><TabularRowMenu contents={contents} elements={elements} rows={data.rows} theme={theme} onAdd={addRow} ready={!adding} /></div></td>
            {data.columns.map(column => <td key={column.id} aria-hidden="true" />)}
            <td aria-hidden="true" />
          </tr>
        </tbody>
      </table>
    </div>
    </div>
  </section>
}
