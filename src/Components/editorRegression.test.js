import * as contentModel from '../store/contentsInfo.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { photoPaths, validImagePaths } from '../utils/imagePaths.js';
import { validProperties } from './JSONBox/propertyTypes.js';

// Exercise the actual component handlers and effects with deferred IPC responses,
// without starting Tauri or touching user documents.
async function componentFixture(file, modules = {}) {
    const slots = [];
    let cursor, changed, effects, tree, props;
    const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
    const hooks = {
        useState(initial) {
            const index = cursor++;
            if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
            return [slots[index].value, update => {
                const value = typeof update === 'function' ? update(slots[index].value) : update;
                if (!Object.is(value, slots[index].value)) { slots[index].value = value; changed = true; }
            }];
        },
        useRef(initial) {
            const index = cursor++;
            return slots[index] ||= { current: initial };
        },
        useId() { return hooks.useRef('test-editor').current; },
        useEffect(effect, deps) {
            const index = cursor++;
            if (!sameDeps(slots[index]?.deps, deps)) {
                const previous = slots[index];
                slots[index] = { deps };
                effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
            }
        },
        useCallback(callback, deps) {
            const index = cursor++;
            if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { deps, callback };
            return slots[index].callback;
        },
    };
    const element = (type, props) => ({ type, props });
    hooks.createElement = element;
    const runtime = { jsx: element, jsxs: element, Fragment: 'fragment' };
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' });
    const module = { exports: {} };
    const require = name => {
        if (name.endsWith('/contentsInfo.js')) return contentModel;
        if (name === 'react') return hooks;
        if (name === 'react/jsx-runtime') return runtime;
        if (name === 'react-dom') return { createPortal: node => node };
        if (name === 'react-i18next') return { useTranslation: () => ({ t: key => key }) };
        if (name === 'framer-motion') return { motion: {}, AnimatePresence: 'presence' };
        if (name in modules) return modules[name];
        if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
        return new Proxy({ default: name }, { get: (target, key) => key === '__esModule' ? true : target[key] ?? key });
    };
    new Function('require', 'module', 'exports', code)(require, module, module.exports);
    return {
        render(nextProps = props) {
            props = nextProps;
            for (let pass = 0; pass < 20; pass++) {
                cursor = 0; changed = false; effects = [];
                tree = module.exports.default(props);
                effects.forEach(effect => effect());
                if (!changed) return tree;
            }
            throw new Error('Component did not settle');
        },
        dispose() { slots.forEach(slot => slot.cleanup?.()); },
    };
}

function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
        for (const child of node) { const result = find(child, predicate); if (result) return result; }
    } else {
        if (predicate(node)) return node;
        return find(node.props?.children, predicate);
    }
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('story list opens UUID descriptors and uses the same ID for backup history', async () => {
    const info = { story_name: 'Story', name: 'Chapter', access_id: 'de7187b7-27bd-4c69-85f0-29ad5dc23761', content_type: 'txt' };
    const tabs = [], calls = [];
    const fixture = await componentFixture('./Tab_view/Tab_Story/tab_story_contents.jsx', {
        '../../../store/tabStore': { useTabStore: () => ({ addTab: (...args) => tabs.push(args) }) },
        '../../../store/fileStore': { useFileStore: () => ({}) },
        '../../../store/storyStore': { useStoryStore: () => ({}) },
        '../../../store/txtStore': { useTxtStore: () => ({}) },
        '../../../store/toastStore': { useToastStore: { getState: () => ({ addToast() {} }) } },
        '@tauri-apps/api/core': { invoke: async (command, args) => { calls.push({ command, args }); return [{ content: 'body', generationIndex: 0 }]; } },
    });
    try {
        const props = { story_name: 'Story', workspace: { filesList: ['Chapter'], contentsList: [info] }, isAddDialogOpen: false, setIsAddDialogOpen() {} };
        const item = find(fixture.render(props), node => node.type === 'TN_ListItem');
        assert.equal(item.props.title, 'Chapter');
        item.props.onClick();
        assert.deepEqual(tabs[0], ['work', 'Chapter', { ...info, title: 'Chapter' }]);
        const menu = item.props.control;
        await menu.props.items[0].onClick();
        assert.deepEqual(calls[0], { command: 'get_backup_history', args: { contentsInfo: info } });
    } finally { fixture.dispose(); }
});

