import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { create } from 'zustand';

const source = (await readFile(new URL('./storyStore.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '')
    .replace('export const useStoryStore', 'const useStoryStore');
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
    const requests = [];
    const useFileStore = { getState: () => ({ updateStorySynopsis: (name, content, options) =>
        new Promise((resolve, reject) => requests.push({ name, content, options, resolve, reject })) }) };
    const store = new Function('create', 'useFileStore', `${source}\nreturn useStoryStore;`)(create, useFileStore);
    store.getState().initWorkspace('Story', [], 0, { synopsis: 'saved' });
    return { store, requests, workspace: () => store.getState().workspaces.Story };
}

test('shared synopsis draft survives reopening and metadata refreshes', () => {
    const { store, workspace } = fixture();
    store.getState().updateSynopsis('Story', 'unsaved\n\n羊');
    store.getState().initWorkspace('Story', [], 0, { synopsis: 'stale' });
    store.getState().updateStoryInfo('Story', { synopsis: 'stale', cover: '#123456' });
    assert.equal(workspace().synopsisDraft, 'unsaved\n\n羊');
    assert.equal(workspace().synopsis, 'saved');
    assert.equal(workspace().cover, '#123456');
    assert.equal(workspace().synopsisIsEdited, true);
});

test('manual synopsis save leaves newer edits dirty without automatically writing them', async () => {
    const { store, requests, workspace } = fixture();
    store.getState().updateSynopsis('Story', 'first');
    const save = store.getState().saveSynopsis('Story');
    await flush();
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].options, { silent: true });
    store.getState().updateSynopsis('Story', 'latest');
    requests[0].resolve({ synopsis: 'first' });
    await save;
    assert.equal(requests.length, 1);
    assert.equal(workspace().synopsisDraft, 'latest');
    assert.equal(workspace().synopsis, 'first');
    assert.equal(workspace().synopsisIsEdited, true);
    const secondSave = store.getState().saveSynopsis('Story');
    await flush();
    requests[1].resolve({ synopsis: 'latest' });
    await secondSave;
    assert.equal(workspace().synopsisIsEdited, false);
    store.getState().updateStoryInfo('Story', { synopsis: 'external' });
    assert.equal(workspace().synopsisDraft, 'external');
});

test('reverting text during manual save preserves the unsaved draft', async () => {
    const { store, requests, workspace } = fixture();
    store.getState().updateSynopsis('Story', 'temporary');
    const save = store.getState().saveSynopsis('Story');
    await flush();
    store.getState().updateSynopsis('Story', 'saved');
    store.getState().updateStoryInfo('Story', { synopsis: 'temporary' });
    assert.equal(workspace().synopsisDraft, 'saved');
    requests[0].resolve({ synopsis: 'temporary' });
    await save;
    assert.equal(requests.length, 1);
    assert.equal(workspace().synopsisDraft, 'saved');
    assert.equal(workspace().synopsis, 'temporary');
    assert.equal(workspace().synopsisIsEdited, true);
});

test('save failure retains the draft and supports retry even after its tab is closed', async () => {
    const { store, requests, workspace } = fixture();
    store.getState().updateSynopsis('Story', 'retry me');
    const save = store.getState().saveSynopsis('Story');
    const failure = assert.rejects(save, /disk full/);
    await flush();
    requests[0].reject(new Error('disk full'));
    await failure;
    assert.equal(workspace().synopsisDraft, 'retry me');
    assert.equal(workspace().synopsisIsEdited, true);
    assert.match(workspace().synopsisSaveError, /disk full/);
    const retry = store.getState().saveSynopsis('Story');
    await flush();
    requests[1].resolve({ synopsis: 'retry me' });
    await retry;
    assert.equal(workspace().synopsisSaveError, null);
    assert.equal(workspace().synopsisIsEdited, false);
});

test('waiting for active saves does not save dirty drafts and preserves them across renaming', async () => {
    const { store, requests } = fixture();
    store.getState().updateSynopsis('Story', 'before rename');
    const save = store.getState().saveSynopsis('Story');
    await flush();
    const all = store.getState().waitForSynopsisSaves();
    requests[0].resolve({ synopsis: 'before rename' });
    await Promise.all([save, all]);
    store.getState().updateSynopsis('Story', 'unsaved after save');
    await store.getState().waitForSynopsisSave('Story');
    await store.getState().waitForSynopsisSaves();
    assert.equal(requests.length, 1);
    store.getState().renameStoryWorkspace('Story', 'Renamed');
    assert.equal(store.getState().workspaces.Story, undefined);
    assert.equal(store.getState().workspaces.Renamed.synopsisDraft, 'unsaved after save');
});
