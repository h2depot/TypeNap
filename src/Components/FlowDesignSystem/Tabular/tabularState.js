import { clampTabularSize, TABULAR_SIZES, validTabularSize } from './tabularSizing.js'

export const TABULAR_STORAGE_KEY = 'typenap.tabular.v1'
export const emptyTabularData = { columns: [{ id: 'column-start', title: '新しい項目' }], rows: [], cells: {} }
export const elementTypes = { character: '人物', world: '世界観', entity: 'アイテム' }
export const rowName = row => row.kind === 'element' ? row.element.data.name : row.name

export function rowFromElement(element, id) {
  // Keep the complete element, including its identity and custom data, in the row.
  // Graph layout and transient selection state do not belong to a table row.
  return { id, kind: 'element', element: structuredClone({ id: element.id, type: element.type, data: element.data }) }
}

export function createTabularData(elements = []) {
  const rows = [
    { id: 'plot', kind: 'note', name: 'プロット', summary: '物語全体の流れ' },
    { id: 'setup', kind: 'note', name: '伏線', summary: 'あとにつながる小さな手がかり' },
    { id: 'payoff', kind: 'note', name: '伏線回収', summary: '手がかりが意味を持つ場面' },
    ...elements.filter(element => Object.hasOwn(elementTypes, element.type))
      .map(element => rowFromElement(element, `row-${element.id}`)),
  ]
  return {
    columns: [{ id: 'beginning', title: 'はじまり' }, { id: 'encounter', title: '出会い' }, { id: 'departure', title: '旅立ち' }],
    rows,
    cells: {
      plot: {
        beginning: { text: '穏やかな街で暮らす主人公。\nある日、古い鍵を受け継ぐ。' },
        encounter: { text: '鍵に刻まれた印を手がかりに、街の秘密を知る人物と出会う。' },
        departure: { text: '鍵が開く扉を探して、まだ見ぬ世界へ踏み出す。' },
      },
      setup: { beginning: { text: '鍵に刻まれた、不思議な印。' } },
      payoff: { departure: { text: '街の門にも、鍵と同じ印があることに気づく。' } },
    },
  }
}

function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function identified(items) {
  return Array.isArray(items) && items.every(item => record(item) && typeof item.id === 'string' && item.id.length > 0)
    && new Set(items.map(item => item.id)).size === items.length
}

export function validTabularData(data) {
  if (!record(data) || !identified(data.columns) || !identified(data.rows) || !record(data.cells)) return false
  if (!validTabularSize(data.headingWidth, 'heading')
    || !data.columns.every(column => typeof column.title === 'string' && validTabularSize(column.width, 'column'))
    || !data.rows.every(row => validTabularSize(row.height, 'row'))) return false
  if (!data.rows.every(row => row.kind === 'note'
    ? typeof row.name === 'string' && typeof row.summary === 'string'
    : row.kind === 'element' && record(row.element) && typeof row.element.id === 'string'
      && Object.hasOwn(elementTypes, row.element.type) && record(row.element.data)
      && typeof row.element.data.name === 'string'
      && (row.element.data.summary === undefined || typeof row.element.data.summary === 'string')
      && (row.element.data.imagePaths === undefined || (Array.isArray(row.element.data.imagePaths) && row.element.data.imagePaths.every(path => typeof path === 'string'))))) return false
  const rows = new Set(data.rows.map(row => row.id))
  const columns = new Set(data.columns.map(column => column.id))
  return Object.entries(data.cells).every(([rowId, cells]) => rows.has(rowId) && record(cells)
    && Object.entries(cells).every(([columnId, cell]) => columns.has(columnId) && record(cell)
      && typeof cell.text === 'string' && Object.keys(cell).length === 1))
}

function textOnlyTabularData(data) {
  if (!record(data) || !record(data.cells)) return data
  return { ...data, cells: Object.fromEntries(Object.entries(data.cells).map(([rowId, cells]) => [rowId,
    record(cells) ? Object.fromEntries(Object.entries(cells).map(([columnId, cell]) => [columnId,
      record(cell) ? { text: cell.text } : cell])) : cells])) }
}

