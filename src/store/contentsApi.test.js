import * as contentModel from './contentsInfo.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { create } from 'zustand';
import { withImageReferenceWrite } from './imageReferenceWrites.js';
import { normalizeImagePath, normalizeImageContent } from '../utils/imagePaths.js';

async function setup(beforeInvoke = async () => {}) {
    const calls = [];
    const info = { story_name: 'Story', name: 'Chapter', access_id: 'de7187b7-27bd-4c69-85f0-29ad5dc23761', content_type: 'txt' };
    const invoke = async (command, args) => {
        calls.push({ command, args });
        await beforeInvoke(command, args);
        if (command === 'create_document_txt') return { ...info };
        if (command === 'get_whole_txt_list') return [{ ...info }];
        if (command === 'get_story_list') return [{ story_name: 'Story', contents: [{ ...info }] }];
        if (command === 'get_story_info') return { story_name: 'Story', contents: [{ ...info }] };
        if (command === 'load_json') return { name: 'Character', traits: ['calm'], age: 20 };
        if (command === 'load_txt' || command === 'get_txt_content') return 'loaded body';
    };
    const dependencies = {
        './contentsInfo.js': contentModel,
        './imageReferenceWrites.js': { withImageReferenceWrite },
        '../utils/imagePaths.js': { normalizeImagePath, normalizeImageContent },
        zustand: { create },
        '@tauri-apps/api/core': { invoke },
        '../store/toastStore': { useToastStore: { getState: () => ({ addToast() {} }) } },
        './saving/stats': { useStatsStore: { getState: () => ({ async recordCharacterChange() {}, async removeRecentFile() {}, async updateRecentContent() {} }) } },
        './languageController': { default: { t: key => key } },
        './initializerInterface': { initializationErrorMessage() {}, normalizeInitializationError() {} },
    };
    const load = async (file, extra = {}) => {
        const module = new SourceTextModule(await readFile(new URL(file, import.meta.url), 'utf8'));
        await module.link(name => {
            const exports = extra[name] ?? dependencies[name];
            assert.ok(exports, `Missing test dependency ${name}`);
            return new SyntheticModule(Object.keys(exports), function () {
                for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
            });
        });
        await module.evaluate();
        return module.namespace;
    };
    const { useFileStore } = await load('./fileStore.js');
    const { useTxtStore } = await load('./txtStore.js', { './fileStore': { useFileStore } });
    return { useFileStore, useTxtStore, info, calls };
}

test('creation returns UUID and normal read/save/rename/delete calls carry ContentsInfo', async () => {
    const { useFileStore: files, useTxtStore: texts, info, calls } = await setup();
    const input = { story_name: 'Story', name: 'Chapter', content_type: 'txt' };
    assert.deepEqual(await files.getState().createTxt(input), info);
    assert.deepEqual(calls[0], { command: 'create_document_txt', args: { input } });
    assert.deepEqual(files.getState().wholeTxtList, [info]);
    texts.getState().initWorkspace(info);
    await texts.getState().loadContent(info);
    texts.getState().updateContent(info.access_id, 'edited body');
    await texts.getState().saveContent(info.access_id);
    await texts.getState().saveTitle(info.access_id, 'Renamed');
    const workspace = texts.getState().workspaces[info.access_id];
    assert.equal(workspace.contentsInfo.access_id, info.access_id);
    assert.equal(workspace.contentsInfo.name, 'Renamed');
    assert.equal(files.getState().wholeTxtList[0].name, 'Renamed');
    texts.getState().updateContent(info.access_id, 'after rename');
    await texts.getState().saveContent(info.access_id);
    await files.getState().deleteTxt(workspace.contentsInfo);
    for (const call of calls.filter(call => ['load_txt', 'save_document_content', 'save_document_title', 'delete_txt'].includes(call.command))) {
        assert.equal(call.args.contentsInfo.access_id, info.access_id);
        assert.equal(call.args.contentsInfo.content_type, 'txt');
        assert.equal('txtInfo' in call.args, false);
    }
    const save = calls.filter(call => call.command === 'save_document_content').at(-1);
    assert.equal(save.args.content, 'after rename');
    assert.equal(save.args.contentsInfo.name, 'Renamed');
});

