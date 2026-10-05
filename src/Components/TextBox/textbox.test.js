import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSchema } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { PlainStarterKit, PlainParagraph, textToDocument, documentToText } from './plainTextEditor.js';
import { findSearchMatches, createSearchState, SearchHighlight, searchHighlightKey } from './searchHighlight.js';

const schema = getSchema([PlainStarterKit, PlainParagraph]);
const document = (text) => schema.nodeFromJSON(textToDocument(text));

test('plain text round trip preserves blank lines, spaces and literal HTML', () => {
    for (const text of ['', '\n', '\n\n', '  あたし\tだよ  \n\n<羊>&\n', '😀\n末尾\n']) {
        assert.equal(documentToText(document(text)), text);
    }
    assert.equal(documentToText(document('a\r\nb\rc')), 'a\nb\nc');
});

test('search positions account for paragraph boundaries and UTF-16 text', () => {
    const doc = document('羊\n\n😀羊\n羊');
    const matches = findSearchMatches(doc, '羊');
    assert.equal(matches.length, 3);
    matches.forEach(({ from, to }) => assert.equal(doc.textBetween(from, to, '\n'), '羊'));
    const crossLine = findSearchMatches(doc, '羊\n\n😀');
    assert.equal(doc.textBetween(crossLine[0].from, crossLine[0].to, '\n'), '羊\n\n😀');
    const endingInNewline = findSearchMatches(doc, '羊\n\n');
    assert.equal(doc.textBetween(endingInNewline[0].from, endingInNewline[0].to, '\n'), '羊\n\n');
});

test('search escapes regex characters and ignores case', () => {
    const doc = document('A.b a.B [羊]');
    assert.equal(findSearchMatches(doc, 'a.b').length, 2);
    assert.equal(findSearchMatches(doc, '[羊]').length, 1);
    assert.equal(findSearchMatches(doc, '').length, 0);
    assert.equal(findSearchMatches(doc, 'missing').length, 0);
});

test('decorations mark the active match without changing saved content', () => {
    const doc = document('羊\n羊');
    const result = createSearchState(doc, '羊', 1, { match: 'match', active: 'active' });
    assert.deepEqual(result.decorations.find().map((decoration) => decoration.type.attrs.class), ['match', 'active']);
    assert.equal(documentToText(doc), '羊\n羊');
    assert.equal(createSearchState(doc, '羊', 99, {}).activeIndex, 1);
});

test('search plugin rebuilds results after editing and clears highlights when closed', () => {
    const extension = SearchHighlight.configure({ match: 'match', active: 'active' });
    const plugins = extension.config.addProseMirrorPlugins.call({ options: extension.options });
    let state = EditorState.create({ schema, doc: document('羊 羊'), plugins });
    state = state.apply(state.tr.setMeta(searchHighlightKey, { query: '羊', activeIndex: 1 }));
    assert.equal(searchHighlightKey.getState(state).matches.length, 2);
    state = state.apply(state.tr.delete(3, 4));
    assert.equal(searchHighlightKey.getState(state).matches.length, 1);
    assert.equal(searchHighlightKey.getState(state).activeIndex, 0);
    state = state.apply(state.tr.setMeta(searchHighlightKey, { query: '', activeIndex: 0 }));
    assert.equal(searchHighlightKey.getState(state).decorations.find().length, 0);
});