test('JSON history menu restores a selected revision through JSON save IPC and reloads the editor', async () => {
    const info = { story_name: 'Story', name: 'Sheep', access_id: 'de7187b7-27bd-4c69-85f0-29ad5dc23761', content_type: 'character' };
    const calls = [], loads = [];
    const old = { properties: { mood: 'calm', items: [1, 2] } };
    const current = { properties: { mood: 'sleepy', items: [2] } };
    const history = [old, current].map((value, index) => ({ content: JSON.stringify(value, null, 2), generationIndex: 0, generationCount: 1, timestamp: index + 1 }));
    const fixture = await componentFixture('./Tab_view/Tab_Story/tab_story_contents.jsx', {
        '../../../store/tabStore': { useTabStore: () => ({}) },
        '../../../store/fileStore': { useFileStore: () => ({}) },
        '../../../store/storyStore': { useStoryStore: () => ({}) },
        '../../../store/txtStore': { useTxtStore: { getState: () => ({ workspaces: { [info.access_id]: {} }, loadContent: async (...args) => loads.push(args) }) } },
        '../../../store/toastStore': { useToastStore: { getState: () => ({ addToast() {} }) } },
        '@tauri-apps/api/core': { invoke: async (command, args) => { calls.push({ command, args }); return command === 'get_backup_history' ? history : undefined; } },
    });
    try {
        const props = { story_name: 'Story', workspace: { filesList: [], contentsList: [info] }, isAddDialogOpen: false, setIsAddDialogOpen() {} };
        const item = find(fixture.render(props), node => node.type === 'TN_ListItem');
        assert.ok(item.props.control, 'JSON entries expose the backup menu');
        await item.props.control.props.items[0].onClick();
        const slider = find(fixture.render(), node => node.type === 'TN_Slider');
        slider.props.onChange(0);
        const restore = find(fixture.render(), node => node.type === 'TN_Button' && node.props.children === 'story.restore.submit');
        await restore.props.onClick();
        assert.deepEqual(calls.map(call => call.command), ['get_backup_history', 'increment_backup', 'save_json_content']);
        assert.deepEqual(calls[2].args.content, old);
        assert.equal(calls[2].args.contentsInfo.access_id, info.access_id);
        assert.deepEqual(loads[0][0], info);
    } finally { fixture.dispose(); }
});

