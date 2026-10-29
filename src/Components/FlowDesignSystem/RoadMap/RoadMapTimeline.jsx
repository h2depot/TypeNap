import { memo } from 'react'

export default memo(function RoadMapTimeline({ segments, width, height, reordering }) {
  return (
    <svg className="roadmap-timeline" data-reordering={reordering} width={width} height={height} aria-hidden="true" focusable="false">
      {segments.map(segment => <g key={segment.id} className="roadmap-timeline__edge">
        <path className="roadmap-timeline__hit" d={segment.data.path} fill="none" />
        <path className="roadmap-timeline__path" d={segment.data.path} fill="none" />
      </g>)}
    </svg>
  )
})
