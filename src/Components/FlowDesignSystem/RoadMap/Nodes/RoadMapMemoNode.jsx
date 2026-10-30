import { ROADMAP_NODE_SIZES } from '../roadMapNodeSizes.js'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import './RoadMapMemoNode.css'

export default function RoadMapMemoNode({ name = 'Memo', width = ROADMAP_NODE_SIZES.memo.width, content = '<p></p>', onContentChange, interactive = true }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false })],
    content,
    editable: interactive,
    onUpdate: ({ editor }) => onContentChange?.(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'roadmap-memo-node__input',
        role: 'textbox',
        'aria-label': `${name}の本文`,
        'aria-multiline': 'true',
        spellcheck: 'false',
      },
    },
  })
  useEffect(() => {
    if (editor && editor.getHTML() !== content) editor.commands.setContent(content, { emitUpdate: false })
  }, [editor, content])
  useEffect(() => { editor?.setEditable(interactive) }, [editor, interactive])

  return (
    <section className="roadmap-memo-node" style={{ width, '--roadmap-memo-body-height': `${ROADMAP_NODE_SIZES.memo.bodyHeight}px` }} aria-label={name}>
      <div className="roadmap-memo-node__grip" role="img" aria-label="ドラッグしてメモを移動" title="ドラッグして移動">
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          {[4, 8, 12].flatMap((y) => [5, 11].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />))}
        </svg>
      </div>
      <div className="roadmap-memo-node__body nodrag nopan nowheel" onKeyDown={(event) => event.stopPropagation()}>
        <EditorContent editor={editor} />
      </div>
    </section>
  )
}