test('synopsis Tiptap saves only on button or shortcut and retains drafts after leaving', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const previousWindow = globalThis.window;
    globalThis.window = new EventTarget();
    let fixture;
    try {
        let workspace = { synopsis: 'saved', synopsisDraft: 'saved', synopsisIsEdited: false };
        let options;
        const saves = [];
        const store = {
            workspaces: { Story: workspace },
            updateSynopsis(_name, content) {
                workspace = { ...workspace, synopsisDraft: content, synopsisIsEdited: content !== workspace.synopsis };
                store.workspaces.Story = workspace;
            },
            async saveSynopsis(name) { saves.push({ name, content: workspace.synopsisDraft }); },
        };
        const editor = { state: { doc: 'saved' }, view: { composing: false }, isEmpty: false,
            commands: { setContent(content) { editor.state.doc = content; } } };
        fixture = await componentFixture('./Tab_view/Tab_Story/SynopsisEditor.jsx', {
            '../../../store/storyStore': { useStoryStore: selector => selector(store) },
            '../../../store/saving/appSettings': { useAppSettings: selector => selector({ settings: { fontSize: 18 } }) },
            '@tiptap/react': { useEditor: config => { options = config; return editor; }, EditorContent: 'editor' },
            '../../TextBox/plainTextEditor': { textToDocument: content => content, documentToText: doc => doc },
        });
        fixture.render({ storyName: 'Story' });
        const update = content => { editor.state.doc = content; options.onUpdate({ editor }); fixture.render(); };
        update('draft');
        t.mock.timers.tick(10000);
        options.onBlur?.({ editor });
        assert.equal(saves.length, 0, 'idle and blur must not save');
        const button = find(fixture.render(), node => node.type === 'button');
        button.props.onClick();
        assert.deepEqual(saves[0], { name: 'Story', content: 'draft' });
        update('manual shortcut draft');
        const event = new Event('save-story-synopsis');
        event.detail = { storyName: 'Story' };
        window.dispatchEvent(event);
        assert.equal(saves[1].content, 'manual shortcut draft');
        update('retained draft');
        fixture.dispose(); fixture = null;
        assert.equal(saves.length, 2, 'tab removal must not save');
        assert.equal(store.workspaces.Story.synopsisDraft, 'retained draft');
        window.dispatchEvent(event);
        assert.equal(saves.length, 2, 'removed tab unregisters its shortcut');
    } finally { fixture?.dispose(); globalThis.window = previousWindow; }
});

test('title IME does not commit, and Enter followed by blur renames exactly once', async () => {
    const previousWindow = globalThis.window;
    globalThis.window = new EventTarget();
    let fixture;
    try {
        const renamed = [], editing = [];
        let blurred = 0;
        fixture = await componentFixture('./TextBox/textbox.jsx', {
            '@tiptap/react': { useEditor: () => null, EditorContent: 'editor' },
            './plainTextEditor': { textToDocument: text => text },
            './searchHighlight': { SearchHighlight: { configure: () => ({}) } },
        });
        const props = { workspaceId: 'Story/File', title: 'old', content: '', isTitleEdible: true,
            setIsTitleEdible: value => editing.push(value), onRename: title => renamed.push(title) };
        const titleInput = tree => find(tree, node => node.type === 'input' && node.props.onBlur);
        titleInput(fixture.render(props)).props.onChange({ target: { value: 'new title' } });
        const input = titleInput(fixture.render());
        for (const key of ['Enter', 'Escape']) {
            for (const event of [{ nativeEvent: { isComposing: true } }, { isComposing: true }, { keyCode: 229 }, { nativeEvent: { keyCode: 229 } }]) {
                input.props.onKeyDown({ key, target: { blur: () => blurred++ }, ...event });
            }
        }
        assert.deepEqual(renamed, []);
        assert.deepEqual(editing, []);
        assert.equal(blurred, 0);
        input.props.onKeyDown({ key: 'Enter', nativeEvent: { isComposing: false }, target: {
            blur: () => { blurred++; input.props.onBlur(); },
        } });
        assert.deepEqual(renamed, ['new title']);
        assert.deepEqual(editing, [false]);
        assert.equal(blurred, 1);

        const nextInput = titleInput(fixture.render({ ...props, title: 'new title' }));
        nextInput.props.onChange({ target: { value: 'another title' } });
        titleInput(fixture.render()).props.onBlur();
        assert.deepEqual(renamed, ['new title', 'another title'], 'ordinary blur still commits');
    } finally { fixture?.dispose(); globalThis.window = previousWindow; }
});

