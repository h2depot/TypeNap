import { Handle, Position, useConnection, useNodeConnections } from '@xyflow/react'
import './JointMark.css'

const joints = [
  { id: 'top', type: 'target', position: Position.Top },
  { id: 'left', type: 'target', position: Position.Left },
  { id: 'bottom', type: 'source', position: Position.Bottom },
  { id: 'right', type: 'source', position: Position.Right },
]

function JointHandle({ joint, isConnectable }) {
  const connections = useNodeConnections({ handleType: joint.type, handleId: joint.id })
  const connecting = useConnection((connection) => connection.inProgress)
  return (
    <Handle {...joint} className="joint-mark" isConnectable={isConnectable}
      data-visible={connections.length > 0 || connecting ? 'true' : 'false'} />
  )
}

export default function JointMark({ isConnectable = true }) {
  return joints.map((joint) => (
    <JointHandle key={joint.id} joint={joint} isConnectable={isConnectable} />
  ))
}
