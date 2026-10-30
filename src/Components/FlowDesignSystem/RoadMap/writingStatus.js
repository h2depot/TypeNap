export const writingStatuses = [
  { value: 'not_started', label: '未着手' },
  { value: 'writing', label: '執筆中' },
  { value: 'draft_complete', label: '初稿完了' },
  { value: 'revising', label: '改稿中' },
]

// Normalize at the display boundary; opening an old document must not rewrite it.
export const normalizeWritingStatus = value => writingStatuses.some(status => status.value === value) ? value : 'not_started'
