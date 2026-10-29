import JointMark from '../JointMark.jsx'
import CharacterNode from './CharacterNode.jsx'
import EntityNode from './EntityNode.jsx'
import WorldNode from './WorldNode.jsx'
import MemoNode from './MemoNode.jsx'
import DocumentNode from './DocumentNode.jsx'
import { useReactFlow } from '@xyflow/react'
import TN_NodeTip from '../../../TNDesignSystem/TN_NodeTip.jsx'
import TN_IconButton from '../../../TNDesignSystem/TN_IconButton.jsx'
import { PanelOpen, Trash2 } from '../../../../assets/original_icons/index.js'
import { contentTabProps } from '../../../../store/contentsInfo.js'
import { useTabStore } from '../../../../store/tabStore.js'

const cards = { character: CharacterNode, entity: EntityNode, world: WorldNode, memo: MemoNode, document: DocumentNode }
const widths = { character: 200, entity: 240, world: 300, memo: 340, document: 300 }

export default function StoryNode({ id, data, type, isConnectable }) {
  const { updateNodeData, deleteElements } = useReactFlow()
  const Card = cards[type]
  const canOpen = type !== 'memo' && !!data.contentsInfo
  const actions = <div className="story-node__tip-actions nodrag nopan nowheel">
    {canOpen && <TN_IconButton icon={<PanelOpen />} size="small" borderRadius="10px" theme={data.theme}
      aria-label={`${data.name || type}を開く`} title="編集ファイルを開く"
      onClick={() => {
        const props = contentTabProps(data.contentsInfo)
        useTabStore.getState().addTab('work', props.title, props)
      }} />}
    <TN_IconButton icon={<Trash2 />} size="small" borderRadius="10px" theme={data.theme}
      aria-label={`${data.name || type}を削除`} title="ノードを削除"
      onClick={() => deleteElements({ nodes: [{ id }] })} />
  </div>
  return (
    <div className={`story-node story-node--${type}`}>
      <TN_NodeTip name={data.name} summary={data.summary || (type === 'document' ? data.content : '')}
        theme={data.theme} actions={actions}>
        <div className="story-node__card">
          <Card name={data.name} summary={data.summary} imagePaths={data.imagePaths} tooltip={false} theme={data.theme}
            {...(type === 'document' ? { emoji: data.emoji ?? '', onEmojiChange: emoji => updateNodeData(id, { emoji }) } : {})}
            {...(type === 'memo' ? { content: data.content, onContentChange: content => updateNodeData(id, { content }) } : {})}
            width={widths[type]}>{type === 'document' ? data.content : undefined}</Card>
        </div>
      </TN_NodeTip>
      <JointMark isConnectable={isConnectable} />
    </div>
  )
}
