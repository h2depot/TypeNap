import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Paragraph from '@tiptap/extension-paragraph';

// Keep the existing .txt contract: one paragraph represents one line.
export const PlainParagraph = Paragraph.extend({
    content: 'text*',
    whitespace: 'pre',
    addKeyboardShortcuts() {
        return { 'Shift-Enter': () => this.editor.commands.splitBlock() };
    },
});

export const PlainStarterKit = StarterKit.configure({
    paragraph: false, hardBreak: false, heading: false, blockquote: false,
    bulletList: false, orderedList: false, listItem: false, listKeymap: false,
    bold: false, italic: false, strike: false, underline: false, code: false,
    codeBlock: false, horizontalRule: false, link: false, trailingNode: false,
});

export function textToDocument(text) {
    return {
        type: 'doc',
        content: text.replace(/\r\n?/g, '\n').split('\n').map((line) => ({
            type: 'paragraph',
            ...(line ? { content: [{ type: 'text', text: line }] } : {}),
        })),
    };
}

export function documentToText(doc) {
    return doc.textBetween(0, doc.content.size, '\n');
}

export const PlainTextClipboard = Extension.create({
    name: 'plainTextClipboard',
    onCreate() {
        this.editor.setOptions({
            editorProps: {
                ...this.editor.options.editorProps,
                clipboardTextSerializer: (slice) => slice.content.textBetween(0, slice.content.size, '\n'),
                handlePaste: (_view, event) => {
                    if (!event.clipboardData) return false;
                    event.preventDefault();
                    this.editor.commands.insertContent(textToDocument(event.clipboardData.getData('text/plain')).content);
                    return true;
                },
            },
        });
    },
});
