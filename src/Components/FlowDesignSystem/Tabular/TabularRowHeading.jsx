import { useState } from 'react'
import { Check, Memo, Trash2, X } from '../../../assets/IconList.js'
import TN_IconButton from '../../TNDesignSystem/TN_IconButton.jsx'
import TN_TextField from '../../TNDesignSystem/TN_TextField.jsx'
import TabularElement from './TabularElement.jsx'
import TabularTextArea from './TabularTextArea.jsx'
import TabularResizeHandle from './TabularResizeHandle.jsx'
import { elementTypes, rowName } from './tabularState.js'

export function TabularRowEditor({ row, theme, onSave, onCancel }) {
  const [name, setName] = useState(rowName(row))
  const [summary, setSummary] = useState(row.kind === 'element' ? row.element.data.summary ?? '' : row.summary)
  function submit(event) {
    event.preventDefault()
    if (!name.trim()) return
    onSave(row.kind === 'element'
      ? { ...row, element: { ...row.element, data: { ...row.element.data, name: name.trim(), summary } } }
      : { ...row, name: name.trim(), summary })
  }
  return <form className="tabular__row-editor" onSubmit={submit} onKeyDown={event => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel() }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit(event)
  }}>
    <TN_TextField theme={theme} aria-label="行の名前" value={name} onChange={event => setName(event.target.value)}
      placeholder="行の名前" autoFocus onFocus={event => event.target.select()} showClearButton={false} required borderRadius="12px" />
    <TabularTextArea aria-label="行の説明・設定" value={summary} onChange={event => setSummary(event.target.value)} placeholder="この行で扱う情報" />
    <div className="tabular__row-editor-actions">
      <TN_IconButton theme={theme} size="small" borderRadius="4px" subtle variant="ghost" style={{ width: 24, height: 24 }} icon={<X size={14} />} aria-label="行の編集をキャンセル" onClick={onCancel} />
      <TN_IconButton theme={theme} size="small" borderRadius="4px" subtle variant="ghost" style={{ width: 24, height: 24 }} icon={<Check size={14} />} aria-label="行の情報を保存" type="submit" disabled={!name.trim()} />
    </div>
  </form>
}

export default function TabularRowHeading({ row, theme, editing, onEdit, onSave, onCancel, onRename, onEndEdit, onRemove, onOpen, height, onResize, onResizeStart, onResizeEnd }) {
  const linked = !!row.element?.data.contentsInfo
  const isMemo = row.kind === 'note'
  const editingHere = editing && !linked && !isMemo
  return <th className="tabular__row-heading" scope="row">
    <div className="tabular__row-frame">
    {isMemo ? <div className="tabular__row-title">
      <span className="tabular__row-visual" aria-hidden="true"><Memo size={16} /></span>
      <input autoFocus={editing} aria-label="行の名前" placeholder="行の名前" value={row.name}
        onFocus={event => { if (editing) event.target.select() }}
        onChange={event => onRename(event.target.value)} onBlur={onEndEdit}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.currentTarget.blur() }} />
    </div> : editingHere ? <TabularRowEditor key={row.id} row={row} theme={theme} onSave={onSave} onCancel={onCancel} /> :
      <button className="tabular__row-identity" type="button"
        title={linked ? 'ダブルクリックで編集ファイルを開く' : elementTypes[row.element.type]}
        aria-label={linked ? `${rowName(row) || '無題の行'}の編集ファイルを開く` : `${rowName(row) || '無題の行'}の行情報を編集`}
        onClick={linked ? undefined : onEdit}
        onDoubleClick={linked ? onOpen : undefined}
        onKeyDown={event => {
          if (linked && !event.nativeEvent.isComposing && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            onOpen()
          }
        }}>
        <span className="tabular__row-label">
          <span className={`tabular__row-visual tabular__row-visual--${row.kind}`}>
            <TabularElement element={row.element} />
          </span>
          <strong>{rowName(row) || '無題の行'}</strong>
        </span>
        <span className="tabular__row-summary">{row.element.data.summary}</span>
      </button>}
    </div>
    {!editingHere && <div className="tabular__row-actions">
        <TN_IconButton theme={theme} size="small" style={{ width: 28, height: 28, padding: 2 }} icon={<Trash2 size={14} />}
          aria-label={`${rowName(row) || '無題の行'}の行を削除`} title="行を削除（元に戻せます）" onClick={onRemove} />
      </div>}
    <TabularResizeHandle kind="row" value={height} label={`${rowName(row) || '無題の行'}の高さを変更`}
      onChange={onResize} onStart={onResizeStart} onEnd={onResizeEnd} />
  </th>
}
