import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import './MemoNode.css'

export default function MemoNode({ name = 'Memo', width = 340, content = '<p></p>', onContentChange }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false })],
    content,
    onUpdate: ({ editor }) => onContentChange?.(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'memo-node__input',
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

  return (
    <section className="memo-node" style={{ width }} aria-label={name}>
      <div className="memo-node__grip" role="img" aria-label="ドラッグしてメモを移動" title="ドラッグして移動">
        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          {[4, 8, 12].flatMap((y) => [5, 11].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />))}
        </svg>
      </div>
      <div className="memo-node__body nodrag nopan nowheel" onKeyDown={(event) => event.stopPropagation()}>
        <EditorContent editor={editor} />
      </div>
    </section>
  )
}
