import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { documentToText } from './plainTextEditor.js';

export const searchHighlightKey = new PluginKey('textBoxSearch');

export function findSearchMatches(doc, query) {
    if (!query) return [];
    // Paragraph boundaries occupy two ProseMirror positions but one text newline.
    const positions = [];
    doc.forEach((node, offset) => {
        for (let index = 0; index < node.textContent.length; index++) {
            positions.push(offset + 1 + index);
        }
        positions.push(offset + 1 + node.textContent.length);
    });
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return Array.from(documentToText(doc).matchAll(new RegExp(escaped, 'gi')), (match) => ({
        from: positions[match.index],
        to: positions[match.index + match[0].length],
    }));
}

export function createSearchState(doc, query, activeIndex, classes) {
    const matches = findSearchMatches(doc, query);
    const index = Math.min(activeIndex, Math.max(0, matches.length - 1));
    const decorations = [];
    matches.forEach((match, matchIndex) => {
        doc.nodesBetween(match.from, match.to, (node, pos) => {
            if (node.isText) {
                decorations.push(Decoration.inline(Math.max(pos, match.from), Math.min(pos + node.nodeSize, match.to), {
                    class: matchIndex === index ? classes.active : classes.match,
                }));
            }
        });
    });
    return { query, activeIndex: index, matches, decorations: DecorationSet.create(doc, decorations) };
}

export const SearchHighlight = Extension.create({
    name: 'textBoxSearch',
    addOptions() { return { match: '', active: '' }; },
    addCommands() {
        return {
            setTextBoxSearch: (query, activeIndex = 0) => ({ tr, dispatch }) => {
                if (dispatch) tr.setMeta(searchHighlightKey, { query, activeIndex });
                return true;
            },
        };
    },
    addProseMirrorPlugins() {
        const classes = this.options;
        return [new Plugin({
            key: searchHighlightKey,
            state: {
                init: (_, state) => createSearchState(state.doc, '', 0, classes),
                apply: (tr, previous) => {
                    const search = tr.getMeta(searchHighlightKey);
                    return search || tr.docChanged
                        ? createSearchState(tr.doc, search?.query ?? previous.query, search?.activeIndex ?? previous.activeIndex, classes)
                        : previous;
                },
            },
            props: { decorations: (state) => searchHighlightKey.getState(state).decorations },
        })];
    },
});