test('old saved tab names are resolved to UUID before IPC, existing UUID bypasses name lookup', async () => {
    const { useFileStore: files, useTxtStore: texts, info, calls } = await setup();
    const migrated = await files.getState().resolveContentsInfo({ story_name: 'Story', title: 'Chapter' });
    texts.getState().initWorkspace(migrated);
    await texts.getState().loadContent(migrated);
    assert.deepEqual(texts.getState().workspaces[info.access_id].contentsInfo, info);
    assert.deepEqual(calls.find(call => call.command === 'load_txt').args, { contentsInfo: info });
    const stale = { ...info, name: 'old display name' };
    const before = calls.length;
    assert.deepEqual(await files.getState().resolveContentsInfo(stale), stale);
    assert.equal(calls.length, before);
    assert.equal((await files.getState().resolveContentsInfo({ ...info, content_type: 'world' })).content_type, 'world');
    await assert.rejects(files.getState().getTxtContent({ ...info, content_type: 'world' }));
});


test('Character JSON loads, saves structured values, rejects invalid drafts and renames through JSON IPC', async () => {
    const { useTxtStore: texts, info, calls } = await setup();
    const character = { ...info, content_type: 'character' };
    const id = info.access_id;
    texts.getState().initWorkspace(character);
    await texts.getState().loadContent(character);
    assert.equal(JSON.parse(texts.getState().workspaces[id].content).age, 20);
    texts.getState().updateContent(id, '{invalid');
    await assert.rejects(texts.getState().saveContent(id));
    assert.equal(texts.getState().workspaces[id].isEdited, true);
    assert.equal(calls.filter(call => call.command === 'save_json_content').length, 0);
    const value = { name: '\u7f8a', traits: ['calm'], age: 21, active: true, other: null };
    texts.getState().updateContent(id, JSON.stringify(value));
    await texts.getState().saveContent(id);
    assert.deepEqual(calls.find(call => call.command === 'save_json_content').args, { contentsInfo: character, content: value });
    assert.equal(texts.getState().workspaces[id].isEdited, false);
    await texts.getState().saveTitle(id, 'Renamed');
    assert.equal(calls.find(call => call.command === 'save_json_title').args.newTitle, 'Renamed');
    assert.equal(calls.some(call => ['load_txt', 'save_document_content', 'save_document_title'].includes(call.command)), false);
});

test('JSON list rename, deletion and deleted-file recovery use the shared backup lifecycle', async () => {
    const { useFileStore: files, info, calls } = await setup();
    const character = { ...info, content_type: 'character' };
    await files.getState().updateTxtName(character, 'Renamed');
    await files.getState().deleteTxt(character);
    await files.getState().fetchDeletedFiles();
    const items = [{ directoryName: 'Story_123', backupKind: 'json', fileName: 'character_Chapter_id' }];
    await files.getState().restoreDeletedFiles(items);
    await files.getState().executeCompleteDeletion(items);
    assert.deepEqual(calls.find(call => call.command === 'save_json_title').args, { contentsInfo: character, newTitle: 'Renamed' });
    assert.deepEqual(calls.find(call => call.command === 'delete_txt').args, { contentsInfo: character });
    assert.ok(calls.some(call => call.command === 'get_deleted_files'));
    assert.deepEqual(calls.find(call => call.command === 'restore_deleted_files').args.items, items);
    assert.deepEqual(calls.find(call => call.command === 'execute_complete_deletion').args.items, items);
});

const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('all content types retain edits made during rename and keep the UUID workspace key', async () => {
    for (const content_type of contentModel.CONTENT_TYPES) {
        const pending = deferred();
        const { useTxtStore: texts, info, calls } = await setup(async command => {
            if (command === (content_type === 'txt' ? 'save_document_title' : 'save_json_title')) await pending.promise;
        });
        const descriptor = { ...info, content_type };
        const id = info.access_id;
        texts.getState().initWorkspace(descriptor);
        await texts.getState().loadContent(descriptor);
        const draft = content_type === 'txt' ? 'first draft' : JSON.stringify({ properties: { mood: 'first' } });
        const newer = content_type === 'txt' ? 'new typing during rename' : JSON.stringify({ properties: { mood: 'newer edit' } });
        texts.getState().updateContent(id, draft);
        const savedLength = texts.getState().workspaces[id].savedContentLength;
        const rename = texts.getState().saveTitle(id, 'New name');
        await flush();
        texts.getState().updateContent(id, newer);
        pending.resolve();
        const renamed = await rename;
        assert.deepEqual(Object.keys(texts.getState().workspaces), [id]);
        assert.deepEqual(renamed, { ...descriptor, name: 'New name' });
        assert.equal(texts.getState().workspaces[id].content, newer);
        assert.equal(texts.getState().workspaces[id].isEdited, true);
        assert.equal(texts.getState().workspaces[id].savedContentLength, savedLength);
        await texts.getState().saveContent(id);
        const saved = calls.filter(call => call.command.endsWith('_content')).at(-1);
        assert.equal(saved.args.contentsInfo.access_id, id);
        assert.equal(saved.args.contentsInfo.name, 'New name');
        assert.equal(texts.getState().workspaces[id].isEdited, false);
    }
});

