import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { PanOnScrollMode, ReactFlow, ViewportPortal } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { RoadMapInsertNode, RoadMapStoryNode } from './RoadMapNodes.jsx'
import useRoadMap from './useRoadMap.js'
import RoadMapTimeline from './RoadMapTimeline.jsx'
import RoadMapViewSwitch from './RoadMapViewSwitch.jsx'
import RoadMapListView from './RoadMapListView.jsx'
import RoadMapTextDialog from './RoadMapTextDialog.jsx'
import RoadMapTemplateDialog from './RoadMapTemplateDialog.jsx'
import RoadMapStampMenu from './RoadMapStampMenu.jsx'
import RoadMapNode from './Nodes/RoadMapNode.jsx'
import useRoadMapStamps from './useRoadMapStamps.js'
import { stampScrollBounds } from './roadMapStamps.js'
import { backgroundContentColor } from '../../../Constants/colors.js'
import { clampRoadMapViewport } from './roadMapLayout.js'
import TN_Button from '../../TNDesignSystem/TN_Button.jsx'
import TN_TextField from '../../TNDesignSystem/TN_TextField.jsx'
import { BluePrint, Plus, Search } from '../../../assets/original_icons/index.js'
import '../GraphMap/GraphMap.css'
import './RoadMap.css'

const nodeTypes = { roadmapStory: RoadMapStoryNode, character: RoadMapNode, entity: RoadMapNode, world: RoadMapNode, document: RoadMapNode, memo: RoadMapNode }
const viewportOptions = {
  minZoom: 1, maxZoom: 1,
  defaultViewport: { x: 0, y: 0, zoom: 1 },
  zoomOnScroll: false, zoomOnPinch: false, zoomOnDoubleClick: false,
  zoomActivationKeyCode: null, panActivationKeyCode: null,
  panOnScroll: true, panOnScrollMode: PanOnScrollMode.Vertical,
  panOnDrag: false, preventScrolling: true,
  autoPanOnNodeDrag: false, autoPanOnConnect: false,
  autoPanOnSelection: false, autoPanOnNodeFocus: false,
}

