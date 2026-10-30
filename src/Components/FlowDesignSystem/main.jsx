import { useCallback, useEffect, useReducer, useState } from 'react'
import { useTNTheme } from '../TNDesignSystem/theme'
import GraphMap from './GraphMap/GraphMap.jsx'
import { createGraphHistory, graphHistoryReducer } from './GraphMap/graphHistory.js'
import RoadMap from './RoadMap/RoadMap.jsx'
import Tabular from './Tabular/Tabular.jsx'
import { defaultFlowViews, flowViewDataKey, loadGraphView, saveGraphView } from './flowViewState.js'
import './main.css'
import { useStoryStore } from '../../store/storyStore.js'

const storage = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
}
const readGraph = (story, entry) => loadGraphView(storage, flowViewDataKey(story, entry))

function GraphView({ entry, storyName, onElementsChange, ...props }) {
  const [history, dispatch] = useReducer(graphHistoryReducer, null, () => createGraphHistory(readGraph(storyName, entry)))
  const { nodes, edges } = history.present
  const onNodesChange = useCallback(changes => dispatch({ type: 'nodes', changes }), [])
  const onEdgesChange = useCallback(changes => dispatch({ type: 'edges', changes }), [])
  const onConnect = useCallback(connection => dispatch({ type: 'connect', connection }), [])
  const onBeforeDelete = useCallback(({ nodes, edges }) => {
    // React Flow emits edge and node removals separately; record them as one edit.
    dispatch({ type: 'delete', nodes, edges })
    return false
  }, [])
  useEffect(() => { onElementsChange(entry.id, nodes) }, [entry.id, nodes, onElementsChange])
  useEffect(() => {
    if (!nodes.some(node => node.dragging)) saveGraphView(storage, flowViewDataKey(storyName, entry), nodes, edges)
  }, [entry.id, entry.type, storyName, nodes, edges])
  return <GraphMap {...props} nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
    onConnect={onConnect} onBeforeDelete={onBeforeDelete} canUndo={!!history.past.length} canRedo={!!history.future.length}
    onUndo={() => dispatch({ type: 'undo' })} onRedo={() => dispatch({ type: 'redo' })}
    onEndEdit={() => dispatch({ type: 'endEdit' })} />
}

export default function FlowDesignSystem({ view, mountedViews, storyName, flowViews = defaultFlowViews, isActive = true, hidden = false }) {
  const theme = useTNTheme()
  const contents = useStoryStore(state => state.workspaces[storyName]?.contentsList)
  const [graphElements, setGraphElements] = useState(() => Object.fromEntries(flowViews
    .filter(entry => entry.type === 'graph').map(entry => [entry.id, readGraph(storyName, entry).nodes])))
  const updateElements = useCallback((id, nodes) => setGraphElements(current => current[id] === nodes ? current : { ...current, [id]: nodes }), [])
  const elements = flowViews.filter(entry => entry.type === 'graph').flatMap(entry => graphElements[entry.id] ?? [])
  const currentName = view === 'roadmap' ? 'RoadMap' : flowViews.find(entry => entry.id === view)?.name
  return <section className="flow-design-system" data-theme={theme} aria-label={currentName} hidden={hidden}>
    {mountedViews.includes('roadmap') && <RoadMap key={storyName} theme={theme}
      contents={contents ?? []} active={isActive && view === 'roadmap'} hidden={view !== 'roadmap'} />}
    {flowViews.filter(entry => mountedViews.includes(entry.id)).map(entry => entry.type === 'graph'
      ? <GraphView key={entry.id} entry={entry} storyName={storyName} theme={theme} contents={contents} onElementsChange={updateElements}
        active={isActive && view === entry.id} hidden={view !== entry.id} />
      : <Tabular key={entry.id} theme={theme} elements={elements} contents={contents} empty={entry.id !== 'tabular'}
        storageKey={flowViewDataKey(storyName, entry)} hidden={view !== entry.id} />)}
  </section>
}
