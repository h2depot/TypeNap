import { useId, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './GraphMap.css'
import StoryNode from './Nodes/StoryNode.jsx'
import GraphEdge from './GraphEdge.jsx'
import usePinchZoom from './usePinchZoom.js'
import GraphMapToolbar, { graphNodeOptions } from './GraphMapToolbar.jsx'
import { invoke } from '@tauri-apps/api/core'
import { contentId, contentsInfo, contentTabProps } from '../../../store/contentsInfo.js'
import { useTabStore } from '../../../store/tabStore.js'
import { useTxtStore } from '../../../store/txtStore.js'
import { useToastStore } from '../../../store/toastStore.js'
import { photoSource } from '../../../assets/photoImages.js'
import { contentTypeForNode, findContentNode, graphContentData } from './graphContent.js'

const nodeTypes = { character: StoryNode, entity: StoryNode, world: StoryNode, memo: StoryNode, document: StoryNode }
const edgeTypes = { relationship: GraphEdge }

// Scroll and pinch are independent React Flow options and can both be enabled.
// Windows Tauri also needs zoomHotkeysEnabled in tauri.conf.json so WebView2
// permits pinch input. usePinchZoom boosts Ctrl+wheel; React Flow handles touch.
const viewportOptions = {
  minZoom: 0.3,
  maxZoom: 2,
  zoomOnScroll: true,
  zoomOnPinch: true,
  zoomOnDoubleClick: false,
  panOnScroll: false,
  preventScrolling: true,
}

const emptyEdges = []

export default function GraphMap({ theme = 'light', nodes, onNodesChange, contents = [], active = true, hidden = false,
  edges = emptyEdges, onEdgesChange, onConnect, onBeforeDelete, canUndo, canRedo, onUndo, onRedo, onEndEdit }) {
  const flowId = useId()
  const [instance, setInstance] = useState(null)
  const containerRef = usePinchZoom(instance, viewportOptions)
  const workspaces = useTxtStore(state => state.workspaces)
  const addingRef = useRef(false)
  const [adding, setAdding] = useState(false)
  // Linked cards also reflect edits in an open content editor, including drafts.
  const displayedNodes = nodes.map(node => {
    const source = node.data.contentsInfo
    const info = contents.find(info => contentId(info) === contentId(source)) ?? source
    const workspace = source && workspaces[contentId(source)]
    let data = { ...node.data, ...(info ? { name: info.name, contentsInfo: info } : {}) }
    if (workspace && !workspace.isLoading && !workspace.loadError) {
      try { data = { ...data, ...graphContentData(info, workspace.content) } }
      catch { /* Keep the last valid card while a JSON draft is incomplete. */ }
    }
    return { ...node, data: { ...data, imagePaths: source ? data.imagePaths?.map(photoSource) : data.imagePaths, theme } }
  })
  const locateNode = (node) => {
    if (!instance) return
    onNodesChange(nodes.map(current => ({ id: current.id, type: 'select', selected: current.id === node.id })))
    void instance.fitView({ nodes: [{ id: node.id }], padding: 0.8, maxZoom: 1, duration: 350 })
  }

  const openNodeContent = (event, node) => {
    if (!active || hidden || node.type === 'memo' || !node.data.contentsInfo) return
    if (event.target.closest('button, input, textarea, [contenteditable="true"], .react-flow__handle')) return
    const source = node.data.contentsInfo
    const info = contents.find(info => contentId(info) === contentId(source)) ?? source
    event.stopPropagation()
    useTabStore.getState().addTab('work', info.name, contentTabProps(info))
  }

  const addNode = async (type, source) => {
    if (!instance || addingRef.current) return
    const option = graphNodeOptions.find(option => option.type === type)
    if (!option) return
    let data = { name: '新しいメモ', summary: '' }
    if (type !== 'memo') {
      if (!source || source.content_type !== contentTypeForNode(type)) return
      const existing = findContentNode(nodes, source)
      if (existing) { locateNode(existing); return }
      addingRef.current = true
      setAdding(true)
      try {
        const info = contentsInfo(source)
        const workspace = useTxtStore.getState().workspaces[contentId(info)]
        const content = workspace && !workspace.isLoading && !workspace.loadError ? workspace.content
          : await invoke(info.content_type === 'txt' ? 'load_txt' : 'load_json', { contentsInfo: info })
        data = graphContentData(info, content)
      } catch (error) {
        useToastStore.getState().addToast(`コンテンツを読み込めませんでした: ${String(error)}`, 'error')
        return
      } finally {
        addingRef.current = false
        setAdding(false)
      }
    }
    if (!containerRef.current) return
    const bounds = containerRef.current.getBoundingClientRect()
    const center = instance.screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
    // Stagger repeated additions so the new cards don't completely overlap.
    const offset = (nodes.filter(node => node.type === type).length % 5) * 28
    const node = {
      id: `graph-${type}-${crypto.randomUUID()}`,
      type,
      position: { x: center.x - option.width / 2 + offset, y: center.y - 80 + offset },
      selected: true,
      data,
    }
    onNodesChange([
      ...nodes.filter(current => current.selected).map(current => ({ id: current.id, type: 'select', selected: false })),
      { type: 'add', item: node },
    ])
  }

  return (
    <section ref={containerRef} className="graph-map" aria-label="ノードグラフ" hidden={hidden}
      onBlurCapture={event => {
        if (event.target.matches('input, textarea, [contenteditable="true"]')) onEndEdit?.()
      }}>
      {active && !hidden && <GraphMapToolbar theme={theme} nodes={displayedNodes} contents={contents}
        onLocate={locateNode} onAdd={addNode} ready={!!instance && !adding}
        canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} />}
      <ReactFlow
        {...viewportOptions}
        id={flowId}
        onInit={setInstance}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodes={displayedNodes}
        edges={edges.map((edge) => ({ ...edge, data: { ...edge.data, theme } }))}
        deleteKeyCode={active ? ['Backspace', 'Delete'] : null}
        onNodesChange={onNodesChange}
        onNodeDoubleClick={openNodeContent}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onBeforeDelete={onBeforeDelete}
        defaultEdgeOptions={{ type: 'relationship', interactionWidth: 24, style: { stroke: 'var(--graph-edge-color)', strokeWidth: 8 } }}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        colorMode={theme}
      >
        <Background id={`${flowId}-dots`} variant={BackgroundVariant.Dots} color="var(--flow-border)" gap={24} size={1.5} />
        <Controls />
        <MiniMap pannable zoomable nodeColor="var(--theme-green)" />
      </ReactFlow>
    </section>
  )
}