test('character count follows asynchronous loading, edits, and external body updates', async () => {
    const state = {
        workspaces: {}, initWorkspace() {}, loadContent() {},
        updateContent(id, content) { this.workspaces[id] = { ...this.workspaces[id], content }; },
    };
    state.updateContent = state.updateContent.bind(state);
    const useTxtStore = Object.assign(() => state, { getState: () => state });
    const fixture = await componentFixture('./Tab_view/Tab_Work/tab_work.jsx', {
        '../../../store/txtStore': { useTxtStore },
        '../../../store/fileStore': { useFileStore: () => ({}) },
        '../../../store/storyStore': { useStoryStore: () => ({}) },
        '../../../store/tabStore': { useTabStore: () => ({}) },
        '../../../store/saving/appSettings': { useAppSettings: () => ({ settings: {} }) },
        '@tauri-apps/api/event': { listen: async () => () => {} },
    });
    try {
        fixture.render({ story_name: 'Story', title: 'File', access_id: 'file-id' });
        state.workspaces['file-id'] = { title: 'File', content: '羊\nabc' };
        let tree = fixture.render();
        assert.equal(tree.props.charLength, '羊\nabc'.length);
        tree.props.onChangeContent('羊');
        assert.equal(fixture.render().props.charLength, 1);
        state.workspaces['file-id'].content = 'restored body';
        assert.equal(fixture.render().props.charLength, 13);
        state.workspaces['file-id'].content = '';
        assert.equal(fixture.render().props.charLength, 0);
    } finally { fixture.dispose(); }
});

test('app close waits for synopsis saving and then allows a clean close', async () => {
    let onClose, completeSave, closeCalls = 0;
    const workspace = { synopsisIsEdited: true, synopsisIsSaving: true };
    const appWindow = {
        onCloseRequested(callback) { onClose = callback; return Promise.resolve(() => {}); },
        async close() {
            let prevented = false;
            await onClose({ preventDefault() { prevented = true; } });
            if (!prevented) closeCalls++;
        },
    };
    const fixture = await componentFixture('../store/appTerminateController.js', {
        '@tauri-apps/api/window': { getCurrentWindow: () => appWindow },
        './tabStore': { useTabStore: { getState: () => ({ tabsList: [] }) } },
        './txtStore': { useTxtStore: { getState: () => ({ workspaces: {} }) } },
        './storyStore': { useStoryStore: { getState: () => ({ workspaces: { Story: workspace },
            waitForSynopsisSaves: () => new Promise(resolve => { completeSave = () => { workspace.synopsisIsEdited = false; workspace.synopsisIsSaving = false; resolve(); }; }),
        }) } },
    });
    try {
        fixture.render({});
        let prevented = false;
        const closing = onClose({ preventDefault() { prevented = true; } });
        assert.equal(prevented, true);
        assert.equal(closeCalls, 0);
        completeSave();
        await closing;
        assert.equal(closeCalls, 1);
    } finally { fixture.dispose(); }
});

test('unsaved synopsis at app close shows a cancelable dialog without saving', async (t) => {
    t.mock.method(console, 'error', () => {});
    let onClose, closeCalls = 0;
    const fixture = await componentFixture('../store/appTerminateController.js', {
        '@tauri-apps/api/window': { getCurrentWindow: () => ({
            onCloseRequested(callback) { onClose = callback; return Promise.resolve(() => {}); },
            async close() { closeCalls++; },
        }) },
        './tabStore': { useTabStore: { getState: () => ({ tabsList: [] }) } },
        './txtStore': { useTxtStore: { getState: () => ({ workspaces: {} }) } },
        './storyStore': { useStoryStore: { getState: () => ({ workspaces: { Story: { synopsisIsEdited: true } },
            async waitForSynopsisSaves() { throw new Error('must not save a dirty draft'); },
        }) } },
        './languageController': { __esModule: true, default: { t: () => 'Synopsis' } },
    });
    try {
        fixture.render({});
        let prevented = false;
        await onClose({ preventDefault() { prevented = true; } });
        const dialog = fixture.render();
        assert.equal(prevented, true);
        assert.equal(closeCalls, 0);
        assert.equal(dialog.props.isOpen, true);
        assert.deepEqual(dialog.props.files, ['Story / Synopsis']);
        dialog.props.onCancel();
        assert.equal(fixture.render().props.isOpen, false);
    } finally { fixture.dispose(); }
});

