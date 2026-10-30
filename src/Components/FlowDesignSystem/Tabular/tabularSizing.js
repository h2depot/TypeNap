export const TABULAR_SIZES = {
  column: { min: 120, max: 1600, default: 240 },
  row: { min: 64, max: 1200, default: 96 },
  heading: { min: 160, max: 640, default: 224 },
}

export function clampTabularSize(value, kind) {
  const limits = TABULAR_SIZES[kind]
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)))
}

export function validTabularSize(value, kind) {
  const limits = TABULAR_SIZES[kind]
  return value === undefined || (Number.isFinite(value) && value >= limits.min && value <= limits.max)
}

// Only saved dimensions affect layout; typing and viewport changes never resize it.
export function getTabularLayout(data) {
  const heading = data.headingWidth ?? TABULAR_SIZES.heading.default
  const columns = data.columns.map(column => column.width ?? TABULAR_SIZES.column.default)
  const rows = data.rows.map(row => row.height ?? TABULAR_SIZES.row.default)
  const trailing = 52
  return { heading, columns, rows, trailing, total: heading + trailing + columns.reduce((sum, width) => sum + width, 0) }
}
