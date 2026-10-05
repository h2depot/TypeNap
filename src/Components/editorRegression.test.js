import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

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
        fixture.render({ story_name: 'Story', title: 'File' });
        state.workspaces['Story/File'] = { title: 'File', content: '羊\nabc' };
        let tree = fixture.render();
        assert.equal(tree.props.charLength, '羊\nabc'.length);
        tree.props.onChangeContent('羊');
        assert.equal(fixture.render().props.charLength, 1);
        state.workspaces['Story/File'].content = 'restored body';
        assert.equal(fixture.render().props.charLength, 13);
        state.workspaces['Story/File'].content = '';
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