test('all JSON editors save image registrations without treating them as user properties', async () => {
    for (const contentType of ['character', 'world', 'entity']) {
        let content = JSON.stringify({ summary: 'keep summary', role: 'keeper', notes: 'keep notes', imagePaths: ['a.png'] });
        const saves = [];
        const fixture = await componentFixture('./JSONBox/jsonbox.jsx', {
            './propertyTypes.js': { validProperties },
            '../../utils/imagePaths.js': { photoPaths, validImagePaths },
            '../../assets/CharacterPhoto.jsx': { __esModule: true, default: 'object-photo' },
            '../../assets/WorldPhoto.jsx': { __esModule: true, default: 'object-photo' },
            '../../assets/EntityPhoto.jsx': { __esModule: true, default: 'object-photo' },
            './PropertyEditor.jsx': { __esModule: true, default: 'property-editor' },
            '../Dialog/ObjectImagesDialog.jsx': { __esModule: true, default: 'images-dialog' },
        });
        try {
            const props = { workspaceId: `Story/${contentType}`, title: contentType, content, contentType,
                onChangeContent: next => { content = next; }, onSaveClick: async () => saves.push(JSON.parse(content)) };
            let tree = fixture.render(props);
            const properties = find(tree, node => node.type === 'property-editor');
            assert.deepEqual(properties.props.properties, { role: 'keeper' });
            assert.ok(properties.props.reservedNames.includes('imagePaths'));
            find(tree, node => node.type === 'object-photo').props.onClick();
            const dialog = find(fixture.render(), node => node.type === 'images-dialog');
            await dialog.props.onApply(['a.png', 'b.png', 'c.png']);
            assert.deepEqual(saves[0], { summary: 'keep summary', role: 'keeper', notes: 'keep notes', imagePaths: ['a.png', 'b.png', 'c.png'] });
            await assert.rejects(dialog.props.onApply(['a', 'b', 'c', 'd']));
            assert.equal(saves.length, 1);
        } finally { fixture.dispose(); }
    }
});

test('image dialog blocks overlapping imports and a fourth registration, then permits replacement', async () => {
    const previousDocument = globalThis.document;
    globalThis.document = { body: {}, activeElement: null };
    let fixture;
    try {
        let choose, opens = 0, closes = 0;
        const saved = [];
        const store = { wholeImageList: ['a', 'b', 'c', 'd'].map(path => ({ path, name: path, kind: 'user' })),
            fetchImageList: async () => {}, addUserImage: async () => ({ path: 'c' }) };
        fixture = await componentFixture('./Dialog/ObjectImagesDialog.jsx', {
            '../../store/imageStore': { useImageStore: selector => selector(store) },
            '../../utils/imagePaths.js': { MAX_OBJECT_IMAGES: 3, photoPaths, validImagePaths },
            '../../assets/photoImages.js': { photoSource: path => path },
            '@tauri-apps/plugin-dialog': { open: () => { opens++; return new Promise(resolve => { choose = resolve; }); } },
        });
        const props = { name: 'Object', imagePaths: ['a', 'b'], onApply: async paths => saved.push(paths), onClose: () => closes++ };
        const importButton = tree => find(tree, node => node.type === 'TN_Button' && Array.isArray(node.props.children));
        const saveButton = tree => find(tree, node => node.type === 'TN_Button' && node.props.children === 'editor.save');
        let tree = fixture.render(props);
        await flush(); tree = fixture.render();
        const pending = importButton(tree).props.onClick();
        await importButton(tree).props.onClick();
        assert.equal(opens, 1, 'a stale handler must not launch another native picker');
        find(fixture.render(), node => node.type === 'TN_Dialog').props.onClose();
        assert.equal(closes, 0, 'keep the dialog alive while importing');
        choose('source.png'); await pending;
        tree = fixture.render();
        assert.equal(importButton(tree).props.disabled, true);
        // At the cap, the collection entry button must be disabled too.
        assert.equal(find(tree, node => node.type === 'TN_Button' && node.props.children === 'objectImages.collection').props.disabled, true);
        await saveButton(fixture.render()).props.onClick();
        assert.deepEqual(saved[0], ['a', 'b', 'c']);
        find(tree, node => node.type === 'TN_IconButton').props.onClick();
        tree = fixture.render();
        assert.equal(importButton(tree).props.disabled, false);
        find(tree, node => node.type === 'TN_Button' && node.props.children === 'objectImages.collection').props.onClick();
        tree = fixture.render();
        const picker = find(tree, node => node.type === './ImageCollectionPicker');
        assert.equal(picker.props.isImageDisabled({ path: 'd' }), false);
        picker.props.onSelect('d');
        tree = fixture.render();
        find(tree, node => node.type === 'TN_Button' && node.props.children === 'objectImages.done').props.onClick();
        await saveButton(fixture.render()).props.onClick();
        assert.deepEqual(saved[1], ['b', 'c', 'd']);
    } finally { fixture?.dispose(); globalThis.document = previousDocument; }
});

