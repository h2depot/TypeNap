import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { contentId, contentsInfo } from '../../../store/contentsInfo.js'
import { useTxtStore } from '../../../store/txtStore.js'
import { useToastStore } from '../../../store/toastStore.js'
import { photoSource } from '../../../assets/photoImages.js'
import { contentTypeForNode, graphContentData } from '../GraphMap/graphContent.js'
import { roadMapStampWidth } from './roadMapNodeSizes.js'
import { changeRoadMapStamps, stampTypes } from './roadMapStamps.js'

export default function useRoadMapStamps({ theme, contents, interactive, instance, containerRef, width }) {
  const [stamps, setStamps] = useState([])
  const [adding, setAdding] = useState(false)
  const busy = useRef(false)
  const live = useRef(null)
  const mounted = useRef(false)
  live.current = { interactive, instance, width }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const workspaces = useTxtStore(state => state.workspaces)
  const onNodesChange = useCallback(changes => setStamps(nodes => changeRoadMapStamps(nodes, changes)), [])
  const clearSelection = useCallback(() => setStamps(nodes => nodes.map(node => node.selected ? { ...node, selected: false } : node)), [])

  const addStamp = async (type, source) => {
    if (!interactive || !instance || busy.current || !stampTypes.includes(type)) return
    if (type !== 'memo' && (!source || source.content_type !== contentTypeForNode(type))) return
    busy.current = true
    setAdding(true)
    try {
      let data = { name: '新しいメモ', content: '' }
      if (type !== 'memo') {
        const info = contentsInfo(source)
        const workspace = useTxtStore.getState().workspaces[contentId(info)]
        const content = workspace && !workspace.isLoading && !workspace.loadError ? workspace.content
          : await invoke(info.content_type === 'txt' ? 'load_txt' : 'load_json', { contentsInfo: info })
        data = graphContentData(info, content)
      }
      if (!mounted.current || !live.current.interactive || !containerRef.current) return
      const bounds = containerRef.current.getBoundingClientRect()
      const center = live.current.instance.screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
      const nodeWidth = roadMapStampWidth(type)
      setStamps(nodes => {
        const offset = (nodes.length % 5) * 24
        return [...nodes.map(node => ({ ...node, selected: false })), {
          id: `stamp-${crypto.randomUUID()}`, type, selected: true, data,
          position: { x: Math.max(0, Math.min(live.current.width - nodeWidth, center.x - nodeWidth / 2 + offset)), y: Math.max(0, center.y - 80 + offset) },
        }]
      })
    } catch (error) {
      if (mounted.current) useToastStore.getState().addToast(`コンテンツを読み込めませんでした: ${String(error)}`, 'error')
    } finally {
      busy.current = false
      if (mounted.current) setAdding(false)
    }
  }

  const nodes = stamps.map(node => {
    const source = node.data.contentsInfo
    const info = source && (contents.find(info => contentId(info) === contentId(source)) ?? source)
    const workspace = source && workspaces[contentId(source)]
    let data = { ...node.data, ...(info ? { name: info.name, contentsInfo: info } : {}) }
    if (workspace && !workspace.isLoading && !workspace.loadError) {
      try { data = { ...data, ...graphContentData(info, workspace.content) } }
      catch { /* Keep the last readable card while a JSON draft is incomplete. */ }
    }
    return { ...node, className: 'roadmap-stamp', zIndex: -1,
      draggable: interactive, selectable: interactive,
      extent: [[0, 0], [Math.max(width, roadMapStampWidth(node.type)), Infinity]],
      data: { ...data, imagePaths: source ? data.imagePaths?.map(photoSource) : data.imagePaths, theme, interactive },
    }
  })
  return { nodes, onNodesChange, clearSelection, addStamp, adding }
}
