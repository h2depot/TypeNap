import * as contentModel from './contentsInfo.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { create } from 'zustand';
import * as paths from '../utils/imagePaths.js';
import * as gate from './imageReferenceWrites.js';

async function load(file, modules) {
    const { code } = await transform(await readFile(new URL(file, import.meta.url), 'utf8'), { format: 'cjs' });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', 'console', code)(name => {
        assert.ok(name in modules, `Missing dependency ${name}`);
        return modules[name];
    }, module, module.exports, { log() {}, error() {} });
    return module.exports;
}
const oldPath = 'C:\\Data\\Image\\user\\photo.png';
const newPath = 'C:\\Data\\Image\\user\\renamed.png';
const result = { old_path: oldPath, new_path: newPath, redirects: { [oldPath.replaceAll('\\', '/').toLowerCase()]: newPath } };
const flush = () => new Promise(resolve => setImmediate(resolve));
const i18n = { __esModule: true, default: { t: key => key } };
const toast = { useToastStore: { getState: () => ({ addToast() {} }) } };

test('rename synchronizes settings, covers and clean/dirty drafts without losing edits or changing plain text', async () => {
    paths.registerImageRenames({});
    const settings = create(() => ({ settings: { theme: 'dark', bgimage: { path: oldPath, opacity: 0.5 } } }));
    const files = create(() => ({ storyList: [{ cover: oldPath }, { cover: '#123456' }] }));
    const stories = create(() => ({ workspaces: { Story: { cover: oldPath, synopsisDraft: 'unsaved synopsis', synopsisIsEdited: true } } }));
    const dirty = { contentsInfo: { content_type: 'character' }, content: JSON.stringify({ imagePaths: [oldPath], notes: 'unsaved notes' }), isEdited: true, savedContentLength: 10 };
    const texts = create(() => ({ workspaces: {
        dirty, clean: { ...dirty, isEdited: false }, invalid: { ...dirty, content: '{unfinished' }, text: { ...dirty, contentsInfo: { content_type: 'txt' } },
    } }));
    const module = await load('./applyImageRename.js', {
        './saving/appSettings': { useAppSettings: settings }, './fileStore': { useFileStore: files },
        './storyStore': { useStoryStore: stories }, './txtStore': { useTxtStore: texts }, '../utils/imagePaths.js': paths,
    });
    try {
        module.applyImageRename(result);
        assert.deepEqual(settings.getState().settings.bgimage, { path: newPath, opacity: 0.5 });
        assert.deepEqual(files.getState().storyList.map(story => story.cover), [newPath, '#123456']);
        assert.equal(stories.getState().workspaces.Story.synopsisDraft, 'unsaved synopsis');
        const workspaces = texts.getState().workspaces;
        assert.equal(JSON.parse(workspaces.dirty.content).notes, 'unsaved notes');
        assert.deepEqual(JSON.parse(workspaces.dirty.content).imagePaths, [newPath]);
        assert.equal(workspaces.dirty.isEdited, true);
        assert.equal(workspaces.clean.isEdited, false);
        assert.equal(workspaces.clean.savedContentLength, workspaces.clean.content.length);
        assert.equal(workspaces.invalid.content, '{unfinished');
        assert.equal(workspaces.text.content, dirty.content);
        assert.deepEqual(paths.photoPaths([oldPath]), [newPath], 'open image-picker drafts follow redirects');
    } finally { paths.registerImageRenames({}); }
});

test('in-flight saves finish first; queued saves use the renamed image and preserve newer edits', async () => {
    paths.registerImageRenames({});
    let finishSave;
    const calls = [];
    let first = true;
    const dependencies = {
        './contentsInfo.js': contentModel,
        zustand: { create }, './imageReferenceWrites.js': gate, '../utils/imagePaths.js': paths,
        './languageController': i18n, '../store/toastStore': toast,
        './fileStore': { useFileStore: {} }, './saving/stats': { useStatsStore: { getState: () => ({}) } },
        '@tauri-apps/api/core': { invoke: async (command, args) => {
            calls.push({ command, args });
            if (first) { first = false; await new Promise(resolve => { finishSave = resolve; }); }
        } },
    };
    const { useTxtStore: texts } = await load('./txtStore.js', dependencies);
    const info = { content_type: 'character', name: 'Person', story_name: 'Story', access_id: 'person' };
    texts.getState().initWorkspace(info);
    texts.setState(state => ({ workspaces: { person: { ...state.workspaces.person, isLoading: false } } }));
    texts.getState().updateContent('person', JSON.stringify({ imagePaths: [oldPath], notes: 'first' }));
    const firstSave = texts.getState().saveContent('person');
    await flush();
    assert.equal(typeof finishSave, 'function');
    const rename = gate.withImageReferenceWrite(() => {
        paths.registerImageRenames(result.redirects);
        texts.setState(state => ({ workspaces: { person: { ...state.workspaces.person, content: paths.normalizeImageContent(state.workspaces.person.content) } } }));
        calls.push({ command: 'rename_user_image' });
    });
    texts.getState().updateContent('person', JSON.stringify({ imagePaths: [oldPath], notes: 'newer edit' }));
    const nextSave = texts.getState().saveContent('person');
    finishSave();
    try {
        await Promise.all([firstSave, rename, nextSave]);
        assert.deepEqual(calls.map(call => call.command), ['save_json_content', 'rename_user_image', 'save_json_content']);
        assert.deepEqual(calls[0].args.content.imagePaths, [oldPath]);
        assert.deepEqual(calls[2].args.content.imagePaths, [newPath]);
        assert.equal(calls[2].args.content.notes, 'newer edit');
        assert.equal(texts.getState().workspaces.person.isEdited, false);
    } finally { paths.registerImageRenames({}); }
});

test('image store updates its list only after committed renames, and failures leave it intact', async () => {
    paths.registerImageRenames(result.redirects);
    let failure = false, applied = 0;
    const { useImageStore: images } = await load('./imageStore.js', {
        zustand: { create }, './imageReferenceWrites.js': gate, '../utils/imagePaths.js': paths,
        './languageController': i18n, '../store/toastStore': toast,
        './applyImageRename.js': { applyImageRename() { applied++; } },
        '@tauri-apps/api/core': { invoke: async () => { if (failure) throw new Error('collision'); return { ...result, old_path: oldPath.replaceAll('\\', '/') }; } },
    });
    const image = { name: 'photo.png', path: oldPath, kind: 'user' };
    images.setState({ wholeImageList: [image] });
    await images.getState().renameUserImage(image, 'renamed.png');
    assert.equal(images.getState().wholeImageList[0].path, newPath);
    assert.equal(applied, 1);
    failure = true;
    await assert.rejects(images.getState().renameUserImage(images.getState().wholeImageList[0], 'other.png'), /collision/);
    assert.equal(images.getState().wholeImageList[0].name, 'renamed.png');
    assert.equal(applied, 1);
    await assert.rejects(images.getState().renameUserImage({ ...image, kind: 'preset' }, 'other.png'));
    paths.registerImageRenames({});
});

test('a pending recovery blocks later reference writes until restart', async () => {
    const { code } = await transform(await readFile(new URL('./imageReferenceWrites.js', import.meta.url), 'utf8'), { format: 'cjs' });
    const module = { exports: {} };
    new Function('module', 'exports', code)(module, module.exports);
    let wrote = false;
    module.exports.blockImageReferenceWrites(new Error('recovery pending'));
    await assert.rejects(module.exports.withImageReferenceWrite(() => { wrote = true; }), /recovery pending/);
    assert.equal(wrote, false);
});