test('same-name text and JSON drafts stay independent through rename, save and deletion', async () => {
    const { useTxtStore: texts, info, calls } = await setup();
    const descriptors = contentModel.CONTENT_TYPES.map((content_type, i) => ({ ...info,
        content_type, access_id: `de7187b7-27bd-4c69-85f0-29ad5dc2376${i}` }));
    for (const descriptor of descriptors) {
        texts.getState().initWorkspace(descriptor);
        await texts.getState().loadContent(descriptor);
        texts.getState().updateContent(descriptor.access_id, descriptor.content_type === 'txt' ? 'text draft' : JSON.stringify({ summary: descriptor.content_type }));
    }
    const original = structuredClone(texts.getState().workspaces);
    const target = descriptors[1];
    await texts.getState().saveTitle(target.access_id, 'Renamed');
    await texts.getState().saveContent(target.access_id);
    for (const descriptor of descriptors.filter(item => item !== target)) {
        assert.deepEqual(texts.getState().workspaces[descriptor.access_id], original[descriptor.access_id]);
    }
    assert.equal(calls.find(call => call.command === 'save_json_content').args.contentsInfo.access_id, target.access_id);
    texts.getState().removeWorkspace(target.access_id);
    assert.equal(Object.keys(texts.getState().workspaces).length, 3);
});

test('save, rename and queued save keep newer edits and clear the UUID saving state', async () => {
    for (const content_type of contentModel.CONTENT_TYPES) {
        const saving = deferred();
        let first = true;
        const saveCommand = content_type === 'txt' ? 'save_document_content' : 'save_json_content';
        const { useTxtStore: texts, info, calls } = await setup(async command => {
            if (command === saveCommand && first) { first = false; await saving.promise; }
        });
        const descriptor = { ...info, content_type }, id = info.access_id;
        texts.getState().initWorkspace(descriptor);
        await texts.getState().loadContent(descriptor);
        const draft = value => content_type === 'txt' ? value : JSON.stringify({ summary: value });
        texts.getState().updateContent(id, draft('first'));
        const firstSave = texts.getState().saveContent(id);
        await flush();
        const rename = texts.getState().saveTitle(id, 'Renamed');
        texts.getState().updateContent(id, draft('second'));
        const nextSave = texts.getState().saveContent(id);
        saving.resolve();
        await Promise.all([firstSave, rename, nextSave]);
        const workspace = texts.getState().workspaces[id];
        assert.equal(workspace.title, 'Renamed');
        assert.equal(workspace.content, draft('second'));
        assert.equal(workspace.isSaving, false);
        assert.equal(workspace.isEdited, false);
        assert.equal(calls.filter(call => call.command === saveCommand).length, 2);
    }
});

test('failed renames preserve drafts and story renames change metadata without moving keys', async () => {
    const { useTxtStore: texts, info } = await setup(async command => {
        if (command === 'save_document_title') throw new Error('rename failed');
    });
    texts.getState().initWorkspace(info);
    await texts.getState().loadContent(info);
    texts.getState().updateContent(info.access_id, 'unsaved');
    const before = structuredClone(texts.getState().workspaces);
    await assert.rejects(texts.getState().saveTitle(info.access_id, 'Rejected'));
    assert.deepEqual(texts.getState().workspaces, before);
    texts.getState().renameStoryInWorkspaces('Story', 'New story');
    const workspace = texts.getState().workspaces[info.access_id];
    assert.equal(workspace.contentsInfo.story_name, 'New story');
    assert.equal(workspace.content, 'unsaved');
    assert.equal(workspace.isEdited, true);
    assert.deepEqual(Object.keys(texts.getState().workspaces), [info.access_id]);
});
