// Fingerprints for removing the original demo cards from already saved graphs.
// New graphs no longer seed these nodes or their images.
const legacySamples = {
  document: { name: '物語のノート', content: '旅のはじまり。古い鍵を手がかりに、街に隠された秘密を探していく。' },
  memo: { name: 'アイデアメモ' },
  character: { name: 'Kotone Fujita', summary: 'ことねちゃんのキャラクターノード。2枚の写真がゆっくり切り替わります。' },
  entity: { name: '古い鍵', summary: '主人公が受け継いだ、物語の秘密につながる鍵。' },
  world: { name: 'はじまりの街', summary: '静かな森に囲まれた、旅の出発点となる街。' },
}

function isUneditedSample(node) {
  const sample = legacySamples[node.id]
  if (!sample || node.type !== node.id || node.data.contentsInfo) return false
  if (!Object.entries(sample).every(([key, value]) => node.data[key] === value)) return false
  // A memo with user-written text is no longer disposable sample content.
  if (node.type === 'memo' && ![undefined, '', '<p></p>'].includes(node.data.content)) return false
  return true
}

export function removeLegacyGraphSamples({ nodes, edges }) {
  const removed = new Set(nodes.filter(isUneditedSample).map(node => node.id))
  return {
    nodes: nodes.filter(node => !removed.has(node.id)),
    edges: edges.filter(edge => !removed.has(edge.source) && !removed.has(edge.target)),
  }
}