export function loadTabularData(storage, elements = [], storageKey = TABULAR_STORAGE_KEY, initialData) {
  try {
    const saved = JSON.parse(storage.getItem(storageKey))
    if (saved?.schemaVersion === 2 && validTabularData(saved.data)) return saved.data
    if (saved?.schemaVersion === 1) {
      const data = textOnlyTabularData(saved.data)
      if (validTabularData(data)) {
        saveTabularData(storage, data, storageKey)
        return data
      }
    }
  } catch { /* The table remains usable when local storage is unavailable. */ }
  return initialData ? structuredClone(initialData) : createTabularData(elements)
}

export function saveTabularData(storage, data, storageKey = TABULAR_STORAGE_KEY) {
  try {
    const clean = textOnlyTabularData(data)
    if (!validTabularData(clean)) return false
    storage.setItem(storageKey, JSON.stringify({ schemaVersion: 2, data: clean }))
    return true
  } catch { return false }
}

function updateTable(data, action) {
  switch (action.type) {
    case 'resizeColumn': {
      const column = data.columns.find(column => column.id === action.id)
      if (!column || !Number.isFinite(action.size)) return data
      const width = clampTabularSize(action.size, 'column')
      if (width === (column.width ?? TABULAR_SIZES.column.default)) return data
      return { ...data, columns: data.columns.map(column => column.id === action.id ? { ...column, width } : column) }
    }
    case 'resizeRow': {
      const row = data.rows.find(row => row.id === action.id)
      if (!row || !Number.isFinite(action.size)) return data
      const height = clampTabularSize(action.size, 'row')
      if (height === (row.height ?? TABULAR_SIZES.row.default)) return data
      return { ...data, rows: data.rows.map(row => row.id === action.id ? { ...row, height } : row) }
    }
    case 'resizeHeading': {
      if (!Number.isFinite(action.size)) return data
      const headingWidth = clampTabularSize(action.size, 'heading')
      return headingWidth === (data.headingWidth ?? TABULAR_SIZES.heading.default) ? data : { ...data, headingWidth }
    }
    case 'addColumn':
      return { ...data, columns: [...data.columns, { id: action.id, title: '新しい項目' }] }
    case 'renameColumn': {
      if (!data.columns.some(column => column.id === action.id && column.title !== action.title)) return data
      return { ...data, columns: data.columns.map(column => column.id === action.id ? { ...column, title: action.title } : column) }
    }
    case 'removeColumn': {
      if (!data.columns.some(column => column.id === action.id)) return data
      return {
        ...data, columns: data.columns.filter(column => column.id !== action.id),
        cells: Object.fromEntries(Object.entries(data.cells).map(([rowId, cells]) => [rowId, Object.fromEntries(Object.entries(cells).filter(([columnId]) => columnId !== action.id))])),
      }
    }
    case 'addRow':
      return { ...data, rows: [...data.rows, action.row] }
    case 'updateRow':
      return { ...data, rows: data.rows.map(row => row.id === action.row.id ? action.row : row) }
    case 'removeRow':
      return { ...data, rows: data.rows.filter(row => row.id !== action.id), cells: Object.fromEntries(Object.entries(data.cells).filter(([rowId]) => rowId !== action.id)) }
    case 'updateCell': {
      if (!data.rows.some(row => row.id === action.rowId) || !data.columns.some(column => column.id === action.columnId)) return data
      const previous = data.cells[action.rowId]?.[action.columnId] ?? { text: '' }
      if (typeof action.patch?.text !== 'string' || action.patch.text === previous.text) return data
      const cell = { text: action.patch.text }
      return { ...data, cells: { ...data.cells, [action.rowId]: { ...data.cells[action.rowId], [action.columnId]: cell } } }
    }
    default:
      return data
  }
}

export function createTabularHistory(data) {
  return { present: data, past: [], future: [], group: null }
}

export function tabularReducer(state, action) {
  if (action.type === 'undo') return state.past.length ? {
    present: state.past.at(-1), past: state.past.slice(0, -1), future: [state.present, ...state.future], group: null,
  } : state
  if (action.type === 'redo') return state.future.length ? {
    present: state.future[0], past: [...state.past, state.present], future: state.future.slice(1), group: null,
  } : state
  if (action.type === 'endEdit') return state.group ? { ...state, group: null } : state
  const present = updateTable(state.present, action)
  if (present === state.present) return state
  const group = action.group ?? null
  return {
    present, group, future: [],
    past: group && state.group === group ? state.past : [...state.past, state.present].slice(-40),
  }
}
