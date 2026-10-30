import { contentsInfo, sameContent } from '../../../store/contentsInfo.js'
import { photoPaths } from '../../../utils/imagePaths.js'

export const contentTypeForNode = type => type === 'document' ? 'txt' : type

export function findContentNode(nodes, info) {
  return nodes.find(node => sameContent(node.data.contentsInfo, info))
}

export function graphContentData(value, content) {
  const info = contentsInfo(value)
  if (info.content_type === 'txt') {
    if (typeof content !== 'string') throw new Error('本文を読み込めませんでした。')
    return { name: info.name, summary: '', content, contentsInfo: info }
  }
  const object = typeof content === 'string' ? JSON.parse(content) : content
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error('コンテンツを読み込めませんでした。')
  return {
    name: info.name,
    summary: typeof object.summary === 'string' ? object.summary : '',
    imagePaths: photoPaths(object.imagePaths),
    properties: object.properties ?? {},
    contentsInfo: info,
  }
}
