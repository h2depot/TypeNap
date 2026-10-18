import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { create } from 'zustand';
import * as gallery from './imageGallery.js';
import { normalizeImagePath } from '../../../utils/imagePaths.js';
import { withImageReferenceWrite } from '../../../store/imageReferenceWrites.js';

// Exercise real component handlers with in-memory IPC; never delete user files.
async function componentModule(file, modules = {}) {
    let active;
    const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
    const hooks = {
        useState(initial) {
            const context = active, index = context.cursor++;
            const slot = context.slots[index] ||= { value: typeof initial === 'function' ? initial() : initial };
            return [slot.value, update => {
                const value = typeof update === 'function' ? update(slot.value) : update;
                if (!Object.is(value, slot.value)) { slot.value = value; context.changed = true; }
            }];
        },
        useRef(value) { return active.slots[active.cursor++] ||= { current: value }; },
        useMemo(factory, deps) {
            const index = active.cursor++;
            if (!sameDeps(active.slots[index]?.deps, deps)) active.slots[index] = { deps, value: factory() };
            return active.slots[index].value;
        },
        useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
        useEffect(effect, deps) {
            const context = active, index = context.cursor++;
            if (!sameDeps(context.slots[index]?.deps, deps)) {
                const previous = context.slots[index];
                const slot = context.slots[index] = { deps };
                context.effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
            }
        },
        useLayoutEffect(effect, deps) { hooks.useEffect(effect, deps); },
    };
    const element = (type, props, key) => {
        if (typeof type === 'string' && props?.ref) props.ref.current ||= { getBoundingClientRect: () => ({ width: 800 }), querySelector: () => null };
        return { type, props, key };
    };
    const { code } = await transform(await readFile(new URL(file, import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' });
    const module = { exports: {} };
    const require = name => {
        if (name === 'react') return hooks;
        if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element };
        if (name === 'react-dom') return { createPortal: node => node };
        if (name === 'react-i18next') return { useTranslation: () => ({ t: key => key, i18n: { language: 'ja' } }) };
        if (name in modules) return modules[name];
        if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
        if (name.endsWith('IconList') || name.endsWith('TNDesignSystem')) return new Proxy({}, { get: (_, key) => String(key) });
        throw new Error(`Missing test dependency: ${name}`);
    };
    class ResizeObserver { observe() {} disconnect() {} }
    new Function('require', 'module', 'exports', 'ResizeObserver', code)(require, module, module.exports, ResizeObserver);
    return {
        exports: module.exports,
        create(exportName = 'default') {
            const context = { slots: [] };
            let props, tree;
            return {
                render(nextProps = props) {
                    props = nextProps;
                    for (let pass = 0; pass < 20; pass++) {
                        active = context; context.cursor = 0; context.changed = false; context.effects = [];
                        tree = module.exports[exportName](props);
                        context.effects.forEach(effect => effect());
                        if (!context.changed) return tree;
                    }
                    throw new Error('Component did not settle');
                },
                dispose() { context.slots.forEach(slot => slot.cleanup?.()); },
            };
        },
    };
}

function all(node, predicate) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(child => all(child, predicate));
    return [...(predicate(node) ? [node] : []), ...all(node.props?.children, predicate)];
}
const find = (tree, predicate) => all(tree, predicate)[0];
const checkboxes = tree => all(tree, node => node.type === 'input' && node.props.type === 'checkbox');
const action = (tree, label) => find(tree, node => node.props?.['aria-label'] === label);
const confirmation = tree => find(tree, node => node.type === 'ImageDeleteDialog');
const preview = tree => find(tree, node => node.type === 'ImagePreview');
const flush = () => new Promise(resolve => setImmediate(resolve));
const collection = () => [
    { name: 'a.png', path: '/user/a.png', kind: 'user' },
    { name: 'b.png', path: '/user/b.png', kind: 'user' },
    { name: 'a.png', path: '/presets/a.png', kind: 'preset' },
];

async function viewFixture(remove = async () => {}) {
    const calls = [], settingsCalls = [];
    const store = {
        wholeImageList: collection(),
        renameUserImage: async (image, newName) => {
            const result = { old_path: image.path, new_path: `/user/${newName}` };
            store.wholeImageList = store.wholeImageList.map(item => item.path === image.path ? { ...item, name: newName, path: result.new_path } : item);
            return result;
        },
        fetchImageList: async () => store.wholeImageList,
        addUserImage: async () => {},
        deleteUserImage: async name => {
            calls.push(name);
            await remove(name);
            store.wholeImageList = store.wholeImageList.filter(image => image.kind !== 'user' || image.name !== name);
        },
    };
    const settings = { settings: { bgimage: { path: '/user/a.png' } }, updateSetting: async (...args) => settingsCalls.push(args) };
    const module = await componentModule('./ImageView.jsx', {
        '../../../store/imageStore': { useImageStore: selector => selector(store) },
        '../../../store/saving/appSettings': { useAppSettings: { getState: () => settings } },
        '../../../utils/imagePaths.js': { normalizeImagePath },
        '../../../assets/photoImages.js': { photoSource: path => path },
        '@tauri-apps/plugin-dialog': { open: async () => null },
        './imageGallery.js': gallery,
        './ImageDialogs.jsx': { ImagePreview: 'ImagePreview', ImageDeleteDialog: 'ImageDeleteDialog', ImageRenameDialog: 'ImageRenameDialog' },
    });
    const fixture = module.create();
    fixture.render(); await flush();
    return { fixture, calls, settingsCalls, store };
}

test('checkbox starts selection mode, card clicks add selections, and Escape exits', async () => {
    const { fixture } = await viewFixture();
    try {
        let tree = fixture.render();
        assert.equal(find(tree, node => node.props?.role === 'toolbar'), undefined);
        checkboxes(tree).find(node => !node.props.disabled).props.onChange();
        tree = fixture.render();
        assert.ok(find(tree, node => node.props?.role === 'toolbar'));
        const controls = find(tree, node => node.props?.className === 'controls');
        assert.deepEqual(controls.props.children.map(node => node.props.className), ['search', 'selectionSpace', 'rightControls']);
        assert.equal(find(controls, node => node.type === 'TN_TextField').props.icon.type, 'PageSearch');
        assert.ok(find(controls.props.children[1], node => node.props?.role === 'toolbar'));
        assert.ok(find(controls.props.children[2], node => node.type === 'TN_Dropdown'));
        assert.equal(action(tree, 'imageLibrary.clearSelection').type, 'button');
        assert.equal(preview(tree), undefined, 'checking an image never opens its preview');
        action(tree, 'imageLibrary.selectImage').props.onClick();
        tree = fixture.render();
        assert.equal(checkboxes(tree).filter(node => node.props.checked).length, 2);
        tree.props.onKeyDown({ key: 'Escape', stopPropagation() {} });
        tree = fixture.render();
        assert.equal(checkboxes(tree).filter(node => node.props.checked).length, 0);
        assert.equal(find(tree, node => node.props?.role === 'toolbar'), undefined);
    } finally { fixture.dispose(); }
});

test('bulk deletion requires confirmation; cancel keeps the selection and files', async () => {
    const { fixture, calls } = await viewFixture();
    try {
        checkboxes(fixture.render()).filter(node => !node.props.disabled).forEach(node => node.props.onChange());
        action(fixture.render(), 'imageLibrary.deleteSelected').props.onClick();
        let dialog = confirmation(fixture.render());
        assert.equal(dialog.props.images.length, 2);
        assert.deepEqual(calls, []);
        dialog.props.onClose();
        let tree = fixture.render();
        assert.equal(confirmation(tree), undefined);
        assert.equal(checkboxes(tree).filter(node => node.props.checked).length, 2);
        action(tree, 'imageLibrary.deleteSelected').props.onClick();
        dialog = confirmation(fixture.render());
        await dialog.props.onConfirm();
        tree = fixture.render();
        assert.deepEqual(calls, ['a.png', 'b.png']);
        assert.equal(checkboxes(tree).length, 0);
        assert.equal(all(tree, node => node.props?.role === 'listitem').length, 1, 'the preset with the same filename remains');
        assert.equal(confirmation(tree), undefined);
        assert.equal(find(tree, node => node.props?.role === 'toolbar'), undefined);
    } finally { fixture.dispose(); }
});

test('preview deletion opens a second dialog and cancel returns to the same preview', async () => {
    const { fixture, calls, settingsCalls } = await viewFixture();
    try {
        const firstItem = find(fixture.render(), node => node.props?.role === 'listitem' && node.key === '/user/a.png');
        find(firstItem, node => node.type === 'button').props.onClick();
        preview(fixture.render()).props.onDelete();
        let tree = fixture.render();
        assert.equal(preview(tree).props.inactive, true);
        preview(tree).props.onClose();
        assert.ok(preview(fixture.render()), 'closing dialogs must not close the preview behind confirmation');
        confirmation(tree).props.onClose();
        tree = fixture.render();
        assert.equal(preview(tree).props.image.path, '/user/a.png');
        assert.equal(preview(tree).props.inactive, false);
        assert.deepEqual(calls, []);
        preview(tree).props.onDelete();
        await confirmation(fixture.render()).props.onConfirm();
        tree = fixture.render();
        assert.deepEqual(calls, ['a.png']);
        assert.deepEqual(settingsCalls, [['bgimage', {}]]);
        assert.equal(preview(tree), undefined);
        assert.equal(confirmation(tree), undefined);
    } finally { fixture.dispose(); }
});

test('partial failure keeps only failed images selected and retries only those files', async () => {
    let fail = true;
    const { fixture, calls } = await viewFixture(async name => { if (fail && name === 'b.png') throw new Error('locked'); });
    try {
        checkboxes(fixture.render()).filter(node => !node.props.disabled).forEach(node => node.props.onChange());
        action(fixture.render(), 'imageLibrary.deleteSelected').props.onClick();
        await confirmation(fixture.render()).props.onConfirm();
        let tree = fixture.render();
        assert.deepEqual(confirmation(tree).props.images.map(image => image.name), ['b.png']);
        assert.match(confirmation(tree).props.error, /locked/);
        assert.equal(checkboxes(tree).filter(node => node.props.checked).length, 1);
        fail = false;
        await confirmation(tree).props.onConfirm();
        assert.deepEqual(calls, ['a.png', 'b.png', 'b.png']);
        assert.equal(confirmation(fixture.render()), undefined);
    } finally { fixture.dispose(); }
});

test('pending deletion blocks duplicate submissions and dismissal', async () => {
    let finish;
    const { fixture, calls } = await viewFixture(() => new Promise(resolve => { finish = resolve; }));
    try {
        checkboxes(fixture.render()).find(node => !node.props.disabled).props.onChange();
        action(fixture.render(), 'imageLibrary.deleteSelected').props.onClick();
        const pending = confirmation(fixture.render()).props.onConfirm();
        let dialog = confirmation(fixture.render());
        assert.equal(dialog.props.deleting, true);
        dialog.props.onClose();
        await dialog.props.onConfirm();
        assert.ok(confirmation(fixture.render()));
        assert.equal(calls.length, 1);
        finish(); await pending;
        assert.equal(confirmation(fixture.render()), undefined);
    } finally { fixture.dispose(); }
});

test('presets never display a selection control and cannot be deleted through a stale handler', async () => {
    const { fixture, calls } = await viewFixture();
    try {
        let tree = fixture.render();
        assert.equal(checkboxes(find(tree, node => node.key === '/presets/a.png')).length, 0);
        checkboxes(tree)[0].props.onChange();
        tree = fixture.render();
        const preset = find(tree, node => node.key === '/presets/a.png');
        assert.equal(checkboxes(preset).length, 0, 'selection mode also hides the preset checkbox');
        find(preset, node => node.type === 'button').props.onClick();
        preview(fixture.render()).props.onDelete();
        assert.equal(confirmation(fixture.render()), undefined);
        assert.deepEqual(calls, []);
    } finally { fixture.dispose(); }
});

test('preview and confirmation render delete controls with disabled states', async () => {
    const module = await componentModule('./ImageDialogs.jsx', { '../../../assets/photoImages.js': { photoSource: path => path } });
    const image = module.create('ImagePreview'), dialog = module.create('ImageDeleteDialog');
    try {
        let tree = image.render({ image: collection()[0], busy: false, onClose() {}, onDelete() {} });
        assert.equal(action(tree, 'common.delete').props.disabled, false);
        tree = image.render({ image: collection()[2], busy: false, onClose() {}, onDelete() {} });
        assert.equal(action(tree, 'common.delete').props.disabled, true);
        tree = dialog.render({ images: collection().slice(0, 2), deleting: true, error: '', onClose() {}, onConfirm() {} });
        const controls = all(tree, node => node.type === 'TN_Button');
        assert.equal(controls.length, 2);
        assert.ok(controls.every(node => node.props.disabled));
    } finally { image.dispose(); dialog.dispose(); }
});

test('preview rename cancels without a write and updates the preview after confirmation', async () => {
    const { fixture } = await viewFixture();
    const rename = tree => find(tree, node => node.type === 'ImageRenameDialog');
    try {
        const item = find(fixture.render(), node => node.key === '/user/a.png');
        find(item, node => node.type === 'button').props.onClick();
        preview(fixture.render()).props.onRename();
        let tree = fixture.render();
        assert.ok(rename(tree));
        const keyedChildren = tree.props.children.flat().filter(node => node?.key != null);
        assert.equal(new Set(keyedChildren.map(node => node.key)).size, keyedChildren.length,
            'preview and rename dialogs need distinct sibling keys or React leaves stale portals behind');
        assert.equal(preview(tree).props.inactive, true);
        rename(tree).props.onClose();
        tree = fixture.render();
        assert.equal(rename(tree), undefined);
        assert.equal(preview(tree).props.inactive, false);
        assert.equal(preview(tree).props.image.name, 'a.png');
        preview(tree).props.onRename();
        await rename(fixture.render()).props.onConfirm('new.png');
        tree = fixture.render();
        assert.equal(rename(tree), undefined);
        assert.equal(preview(tree).props.image.name, 'new.png');
        assert.equal(preview(tree).props.inactive, false);
        assert.ok(find(tree, node => node.key === '/user/new.png'));
        preview(tree).props.onClose();
        assert.equal(preview(fixture.render()), undefined, 'the remaining preview still closes after renaming');
    } finally { fixture.dispose(); }
});

test('rename form preserves the extension and disables submission while renaming', async () => {
    const module = await componentModule('./ImageDialogs.jsx', { '../../../assets/photoImages.js': { photoSource: path => path } });
    const fixture = module.create('ImageRenameDialog');
    const names = [];
    const props = { image: collection()[0], renaming: false, onClose() {}, onConfirm: name => names.push(name) };
    try {
        let tree = fixture.render(props);
        find(tree, node => node.type === 'TN_TextField').props.onChange({ target: { value: 'renamed' } });
        find(fixture.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} });
        assert.deepEqual(names, ['renamed.png']);
        tree = fixture.render({ ...props, renaming: true });
        assert.ok(all(tree, node => node.type === 'TN_Button').every(node => node.props.disabled));
        find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
        assert.equal(names.length, 1);
    } finally { fixture.dispose(); }
});

