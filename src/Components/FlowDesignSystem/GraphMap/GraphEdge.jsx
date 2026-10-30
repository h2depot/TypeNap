import { useId } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow } from '@xyflow/react'
import TN_IconButton from '../../TNDesignSystem/TN_IconButton.jsx'
import { Trash2 } from '../../../assets/original_icons/index.js'

export default function GraphEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data, style, interactionWidth }) {
  const markerId = `graph-arrow-${useId().replace(/:/g, '')}`
  const { updateEdgeData, setEdges, deleteElements } = useReactFlow()
  const [path, x, y] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const direction = data?.direction ?? 'undirected'
  const comment = data?.comment ?? ''

  return (
    <>
      <defs>
        <marker id={markerId} viewBox="0 0 24 24" refX="18" refY="11.5" markerWidth="36" markerHeight="36" markerUnits="userSpaceOnUse" orient="auto-start-reverse" overflow="visible">
          {/* SVG follows the path's endpoint tangent automatically; the start marker reverses it. */}
          <path d="M17.2099 9.81878C18.2634 10.6987 18.2634 12.3013 17.2099 13.1812L9.68526 19.4665C7.95576 20.9111 5.39664 19.1897 6.12838 17.0739L7.81015 12.2113C7.96964 11.7501 7.96964 11.2498 7.81015 10.7887L6.12839 5.92605C5.39664 3.81028 7.95576 2.08889 9.68526 3.53352L17.2099 9.81878Z" fill={style?.stroke ?? 'var(--brand-accent)'} />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={path}
        style={style}
        markerStart={direction === 'reverse' ? `url(#${markerId})` : undefined}
        markerEnd={direction === 'forward' ? `url(#${markerId})` : undefined}
        interactionWidth={interactionWidth}
      />
      {(selected || comment) && (
        <EdgeLabelRenderer>
          <div
            className={`graph-edge-label nodrag nopan${selected ? ' graph-edge-label--selected' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {selected ? (
              <div className="graph-edge-menu" aria-label="Edgeの設定">
                <div className="graph-edge-menu__header">
                  <span>Edgeの設定</span>
                  <TN_IconButton
                    type="button"
                    icon={<Trash2 />}
                    size="small"
                    variant="ghost"
                    theme={data?.theme ?? 'light'}
                    aria-label="Edgeを削除"
                    title="Edgeを削除"
                    onClick={() => deleteElements({ edges: [{ id }] })}
                  />
                </div>
                <div className="graph-edge-menu__directions" role="group" aria-label="Edgeの向き">
                  {[
                    ['undirected', '無向', '—'],
                    ['forward', '順方向', '→'],
                    ['reverse', '逆方向', '←'],
                  ].map(([value, label, symbol]) => (
                    <button key={value} type="button" aria-pressed={direction === value} onClick={() => updateEdgeData(id, { direction: value })}>
                      <span aria-hidden="true">{symbol}</span> {label}
                    </button>
                  ))}
                </div>
                <label className="graph-edge-menu__comment">
                  <span>コメント</span>
                  <textarea
                    rows={3}
                    value={comment}
                    placeholder="関係についてコメント…"
                    onChange={(event) => updateEdgeData(id, { comment: event.target.value })}
                  />
                </label>
              </div>
            ) : (
              <button type="button" className="graph-edge-comment" aria-label={`Edgeのコメントを編集: ${comment}`} onClick={() => setEdges((edges) => edges.map((edge) => ({ ...edge, selected: edge.id === id })))}>
                {comment}
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