test('image dialog retains its draft after a failed save and cancel never applies it', async () => {
    const previousDocument = globalThis.document;
    globalThis.document = { body: {}, activeElement: null };
    let fixture;
    try {
        let saves = 0, closes = 0;
        const store = { wholeImageList: [], fetchImageList: async () => {} };
        fixture = await componentFixture('./Dialog/ObjectImagesDialog.jsx', {
            '../../store/imageStore': { useImageStore: selector => selector(store) },
            '../../utils/imagePaths.js': { MAX_OBJECT_IMAGES: 3, photoPaths, validImagePaths },
            '../../assets/photoImages.js': { photoSource: path => path },
        });
        fixture.render({ name: 'Object', imagePaths: ['a'], onClose: () => closes++, onApply: async () => { saves++; throw new Error('disk full'); } });
        await flush();
        const save = tree => find(tree, node => node.type === 'TN_Button' && node.props.children === 'editor.save');
        await save(fixture.render()).props.onClick();
        let tree = fixture.render();
        assert.equal(closes, 0);
        assert.match(find(tree, node => node.props?.role === 'alert').props.children, /disk full/);
        assert.equal(find(tree, node => node.type === 'img').props.src, 'a');
        find(tree, node => node.type === 'TN_IconButton').props.onClick();
        tree = fixture.render();
        find(tree, node => node.type === 'TN_Button' && node.props.children === 'common.cancel').props.onClick();
        assert.equal(closes, 1);
        assert.equal(saves, 1, 'cancelling a removal must not apply a new draft');
    } finally { fixture?.dispose(); globalThis.document = previousDocument; }
});

test('all photo carousels reset after removal and never show a fourth image', async () => {
    for (const kind of ['Character', 'World', 'Entity']) {
        const fixture = await componentFixture(`../assets/${kind}Photo.jsx`, {
            '../utils/imagePaths.js': { photoPaths },
            [`./${kind}Node.jsx`]: { __esModule: true, default: 'photo-node' },
        });
        try {
            const props = { name: kind, imagePaths: ['a', 'b', 'c', 'd'] };
            let tree = fixture.render(props);
            const next = tree => find(tree, node => node.type === 'button' && node.props['aria-label'] === 'objectImages.next');
            const photo = tree => find(tree, node => node.type === 'photo-node');
            assert.equal(photo(tree).props.imageTransitionKey, 0);
            next(tree).props.onClick();
            tree = fixture.render();
            assert.equal(photo(tree).props.imagePath, 'b');
            assert.equal(photo(tree).props.previousImagePath, 'a', 'keep the outgoing image for the slide');
            assert.equal(photo(tree).props.imageTransitionKey, 1);
            next(tree).props.onClick();
            tree = fixture.render();
            assert.equal(photo(tree).props.imagePath, 'c');
            assert.equal(photo(tree).props.previousImagePath, 'b');
            assert.equal(photo(tree).props.imageTransitionKey, 2, 'each switch must restart the animation');
            next(tree).props.onClick();
            assert.equal(photo(fixture.render()).props.imagePath, 'a');
            tree = fixture.render({ ...props, imagePaths: ['b'] });
            assert.equal(photo(tree).props.imagePath, 'b');
            assert.equal(photo(tree).props.previousImagePath, '');
            assert.equal(next(tree).props.disabled, true);
        } finally { fixture.dispose(); }
    }
});