test('image store removes only successful user deletions, preserving failed files and same-name presets', async () => {
    let fail = false;
    const { code } = await transform(await readFile(new URL('../../../store/imageStore.js', import.meta.url), 'utf8'), { format: 'cjs' });
    const module = { exports: {} };
    const dependencies = {
        './imageReferenceWrites.js': { withImageReferenceWrite },
        './applyImageRename.js': { applyImageRename() {} },
        '../utils/imagePaths.js': { normalizeImagePath },
        zustand: { create },
        '@tauri-apps/api/core': { invoke: async () => { if (fail) throw new Error('locked'); } },
        '../store/toastStore': { useToastStore: { getState: () => ({ addToast() {} }) } },
        './languageController': { __esModule: true, default: { t: key => key } },
    };
    new Function('require', 'module', 'exports', 'console', code)(name => dependencies[name], module, module.exports, { error() {} });
    const store = module.exports.useImageStore;
    store.setState({ wholeImageList: collection() });
    await store.getState().deleteUserImage('a.png');
    assert.deepEqual(store.getState().wholeImageList.map(image => image.path), ['/user/b.png', '/presets/a.png']);
    fail = true;
    await assert.rejects(store.getState().deleteUserImage('b.png'), /locked/);
    assert.equal(store.getState().wholeImageList.length, 2);
});

test('stacked dialogs keep scrolling locked until both close in either order', async () => {
    const previousDocument = globalThis.document, previousWindow = globalThis.window;
    globalThis.document = { body: { style: { overflow: 'auto' } } };
    globalThis.window = new EventTarget();
    const module = await componentModule('../../TNDesignSystem/TN_Dialog.jsx', {
        './theme': { useTNTheme: () => 'dark' },
        'framer-motion': { AnimatePresence: 'presence', motion: { div: 'div', button: 'button' } },
    });
    try {
        for (const reverse of [false, true]) {
            const first = module.create(), second = module.create();
            first.render({ isOpen: true, title: 'Preview', onClose() {} });
            second.render({ isOpen: true, title: 'Confirm', onClose() {} });
            assert.equal(document.body.style.overflow, 'hidden');
            (reverse ? second : first).dispose();
            assert.equal(document.body.style.overflow, 'hidden');
            (reverse ? first : second).dispose();
            assert.equal(document.body.style.overflow, 'auto');
        }
    } finally { globalThis.document = previousDocument; globalThis.window = previousWindow; }
});