export default function RoadMap({ theme = 'light', active = true, hidden = false, contents = [] }) {
  const flowId = useId()
  const [instance, setInstance] = useState(null)
  const [viewMode, setViewMode] = useState('roadmap')
  const [searchQuery, setSearchQuery] = useState('')
  const [textDialog, setTextDialog] = useState(null)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [backgroundColor, setBackgroundColor] = useState('')
  const dialogOpen = !!textDialog || templateDialogOpen
  const containerRef = useRef(null)
  const interactive = active && !hidden && viewMode === 'roadmap' && !dialogOpen
  const roadmap = useRoadMap(theme, interactive)
  const { resize } = roadmap
  const stamps = useRoadMapStamps({ theme, contents, interactive, instance, containerRef, width: roadmap.scrollBounds.translateExtent[1][0] })
  const scrollBounds = useMemo(() => stampScrollBounds(roadmap.scrollBounds, stamps.nodes), [roadmap.scrollBounds, stamps.nodes])
  const onNodesChange = changes => {
    roadmap.onNodesChange(changes)
    stamps.onNodesChange(changes)
  }

  useEffect(() => {
    const container = containerRef.current
    const observer = new ResizeObserver(entries => {
      const bounds = entries[0]?.contentRect
      if (bounds?.width > 0 && bounds.height > 0) resize(Math.ceil(bounds.width), bounds.height)
    })
    const blockPinch = event => {
      if (!event.ctrlKey) return
      event.preventDefault()
      event.stopPropagation()
    }
    observer.observe(container)
    container.addEventListener('wheel', blockPinch, { passive: false, capture: true })
    return () => {
      observer.disconnect()
      container.removeEventListener('wheel', blockPinch, { capture: true })
    }
  }, [containerRef, resize])

  useEffect(() => {
    if (!instance) return
    const current = instance.getViewport()
    const next = clampRoadMapViewport(current, scrollBounds)
    if (current.x !== next.x || current.y !== next.y || current.zoom !== next.zoom) void instance.setViewport(next)
  }, [instance, scrollBounds])

  const { selectStory, onNodeDragStop } = roadmap
  const openTextAction = (mode, story) => setTextDialog({ mode, id: story.id, name: story.data.name })
  const requestNodeDeletion = useCallback(({ nodes }) => {
    if (active && !hidden && viewMode === 'roadmap' && !dialogOpen) {
      const story = nodes.find(node => node.type === 'roadmapStory')
      if (story) setTextDialog({ mode: 'delete', id: story.id, name: story.data.name })
      stamps.onNodesChange(nodes.filter(node => node.type !== 'roadmapStory').map(node => ({ id: node.id, type: 'remove' })))
    }
    // Story deletion waits for confirmation; stamps follow GraphMap's direct removal.
    return false
  }, [active, hidden, viewMode, dialogOpen, stamps.onNodesChange])
  const confirmTextAction = dialog => {
    if (dialog.mode === 'create') {
      roadmap.addStory(roadmap.orderedStories.at(-1)?.id ?? null, { name: dialog.name, content: '' })
      setSearchQuery('')
    } else if (dialog.mode === 'rename') roadmap.updateStory(dialog.id, { name: dialog.name })
    else if (dialog.mode === 'delete') roadmap.onNodesChange([{ id: dialog.id, type: 'remove' }])
    setTextDialog(null)
  }
  const { clearSelection: clearStampSelection } = stamps
  const selectNode = useCallback((_event, node) => {
    selectStory(node.type === 'roadmapStory' ? node.id : null)
    if (node.type === 'roadmapStory') clearStampSelection()
  }, [selectStory, clearStampSelection])
  const clearSelection = useCallback(() => { selectStory(null); clearStampSelection() }, [selectStory, clearStampSelection])
  const stopDrag = useCallback((event, node) => {
    if (node.type !== 'roadmapStory') return
    const bounds = containerRef.current?.getBoundingClientRect()
    const pointer = event.changedTouches?.[0] ?? event
    const outside = bounds && Number.isFinite(pointer.clientX) && (
      pointer.clientX < bounds.left || pointer.clientX > bounds.right ||
      pointer.clientY < bounds.top || pointer.clientY > bounds.bottom
    )
    onNodeDragStop(event, node, outside)
  }, [onNodeDragStop])

  return (
    <section className="roadmap" data-theme={theme} data-settling={roadmap.settling} aria-label="ストーリーロードマップ" hidden={hidden}
      style={backgroundColor ? { '--roadmap-background': backgroundContentColor(backgroundColor) } : undefined}>
      <div className="roadmap__toolbar" role="toolbar" aria-label="RoadMapの操作">
        <div className="roadmap__controls">
          {viewMode === 'list' ? <>
            <div className="roadmap__search">
              <TN_TextField theme={theme} type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)}
                placeholder="Textを検索" aria-label="Textを検索" icon={<Search size={18} />} borderRadius="10px" />
            </div>
            <TN_Button theme={theme} variant="proceed" aria-label="Textを追加" onClick={() => setTextDialog({ mode: 'create' })}>
              <Plus size={18} aria-hidden="true" />Textを追加
            </TN_Button>
          </> : <>
            <TN_Button theme={theme} variant="secondary" aria-label="背景を変更" aria-haspopup="dialog"
              onClick={() => setTemplateDialogOpen(true)}>
              <BluePrint size={18} aria-hidden="true" />
              背景を変更
            </TN_Button>
            <RoadMapStampMenu theme={theme} contents={contents} ready={interactive && !!instance && !stamps.adding}
              onAdd={(type, source) => { selectStory(null); void stamps.addStamp(type, source) }} />
          </>}
        </div>
        <div className="roadmap__view-switch">
          <RoadMapViewSwitch value={viewMode} onChange={setViewMode} theme={theme} />
        </div>
      </div>
      {viewMode === 'list' && <RoadMapListView stories={roadmap.orderedStories} theme={theme}
        active={active && !hidden && !dialogOpen} onReorder={roadmap.reorderStory} onAction={openTextAction}
        query={searchQuery} onClearSearch={() => setSearchQuery('')} />}
      {textDialog && active && !hidden && <RoadMapTextDialog key={`${textDialog.mode}:${textDialog.id ?? 'new'}`}
        dialog={textDialog} stories={roadmap.orderedStories} theme={theme} onClose={() => setTextDialog(null)} onConfirm={confirmTextAction} />}
      {templateDialogOpen && active && !hidden && <RoadMapTemplateDialog theme={theme} value={backgroundColor}
        onClose={() => setTemplateDialogOpen(false)} onConfirm={color => {
          setBackgroundColor(color)
          setTemplateDialogOpen(false)
        }} />}
      <div ref={containerRef} className="graph-map roadmap__canvas" hidden={viewMode !== 'roadmap'}>
        {roadmap.layoutReady && <ReactFlow
          {...viewportOptions}
          id={flowId}
          onInit={setInstance}
          nodes={[...roadmap.nodes, ...stamps.nodes]}
          nodeTypes={nodeTypes}
          nodesConnectable={false}
          elevateNodesOnSelect={false}
          connectOnClick={false}
          translateExtent={scrollBounds.translateExtent}
          onNodesChange={onNodesChange}
          onBeforeDelete={requestNodeDeletion}
          onNodeClick={selectNode}
          onPaneClick={clearSelection}
          onNodeDragStart={(event, node) => {
            if (node.type === 'roadmapStory') { clearStampSelection(); roadmap.onNodeDragStart(event, node) }
            else selectStory(null)
          }}
          onNodeDrag={(event, node) => { if (node.type === 'roadmapStory') roadmap.onNodeDrag(event, node) }}
          onNodeDragStop={stopDrag}
          multiSelectionKeyCode={null}
          selectionKeyCode={null}
          selectionOnDrag={false}
          nodeDragThreshold={5}
          deleteKeyCode={active && !hidden && viewMode === 'roadmap' && !dialogOpen ? ['Backspace', 'Delete'] : null}
          colorMode={theme}
        >
          <ViewportPortal>
            <RoadMapTimeline segments={roadmap.timeline} reordering={roadmap.dragging} width={scrollBounds.translateExtent[1][0]} height={scrollBounds.contentHeight} />
            {roadmap.inserts.map(insert => (
              <div key={insert.id} className={`roadmap-overlay-action roadmap-overlay-action--${insert.terminal ? 'terminal' : 'between'}`} style={{ width: insert.size, height: insert.size, transform: `translate(${insert.position.x}px, ${insert.position.y}px)` }}>
                <RoadMapInsertNode data={insert.data} />
              </div>
            ))}
          </ViewportPortal>
        </ReactFlow>}
      </div>
    </section>
  )
}