test('tab close checks the UUID draft when different resources have the same title', async () => {
    const previousWindow = globalThis.window;
    globalThis.window = new EventTarget();
    let fixture;
    const tabs = [
        { id: 'tab-text', type: 'work', title: 'Same', props: { story_name: 'Story', title: 'Same', access_id: 'text-uuid' } },
        { id: 'tab-world', type: 'work', title: 'Same', props: { story_name: 'Story', title: 'Same', access_id: 'world-uuid' } },
    ];
    const closed = [];
    const state = { appMode: 'workspace', tabsList: tabs, selectedIndex: 1,
        closeTab: index => closed.push(index), setAppMode() {}, setSelectedIndex() {}, reorderTabs() {} };
    const tabStore = () => state;
    tabStore.getState = () => state;
    try {
        fixture = await componentFixture('./Workspace/WorkspaceTabs.jsx', {
            '../../store/tabStore': { useTabStore: tabStore },
            '../../store/txtStore': { useTxtStore: { getState: () => ({ workspaces: {
                'text-uuid': { isEdited: false }, 'world-uuid': { isEdited: true },
            } }) } },
            '@dnd-kit/core': { useSensors: () => [], useSensor() {}, DndContext: 'DndContext' },
            './workspaceTabTypes': { workspaceTabTypes: { work: {} } },
        });
        fixture.render({});
        const request = index => { const event = new Event('request-close-tab'); event.detail = { index }; window.dispatchEvent(event); };
        request(1);
        let tree = fixture.render();
        let dialog = find(tree, node => node.type === '../TNDesignSystem/TN_Dialog');
        assert.equal(dialog.props.isOpen, true);
        assert.deepEqual(closed, []);
        dialog.props.onClose();
        tree = fixture.render();
        request(0);
        assert.deepEqual(closed, [0]);
    } finally { fixture?.dispose(); globalThis.window = previousWindow; }
});

test('app close finds unsaved work by UUID after renaming and with same-name tabs', async () => {
    let onClose;
    const fixture = await componentFixture('../store/appTerminateController.js', {
        '@tauri-apps/api/window': { getCurrentWindow: () => ({
            onCloseRequested(callback) { onClose = callback; return Promise.resolve(() => {}); },
        }) },
        './tabStore': { useTabStore: { getState: () => ({ tabsList: [
            { type: 'work', props: { access_id: 'text-uuid', story_name: 'Story', title: 'Same' } },
            { type: 'work', props: { access_id: 'world-uuid', story_name: 'Story', title: 'Same' } },
        ] }) } },
        './txtStore': { useTxtStore: { getState: () => ({ workspaces: {
            'text-uuid': { story_name: 'Story', title: 'Renamed text', isEdited: true },
            'world-uuid': { story_name: 'Story', title: 'Same', isEdited: false },
        } }) } },
        './storyStore': { useStoryStore: { getState: () => ({ workspaces: {} }) } },
    });
    try {
        fixture.render({});
        let prevented = false;
        await onClose({ preventDefault() { prevented = true; } });
        assert.equal(prevented, true);
        assert.deepEqual(fixture.render().props.files, ['Story / Renamed text']);
    } finally { fixture.dispose(); }
});
