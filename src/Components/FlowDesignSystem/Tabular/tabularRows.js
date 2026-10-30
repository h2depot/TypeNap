import { contentId, sameContent } from '../../../store/contentsInfo.js'
import { graphContentData } from '../GraphMap/graphContent.js'
import { rowFromElement } from './tabularState.js'

export function tabularRowCandidates(type, contents, elements) {
  const candidates = new Map()
  for (const info of contents.filter(info => info.content_type === type)) {
    candidates.set(`content:${contentId(info)}`, { id: `content:${contentId(info)}`, name: info.name, info })
  }
  // Retain access to older graph-only elements, without listing linked content twice.
  for (const element of elements.filter(element => element.type === type)) {
    const info = element.data.contentsInfo
    const id = info ? `content:${contentId(info)}` : `element:${element.id}`
    if (!candidates.has(id)) candidates.set(id, { id, name: element.data.name, info, element })
  }
  return [...candidates.values()]
}

export function findCandidateRow(rows, candidate) {
  return rows.find(row => row.kind === 'element' && (
    (candidate.info && sameContent(row.element.data.contentsInfo, candidate.info))
    || (candidate.element && row.element.id === candidate.element.id)
  ))
}

export function rowFromContent(info, content, id) {
  return rowFromElement({ id: `content-${contentId(info)}`, type: info.content_type,
    data: graphContentData(info, content) }, id)
}
