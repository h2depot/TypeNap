import * as contentModel from '../store/contentsInfo.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { photoPaths, validImagePaths } from '../utils/imagePaths.js';
import { validProperties } from './JSONBox/propertyTypes.js';
import * as templateModel from './Templates/templateModel.js';

test('creation picker uses row hold dragging, ignores action buttons, and adds on selection', async () => {
    const selected = ['second', 'first'];
    const changes = [];
    const fixture = await componentFixture('./Templates/TemplateStackPicker.jsx', {
        '../../store/templateStore': { useTemplateStore: () => ({ templates: [
            { id: 'first', name: 'First', scope: 'character' },
            { id: 'second', name: 'Second', scope: 'character' },
            { id: 'third', name: 'Third', scope: 'character' },
        ], refresh: () => Promise.resolve() }) },
        './TemplateSorting': { TemplateSortContext: 'sort-context' },
    });
    try {
        const tree = fixture.render({ contentType: 'character', selected, onChange: next => changes.push(next), disabled: true });
        const context = find(tree, node => node.type === 'sort-context');
        assert.deepEqual(context.props.stack, selected);
        assert.equal(context.props.getId(selected[0]), 'second');
        assert.equal(context.props.disabled, true);
        const dropdown = find(tree, node => node.props['aria-label'] === 'templates.choose');
        dropdown.props.onChange('third');
        assert.deepEqual(changes, []);
        const enabled = fixture.render({ contentType: 'character', selected, onChange: next => changes.push(next) });
        const picker = find(enabled, node => node.props['aria-label'] === 'templates.choose');
        picker.props.onChange('first');
        assert.deepEqual(changes, []);
        picker.props.onChange('third');
        assert.deepEqual(changes, [['second', 'first', 'third']]);
        changes.length = 0;
    } finally { fixture.dispose(); }

    let starts = 0;
    const row = await componentFixture('./Templates/TemplateStackPicker.jsx', {
        '@dnd-kit/sortable': { useSortable: () => ({ attributes: {}, listeners: { onMouseDown: () => starts++, onTouchStart: () => starts++ }, setNodeRef() {}, setActivatorNodeRef() {} }) },
        '@dnd-kit/utilities': { CSS: { Transform: { toString: () => undefined } } },
    }, 'TemplatePickerRow');
    try {
        const tree = row.render({ id: 'second', index: 0, name: 'Second', selected, onChange: next => changes.push(next) });
        const remove = find(tree, node => node.type === 'button');
        assert.equal(remove.props.type, 'button');
        assert.equal(remove.props['aria-label'], 'templates.remove: Second');
        assert.equal(find(tree, node => node.props?.['aria-label'] === 'templates.moveUp'), undefined);
        assert.equal(find(tree, node => node.props?.['aria-label'] === 'templates.moveDown'), undefined);
        tree.props.onMouseDown({ target: { closest: () => null } });
        tree.props.onTouchStart({ target: { closest: () => null } });
        assert.equal(starts, 2);
        tree.props.onMouseDown({ target: { closest: () => ({ tagName: 'BUTTON' }) } });
        assert.equal(starts, 2);
        remove.props.onClick();
        assert.deepEqual(changes[0], ['first']);
        assert.deepEqual(selected, ['second', 'first']);
        const disabledTree = row.render({ id: 'second', index: 0, name: 'Second', selected, onChange: next => changes.push(next), disabled: true });
        disabledTree.props.onMouseDown({ target: { closest: () => null } });
        assert.equal(starts, 2);
    } finally { row.dispose(); }
});

test('empty dropdown blocks mouse and keyboard opening and closes when options disappear', async () => {
    const previousDocument = globalThis.document;
    globalThis.document = { addEventListener() {}, removeEventListener() {} };
    let fixture;
    try {
        fixture = await componentFixture('./TNDesignSystem/TN_Dropdown.jsx', {
            './theme': { useTNTheme: () => 'light' },
            'framer-motion': { motion: { div: 'motion-div', span: 'motion-span' }, AnimatePresence: 'presence' },
        });
        const props = { options: [], onChange() {} };
        let tree = fixture.render(props);
        let trigger = find(tree, node => node.props?.role === 'button');
        assert.equal(trigger.props['aria-disabled'], true);
        assert.ok(find(tree, node => node.type === 'span' && node.props.children === 'common.noOptions'));
        trigger.props.onClick();
        for (const key of ['Enter', ' ']) trigger.props.onKeyDown({ key, preventDefault() {} });
        tree = fixture.render();
        assert.equal(find(tree, node => node.props?.role === 'button').props['aria-expanded'], false);
        tree = fixture.render({ ...props, options: [{ value: 'one', label: 'One' }] });
        find(tree, node => node.props?.role === 'button').props.onClick();
        tree = fixture.render();
        assert.equal(find(tree, node => node.props?.role === 'button').props['aria-expanded'], true);
        tree = fixture.render(props);
        assert.equal(find(tree, node => node.props?.role === 'button').props['aria-expanded'], false);
        tree = fixture.render({ ...props, options: [{ value: 'one', label: 'One' }] });
        trigger = find(tree, node => node.props?.role === 'button');
        assert.equal(trigger.props['aria-expanded'], false);
        trigger.props.onKeyDown({ key: 'Enter', preventDefault() {} });
        assert.equal(find(fixture.render(), node => node.props?.role === 'button').props['aria-expanded'], true);
    } finally { fixture?.dispose(); globalThis.document = previousDocument; }
});

// Exercise the actual component handlers and effects with deferred IPC responses,
// without starting Tauri or touching user documents.
async function componentFixture(file, modules = {}, exportName = 'default') {
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
        if (name.endsWith('/templateModel')) return templateModel;
        if (name === 'react') return hooks;
        if (name === 'react/jsx-runtime') return runtime;
        if (name === 'react-dom') return { createPortal: node => node };
        if (name === 'react-i18next') return { useTranslation: () => ({ t: key => key }) };
        if (name === 'framer-motion') return { motion: {}, AnimatePresence: 'presence' };
        if (name in modules) return modules[name];
        if (name === '../../../store/saving/stats') return { useStatsStore: () => ({ stats: {}, isReady: true, updateInitialTemplateStack: async () => {} }) };
        if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
        return new Proxy({ default: name }, { get: (target, key) => key === '__esModule' ? true : target[key] ?? key });
    };
    new Function('require', 'module', 'exports', code)(require, module, module.exports);
    return {
        render(nextProps = props) {
            props = nextProps;
            for (let pass = 0; pass < 20; pass++) {
                cursor = 0; changed = false; effects = [];
                tree = module.exports[exportName](props);
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

test('template row backup menu opens only that template history even when names match', async () => {
    const first = { ...templateModel.newDefinition(), name: 'Same name' };
    const second = { ...templateModel.newDefinition(), name: 'Same name' };
    const previous = { ...first, revision: 1 };
    const current = { ...first, revision: 2 };
    const calls = [];
    const fixture = await componentFixture('./FixedViews/Template/TemplateView.jsx', {
        '../../../store/templateStore': { useTemplateStore: () => ({ templates: [current, second], refresh: () => Promise.resolve(),
            backups: async () => [current, second, previous], restore: async (...args) => calls.push(args), loading: false }) },
        '../../TNDesignSystem': { TN_Button: 'tn-button', TN_Dialog: 'tn-dialog', TN_Dropdown: 'tn-dropdown', TN_ListItem: 'template-row' },
    });
    try {
        let tree = fixture.render({});
        const row = find(tree, node => node.type === 'template-row');
        await row.props.control.props.items.find(item => item.label === 'story.actions.restoreBackup').onClick();
        tree = fixture.render();
        const dialog = find(tree, node => node.type === 'tn-dialog' && node.props.title.includes('story.actions.restoreBackup'));
        assert.equal(dialog.props.isOpen, true);
        const selector = find(dialog, node => node.type === 'tn-dropdown');
        assert.deepEqual(selector.props.options.map(item => item.value), [`${first.id}/2`, `${first.id}/1`]);
        selector.props.onChange(`${first.id}/1`);
        tree = fixture.render();
        await find(tree, node => node.type === 'tn-button' && node.props.children === 'templateLibrary.restore').props.onClick();
        assert.deepEqual(calls, [[previous, 2]]);
    } finally { fixture.dispose(); }
});

test('definition field sorting preserves IDs and edits, removes arrows, and saves only on request', async () => {
    const fields = ['First', 'Second'].map(label => ({ ...templateModel.newField(), label }));
    const definition = { ...templateModel.newDefinition(), name: 'Profile', fields };
    const saved = [];
    const fixture = await componentFixture('./Templates/TemplateDefinitionDialog.jsx', {
        './TemplateSorting': { TemplateSortContext: 'field-sort', SortableTemplate: 'field-row' },
    });
    try {
        let tree = fixture.render({ definition, deletionLocked: true, onClose() {}, onSave: async value => saved.push(value) });
        assert.equal(find(tree, node => node.type === 'button' && ['↑', '↓', '→'].includes(node.props.children)), undefined);
        find(tree, node => node.props?.['aria-label'] === 'templates.fieldName 1').props.onChange({ target: { value: 'Edited first' } });
        tree = fixture.render();
        const context = find(tree, node => node.type === 'field-sort');
        assert.deepEqual(context.props.stack.map(context.props.getId), fields.map(field => field.id));
        context.props.onChange([...context.props.stack].reverse());
        tree = fixture.render();
        assert.equal(saved.length, 0);
        assert.equal(definition.fields[0].label, 'First');
        find(tree, node => node.props?.onKeyDown && node.props.className === 'workspace definitionEditor').props.onKeyDown({ ctrlKey: true, key: 's', preventDefault() {}, stopPropagation() {} });
        await flush();
        assert.deepEqual(saved[0].fields.map(field => field.id), [fields[1].id, fields[0].id]);
        assert.equal(saved[0].fields[1].label, 'Edited first');
    } finally { fixture.dispose(); }
});

test('field sort uses JSONBox hold sensors and ignores cancelled, stale and disabled drops', async () => {
    const fields = ['First', 'Second'].map(label => ({ ...templateModel.newField(), label }));
    const changes = [];
    const fixture = await componentFixture('./Templates/TemplateSorting.jsx', {
        '@dnd-kit/core': { DndContext: 'dnd-context', useSensor: (sensor, options) => ({ sensor, options }), useSensors: (...sensors) => sensors },
        '@dnd-kit/sortable': { SortableContext: 'sort-context', arrayMove: (items, from, to) => { const next = [...items]; next.splice(to, 0, next.splice(from, 1)[0]); return next; } },
    }, 'TemplateSortContext');
    try {
        const props = { stack: fields, getId: field => field.id, onChange: next => changes.push(next) };
        let tree = fixture.render(props);
        assert.equal(tree.props.sensors[0].options.activationConstraint.delay, 200);
        assert.equal(tree.props.sensors[1].options.activationConstraint.delay, 200);
        tree.props.onDragEnd({ active: { id: fields[0].id }, over: null });
        tree.props.onDragEnd({ active: { id: 'missing' }, over: { id: fields[1].id } });
        assert.equal(changes.length, 0);
        tree.props.onDragEnd({ active: { id: fields[0].id }, over: { id: fields[1].id } });
        assert.deepEqual(changes, [[fields[1], fields[0]]]);
        tree = fixture.render({ ...props, disabled: true });
        tree.props.onDragEnd({ active: { id: fields[0].id }, over: { id: fields[1].id } });
        assert.equal(changes.length, 1);
    } finally { fixture.dispose(); }
});

test('template update menu detects legacy same-revision changes and recovers archived values', async () => {
    const definition = { ...templateModel.newDefinition(), name: 'Profile', revision: 2 };
    const field = { ...templateModel.newField(), label: 'Role' };
    const latest = { ...definition, fields: [field] };
    const entry = { definition, values: {}, retiredValues: { [field.id]: 'Retained role' } };
    let changed;
    const fixture = await componentFixture('./Templates/TemplateStackEditor.jsx', {
        '../../store/templateStore': { useTemplateStore: () => ({ templates: [latest], refresh: () => Promise.resolve(), error: '' }) },
    });
    try {
        const tree = fixture.render({ stack: [entry], contentType: 'character', deletionLocked: true, onChange: next => { changed = next; } });
        const section = find(tree, node => node.type?.name === 'TemplateSection');
        section.props.menuItems.find(item => item.label === 'templates.update').onClick();
        assert.equal(changed[0].values[field.id], 'Retained role');
        assert.deepEqual(changed[0].retiredValues, {});
        assert.equal(templateModel.hasTemplateUpdate(changed[0], latest), false);
    } finally { fixture.dispose(); }
});

test('template row backup restoration keeps errors open for retry without a FixedView backup button', async () => {
    const definition = { ...templateModel.newDefinition(), name: 'Deleted profile' };
    const calls = [];
    let fail = true;
    const fixture = await componentFixture('./FixedViews/Template/TemplateView.jsx', {
        '../../../store/templateStore': { useTemplateStore: () => ({ templates: [definition], refresh: () => Promise.resolve(),
            backups: async () => [definition], restore: async (...args) => { calls.push(args); if (fail) throw new Error('restore failed'); }, loading: false }) },
        '../../TNDesignSystem': { TN_Button: 'tn-button', TN_Dialog: 'tn-dialog', TN_Dropdown: 'tn-dropdown', TN_ListItem: 'template-row' },
    });
    try {
        let tree = fixture.render({});
        assert.equal(find(tree, node => node.type === 'tn-button' && node.props.children === 'templateLibrary.backups'), undefined);
        find(tree, node => node.type === 'template-row').props.control.props.items.find(item => item.label === 'story.actions.restoreBackup').onClick();
        await flush();
        tree = fixture.render();
        let dialog = find(tree, node => node.type === 'tn-dialog' && node.props.title.includes('story.actions.restoreBackup'));
        assert.equal(dialog.props.isOpen, true);
        find(dialog, node => node.type === 'tn-dropdown').props.onChange(`${definition.id}/${definition.revision}`);
        tree = fixture.render();
        find(tree, node => node.type === 'tn-button' && node.props.children === 'templateLibrary.restore').props.onClick();
        await flush();
        tree = fixture.render();
        assert.deepEqual(calls, [[definition, definition.revision]]);
        assert.ok(find(tree, node => node.props?.role === 'alert'));
        assert.equal(find(tree, node => node.type === 'tn-dialog' && node.props.title.includes('story.actions.restoreBackup')).props.isOpen, true);
        fail = false;
        find(tree, node => node.type === 'tn-button' && node.props.children === 'templateLibrary.restore').props.onClick();
        await flush();
        assert.equal(find(fixture.render(), node => node.type === 'tn-dialog' && node.props.title.includes('story.actions.restoreBackup')).props.isOpen, false);
    } finally { fixture.dispose(); }
});

test('template sections collapse independently and retain values and identity after editing', async () => {
    const definition = templateModel.newDefinition('character');
    definition.name = 'Profile';
    const field = templateModel.newField(); field.label = 'Name'; definition.fields.push(field);
    let entry = templateModel.makeEntry(definition);
    entry.values[field.id] = 'Alice';
    let changes = 0;
    const first = await componentFixture('./Templates/TemplateStackEditor.jsx', {}, 'TemplateSection');
    const second = await componentFixture('./Templates/TemplateStackEditor.jsx', {}, 'TemplateSection');
    try {
        const props = { entry, menuItems: [], deletionLocked: true, onChange: next => { entry = next; changes++; } };
        let tree = first.render(props);
        assert.equal(tree.props.title, 'Profile');
        assert.equal(tree.props.expanded, true);
        tree.props.onToggle();
        assert.equal(first.render().props.expanded, false);
        assert.equal(second.render(props).props.expanded, true);
        assert.equal(changes, 0);
        first.render().props.onToggle();
        tree = first.render();
        find(tree, node => node.type?.name === 'TemplateFieldInput').props.onChange('Alice updated');
        tree = first.render({ ...props, entry });
        assert.equal(entry.values[field.id], 'Alice updated');
        assert.equal(entry.definition.id, definition.id);
        tree.props.onToggle();
        first.render().props.onToggle();
        tree = first.render();
        assert.equal(find(tree, node => node.type?.name === 'TemplateFieldInput').props.value, 'Alice updated');
    } finally { first.dispose(); second.dispose(); }
});

test('shared property section uses its triangle button to hide only its body', async () => {
    const fixture = await componentFixture('./JSONBox/PropertyEditor.jsx', {}, 'PropertySection');
    try {
        const props = { title: 'Profile', count: 2, expanded: false, onToggle() {}, children: 'saved values' };
        let tree = fixture.render(props);
        const toggle = find(tree, node => node.type === 'button');
        assert.equal(toggle.props['aria-expanded'], false);
        assert.equal(find(tree, node => node.props?.id === toggle.props['aria-controls']).props.hidden, true);
        tree = fixture.render({ ...props, expanded: true });
        const body = find(tree, node => node.props?.id === toggle.props['aria-controls']);
        assert.equal(body.props.hidden, false);
        assert.equal(body.props.children, 'saved values');
    } finally { fixture.dispose(); }
});

test('definition dialog saves its own draft on Ctrl+S and keeps the dialog open on a backend failure', async () => {
    const definition = templateModel.newDefinition('private');
    definition.name = 'Only this file';
    definition.fields = [{ ...templateModel.newField(), label: 'Notes' }];
    let saves = 0, closes = 0, prevented = false, stopped = false;
    const fixture = await componentFixture('./Templates/TemplateDefinitionDialog.jsx', {
        './templateModel': templateModel,
    });
    try {
        const props = { definition, onClose: () => closes++, onSave: async () => { saves++; throw new Error('disk full'); } };
        const tree = fixture.render(props);
        const editor = find(tree, node => typeof node.props?.onKeyDown === 'function');
        editor.props.onKeyDown({ ctrlKey: true, key: 's', preventDefault: () => { prevented = true; }, stopPropagation: () => { stopped = true; } });
        await flush();
        assert.equal(saves, 1);
        assert.equal(closes, 0);
        assert.ok(prevented && stopped);
        assert.equal(find(fixture.render(), node => node.props?.role === 'alert').props.children, 'Error: disk full');
    } finally { fixture.dispose(); }
});

test('definition dialog prevents saving an empty field list by button and shortcut', async () => {
    const definition = { ...templateModel.newDefinition('private'), name: 'Empty', fields: [] };
    let saves = 0;
    const fixture = await componentFixture('./Templates/TemplateDefinitionDialog.jsx', {
        './templateModel': templateModel,
    });
    try {
        const tree = fixture.render({ definition, onClose() {}, onSave: async () => { saves++; } });
        const save = find(tree, node => node.props?.variant === 'proceed');
        assert.equal(save.props.disabled, true);
        await save.props.onClick();
        const editor = find(tree, node => typeof node.props?.onKeyDown === 'function');
        editor.props.onKeyDown({ ctrlKey: true, key: 's', preventDefault() {}, stopPropagation() {} });
        await flush();
        assert.equal(saves, 0);
    } finally { fixture.dispose(); }
});

test('creation syncs every template edit through stats across type switches, cancel and external updates', async () => {
    const calls = [];
    const remembered = [];
    const stats = { initial_template_stacks: { character: ['default-character'], world: ['default-world'], entity: ['default-entity'] } };
    const fixture = await componentFixture('./Tab_view/Tab_Story/tab_story_contents.jsx', {
        '../../../store/tabStore': { useTabStore: () => ({ addTab() {} }) },
        '../../../store/fileStore': { useFileStore: () => ({ getStoryInfo: async () => ({}) }) },
        '../../../store/storyStore': { useStoryStore: () => ({ updateStoryInfo() {} }) },
        '../../../store/saving/stats': { useStatsStore: () => ({
            stats, isReady: true,
            updateInitialTemplateStack: async (type, ids) => {
                remembered.push([type, [...ids]]);
                stats.initial_template_stacks = { ...stats.initial_template_stacks, [type]: [...ids] };
            },
        }) },
        '@tauri-apps/api/core': { invoke: async (command, args) => { calls.push({ command, args }); return { name: 'Alice' }; } },
        '../../Templates/TemplateStackPicker': { __esModule: true, default: 'stack-picker' },
        './ContentTypeSelector': { __esModule: true, default: 'type-picker' },
    });
    try {
        const props = { story_name: 'Story', workspace: { contentsList: [] }, isAddDialogOpen: true, setIsAddDialogOpen() {} };
        let tree = fixture.render(props);
        find(tree, node => node.type === 'type-picker').props.onChange('character');
        tree = fixture.render();
        assert.deepEqual(find(tree, node => node.type === 'stack-picker').props.selected, ['default-character']);
        find(tree, node => node.props?.id === 'new-content-name').props.onChange({ target: { value: 'Alice' } });
        find(tree, node => node.type === 'stack-picker').props.onChange(['second', 'first']);
        assert.deepEqual(remembered, [['character', ['second', 'first']]]);
        assert.equal(calls.length, 0);
        tree = fixture.render();
        find(tree, node => node.type === 'type-picker').props.onChange('world');
        tree = fixture.render();
        assert.deepEqual(find(tree, node => node.type === 'stack-picker').props.selected, ['default-world']);
        find(tree, node => node.type === 'stack-picker').props.onChange([]);
        find(tree, node => node.type === 'type-picker').props.onChange('character');
        tree = fixture.render();
        assert.deepEqual(find(tree, node => node.type === 'stack-picker').props.selected, ['second', 'first']);
        // Cancel does not undo edits that have already been synchronized.
        find(tree, node => node.props?.title === 'story.files.createTitle').props.onClose();
        tree = fixture.render();
        assert.deepEqual(remembered, [['character', ['second', 'first']], ['world', []]]);
        assert.deepEqual(find(tree, node => node.type === 'stack-picker').props.selected, ['second', 'first']);
        find(tree, node => node.props?.id === 'new-content-name').props.onChange({ target: { value: 'Alice' } });
        tree = fixture.render();
        await find(tree, node => node.type === 'form' && node.props.onSubmit).props.onSubmit();
        assert.deepEqual(remembered, [['character', ['second', 'first']], ['world', []]]);
        assert.deepEqual(calls[0], { command: 'create_document_json', args: { input: { story_name: 'Story', name: 'Alice', content_type: 'character' }, templateIds: ['second', 'first'] } });
        tree = fixture.render();
        find(tree, node => node.type === 'type-picker').props.onChange('world');
        tree = fixture.render();
        assert.deepEqual(find(tree, node => node.type === 'stack-picker').props.selected, []);
        // No local draft can mask updates made by another dialog.
        stats.initial_template_stacks.world = ['external-world'];
        tree = fixture.render();
        assert.deepEqual(find(tree, node => node.type === 'stack-picker').props.selected, ['external-world']);
    } finally { fixture.dispose(); }
});

test('legacy and structured attributes migrate into an editable private template without losing values', async () => {
    for (const structured of [false, true]) {
        let content = JSON.stringify({ summary: 'Summary', imagePaths: ['a.png'], ...(structured ? { properties: { role: 'keeper' } } : { role: 'keeper' }) });
        const fixture = await componentFixture('./JSONBox/jsonbox.jsx', {
            './propertyTypes.js': { validProperties },
            '../../utils/imagePaths.js': { photoPaths, validImagePaths },
            '../Templates/TemplateStackEditor': { __esModule: true, default: 'stack-editor' },
            './PropertyEditor.jsx': { __esModule: true, default: 'property-editor' },
        });
        try {
            const props = { workspaceId: 'file-id', title: 'Alice', content, contentType: 'character', onChangeContent: next => { content = next; } };
            const definition = templateModel.newDefinition('private');
            definition.name = 'Only Alice';
            const field = templateModel.newField();
            field.label = 'Age'; field.type = 'Number'; definition.fields.push(field);
            const entry = templateModel.makeEntry(definition);
            entry.values[field.id] = 24;
            const initial = find(fixture.render(props), node => node.type === 'stack-editor').props.stack;
            assert.equal(initial[0].definition.scope, 'private');
            const legacyField = initial[0].definition.fields[0];
            assert.equal(legacyField.label, 'role');
            assert.equal(initial[0].values[legacyField.id], 'keeper');
            assert.equal(find(fixture.render(props), node => node.type === 'stack-editor').props.stack[0].definition.id, initial[0].definition.id);
            find(fixture.render(props), node => node.type === 'stack-editor').props.onChange([entry, ...initial]);
            const tree = fixture.render({ ...props, content });
            assert.equal(find(tree, node => node.type === 'property-editor'), undefined);
            assert.equal(find(tree, node => node.type === 'stack-editor').props.stack[0].values[field.id], 24);
            const stack = find(tree, node => node.type === 'stack-editor').props.stack;
            stack[1] = { ...stack[1], values: { [legacyField.id]: 'mage' } };
            find(tree, node => node.type === 'stack-editor').props.onChange(stack);
            const saved = JSON.parse(content);
            assert.equal(saved.templateStack[0].definition.scope, 'private');
            assert.equal(saved.templateStack[0].values[field.id], 24);
            assert.deepEqual(saved.imagePaths, ['a.png']);
            assert.equal(saved.summary, 'Summary');
            assert.equal(saved.templateStack[1].values[legacyField.id], 'mage');
            assert.equal(Object.hasOwn(saved, 'properties'), false);
            assert.equal(Object.hasOwn(saved, 'role'), false);
        } finally { fixture.dispose(); }
    }
});

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
            assert.equal(find(tree, node => node.type === 'property-editor'), undefined);
            find(tree, node => node.type === 'object-photo').props.onClick();
            const dialog = find(fixture.render(), node => node.type === 'images-dialog');
            await dialog.props.onApply(['a.png', 'b.png', 'c.png']);
            assert.equal(saves[0].summary, 'keep summary');
            assert.equal(saves[0].notes, 'keep notes');
            assert.deepEqual(saves[0].imagePaths, ['a.png', 'b.png', 'c.png']);
            assert.equal(Object.hasOwn(saves[0], 'role'), false);
            const memo = saves[0].templateStack[0];
            assert.equal(memo.definition.scope, 'private');
            assert.equal(memo.values[memo.definition.fields[0].id], 'keeper');
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
        const closesBeforeSave = closes;
        await saveButton(tree).props.onClick();
        assert.deepEqual(saved[1], ['b', 'c', 'd']);
        assert.equal(closes, closesBeforeSave + 1);
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


test('notebook insertion preserves the selected position between templates', async () => {
    for (const [slot, expectedIndex] of [[0, 0], [1, 1], [2, 2]]) {
        const definitions = [newDefinitionForTest('A'), newDefinitionForTest('B'), newDefinitionForTest('Inserted')];
        let result;
        const fixture = await componentFixture('./Templates/TemplateStackEditor.jsx', {
            '../../store/templateStore': { useTemplateStore: () => ({ templates: definitions, refresh: () => Promise.resolve(), error: '' }) },
        });
        const props = { stack: definitions.slice(0, 2).map(templateModel.makeEntry), contentType: 'character', onChange: stack => { result = { stack }; } };
        const zones = [];
        const walk = node => {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) return node.forEach(walk);
            if (node.props?.className === 'insertZone') zones.push(node);
            walk(node.props?.children);
        };
        try {
            walk(fixture.render(props));
            assert.equal(zones.length, 3);
            find(zones[slot], node => node.type === 'button').props.onClick();
            let tree = fixture.render();
            find(tree, node => Array.isArray(node.props?.options)).props.onChange(definitions[2].id);
            tree = fixture.render();
            assert.equal(find(tree, node => node.props?.className === 'insertPicker'), undefined);
            assert.equal(result.stack[expectedIndex].definition.id, definitions[2].id);
            assert.equal(props.stack.length, 2);
        } finally { fixture.dispose(); }
    }
});
function newDefinitionForTest(name) {
    return { ...templateModel.newDefinition('character'), name };
}


test('saving migrates old attributes once, retains lists and order, and omits an empty legacy section', async () => {
    for (const properties of [{}, { tags: ['one', 'two'], blank: '' }]) {
        const shared = templateModel.makeEntry(newDefinitionForTest('Existing'));
        let content = JSON.stringify({ properties, templateStack: [shared], originalAttributesIndex: 0 });
        const saves = [];
        const fixture = await componentFixture('./JSONBox/jsonbox.jsx', {
            './propertyTypes.js': { validProperties },
            '../../utils/imagePaths.js': { photoPaths, validImagePaths },
            '../Templates/TemplateStackEditor': { __esModule: true, default: 'stack-editor' },
        });
        try {
            const props = { workspaceId: 'legacy', title: 'Legacy', content, contentType: 'character', onChangeContent: next => { content = next; }, onSaveClick: async () => saves.push(JSON.parse(content)) };
            const tree = fixture.render(props);
            const editor = find(tree, node => node.type === 'stack-editor');
            assert.equal(editor.props.stack.length, Object.keys(properties).length ? 2 : 1);
            const save = find(tree, node => node.type === 'button' && node.props.className?.includes('saveStatus'));
            await save.props.onClick();
            const saved = saves[0];
            assert.equal(Object.hasOwn(saved, 'properties'), false);
            assert.equal(Object.hasOwn(saved, 'originalAttributesIndex'), false);
            if (Object.keys(properties).length) {
                assert.equal(saved.templateStack[0].definition.scope, 'private');
                const fields = saved.templateStack[0].definition.fields;
                assert.deepEqual(saved.templateStack[0].values[fields[0].id], properties.tags);
                assert.equal(fields[0].type, 'StringList');
                assert.equal(saved.templateStack[0].values[fields[1].id], '');
            }
            const reloaded = find(fixture.render({ ...props, content }), node => node.type === 'stack-editor');
            assert.deepEqual(reloaded.props.stack, saved.templateStack);
        } finally { fixture.dispose(); }
    }
});


test('private templates rename fields and add typed fields inline without losing existing values', async () => {
    const definition = newDefinitionForTest('Memo');
    definition.scope = 'private';
    const field = { ...templateModel.newField(), label: 'Role' };
    definition.fields = [field];
    let entry = { definition, values: { [field.id]: 'keeper' }, retiredValues: { archived: 'retained' } };
    const fixture = await componentFixture('./Templates/TemplateStackEditor.jsx', {}, 'TemplateSection');
    try {
        const props = { entry, menuItems: [], deletionLocked: true, onChange: next => { entry = next; } };
        let tree = fixture.render(props);
        find(tree, node => node.type?.name === 'PrivateFieldName').props.onRename('Occupation');
        assert.equal(entry.definition.fields[0].id, field.id);
        assert.equal(entry.definition.fields[0].label, 'Occupation');
        assert.equal(entry.values[field.id], 'keeper');
        tree = fixture.render({ ...props, entry });
        find(tree, node => node.type === 'button' && node.props.className === 'list-add').props.onClick();
        tree = fixture.render({ ...props, entry });
        find(tree, node => node.props?.['aria-label'] === 'templates.newFieldName').props.onChange({ target: { value: 'Tags' } });
        find(tree, node => node.props?.['aria-label'] === 'templates.fieldType').props.onChange('StringList');
        tree = fixture.render({ ...props, entry });
        find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
        assert.equal(entry.definition.fields[1].label, 'Tags');
        assert.equal(entry.definition.fields[1].type, 'StringList');
        assert.notEqual(entry.definition.fields[1].id, field.id);
        assert.equal(entry.values[field.id], 'keeper');
        assert.deepEqual(entry.retiredValues, { archived: 'retained' });
        assert.ok(templateModel.validStack([entry]));
        for (const scope of templateModel.SHARED_SCOPES) {
            const shared = fixture.render({ ...props, deletionLocked: false, entry: { ...entry, definition: { ...entry.definition, scope } } });
            find(shared, node => node.type?.name === 'PrivateFieldName').props.onRename('Shared role');
            assert.equal(entry.definition.scope, scope);
            assert.equal(entry.definition.fields[0].id, field.id);
            assert.equal(entry.values[field.id], 'keeper');
            assert.ok(find(shared, node => node.props?.className === 'inlineFieldArea'));
            assert.equal(find(shared, node => node.props?.['aria-label'] === 'templates.deleteField'), undefined);
        }
    } finally { fixture.dispose(); }
});

test('inline private field names reject empty or duplicate names and commit before Ctrl+S', async () => {
    const field = { ...templateModel.newField(), label: 'Role' };
    const other = { ...templateModel.newField(), label: 'Tags' };
    const renames = [];
    const fixture = await componentFixture('./Templates/TemplateStackEditor.jsx', {}, 'PrivateFieldName');
    try {
        const props = { field, fields: [field, other], onRename: label => renames.push(label) };
        for (const invalid of ['', 'Tags']) {
            let input = find(fixture.render(props), node => node.props?.onBlur);
            input.props.onChange({ target: { value: invalid } });
            input = find(fixture.render(), node => node.props?.onBlur);
            input.props.onBlur();
            assert.equal(renames.length, 0);
            assert.ok(find(fixture.render(), node => node.props?.role === 'alert'));
        }
        let input = find(fixture.render(), node => node.props?.onBlur);
        input.props.onChange({ target: { value: ' Occupation ' } });
        input = find(fixture.render(), node => node.props?.onBlur);
        input.props.onKeyDown({ nativeEvent: {}, ctrlKey: true, key: 's' });
        assert.deepEqual(renames, ['Occupation']);
    } finally { fixture.dispose(); }
});


test('template drag reorder changes only order and ignores cancelled or stale drops', async () => {
    const { arrayMove } = await import('@dnd-kit/sortable');
    const entries = ['A', 'B', 'C'].map(name => templateModel.makeEntry(newDefinitionForTest(name)));
    entries[0].values.kept = 'saved value';
    entries[0].retiredValues = { old: 'archived' };
    const changes = [];
    const fixture = await componentFixture('./Templates/TemplateSorting.jsx', {
        '@dnd-kit/core': { DndContext: 'dnd-context', useSensor: (sensor, options) => ({ sensor, options }), useSensors: (...sensors) => sensors },
        '@dnd-kit/sortable': { arrayMove, SortableContext: 'sortable-context' },
    }, 'TemplateSortContext');
    try {
        const context = fixture.render({ stack: entries, onChange: next => changes.push(next), children: 'editor or sidebar' });
        assert.equal(context.props.sensors[0].options.activationConstraint.delay, 200);
        assert.equal(context.props.sensors[1].options.activationConstraint.delay, 200);
        const active = { id: entries[0].definition.id };
        context.props.onDragEnd({ active, over: { id: entries[2].definition.id } });
        assert.deepEqual(changes[0], [entries[1], entries[2], entries[0]]);
        assert.equal(changes[0][2], entries[0]);
        assert.deepEqual(entries.map(entry => entry.definition.name), ['A', 'B', 'C']);
        context.props.onDragEnd({ active, over: null });
        context.props.onDragEnd({ active, over: active });
        context.props.onDragEnd({ active, over: { id: 'removed' } });
        assert.equal(changes.length, 1);
    } finally { fixture.dispose(); }
});

test('template drag leaves text fields alone and suppresses navigation after dragging', async () => {
    let dragging = false, starts = 0;
    const fixture = await componentFixture('./Templates/TemplateSorting.jsx', {
        '@dnd-kit/sortable': { useSortable: () => ({ attributes: {}, listeners: { onMouseDown: () => starts++ }, setNodeRef() {}, setActivatorNodeRef() {}, isDragging: dragging }) },
        '@dnd-kit/utilities': { CSS: { Transform: { toString: () => undefined } } },
    }, 'SortableTemplate');
    try {
        const props = { id: 'template', name: 'Memo', sidebar: true, children: 'Memo' };
        let tree = fixture.render(props);
        tree.props.onMouseDown({ target: { closest: () => ({ hasAttribute: () => false }) } });
        assert.equal(starts, 0);
        tree.props.onMouseDown({ target: { closest: () => ({ hasAttribute: name => name === 'data-template-heading' }) } });
        assert.equal(starts, 1);
        dragging = true; fixture.render(); dragging = false;
        tree = fixture.render();
        let prevented = false;
        tree.props.onClickCapture({ preventDefault: () => { prevented = true; }, stopPropagation() {} });
        assert.equal(prevented, true);
        tree.props.onMouseDown({ target: { closest: () => null } });
        prevented = false;
        tree.props.onClickCapture({ preventDefault: () => { prevented = true; }, stopPropagation() {} });
        assert.equal(prevented, false);
    } finally { fixture.dispose(); }
});


test('bookmark rows drag without a grip and keep action buttons independent', async () => {
    let starts = 0, dragging = false, moves = 0, deletes = 0;
    const fixture = await componentFixture('./Tab_view/Tab_Search/BookmarkDialog.jsx', {
        '@dnd-kit/sortable': { useSortable: () => ({ attributes: {}, listeners: { onMouseDown: () => starts++, onTouchStart: () => starts++ }, setNodeRef() {}, setActivatorNodeRef() {}, isDragging: dragging }) },
        '@dnd-kit/utilities': { CSS: { Transform: { toString: () => undefined } } },
    }, 'BookmarkRow');
    try {
        const props = { item: { url: 'https://example.com', label: 'Example' }, index: 1, count: 3, busy: false, onMove: () => moves++, onDelete: () => deletes++ };
        let tree = fixture.render(props);
        assert.equal(find(tree, node => node.type === 'button'), undefined);
        tree.props.onMouseDown({ target: { closest: () => null } });
        tree.props.onTouchStart({ target: { closest: () => ({}) } });
        assert.equal(starts, 1);
        find(tree, node => node.props?.['aria-label'] === 'search.moveBookmarkUp').props.onClick();
        find(tree, node => node.props?.['aria-label'] === 'search.deleteBookmark').props.onClick();
        assert.equal(moves, 1); assert.equal(deletes, 1);
        dragging = true;
        tree = fixture.render();
        assert.equal(tree.props['data-dragging'], true);
        dragging = false;
        tree = fixture.render({ ...props, busy: true });
        tree.props.onMouseDown({ target: { closest: () => null } });
        assert.equal(starts, 1);
        assert.equal(tree.props.tabIndex, -1);
    } finally { fixture.dispose(); }
});

test('bookmark dialog uses 200ms mouse and touch holds and saves a dropped order', async () => {
    const calls = [];
    const state = { stats: { bookmarks: [{ url: 'a', label: 'A' }, { url: 'b', label: 'B' }] }, isReady: true };
    const useStatsStore = selector => selector(state);
    useStatsStore.getState = () => ({ moveBookmark: async (...args) => calls.push(args) });
    const fixture = await componentFixture('./Tab_view/Tab_Search/BookmarkDialog.jsx', {
        '../../../store/saving/stats': { useStatsStore },
        '@dnd-kit/core': { DndContext: 'dnd-context', useSensor: (sensor, options) => ({ sensor, options }), useSensors: (...sensors) => sensors },
    });
    try {
        const tree = fixture.render({ isOpen: true, onClose() {} });
        const context = find(tree, node => node.type === 'dnd-context');
        assert.equal(context.props.sensors[0].options.activationConstraint.delay, 200);
        assert.equal(context.props.sensors[1].options.activationConstraint.delay, 200);
        context.props.onDragStart(); context.props.onDragCancel();
        assert.equal(calls.length, 0);
        context.props.onDragEnd({ active: { id: 'a' }, over: null });
        assert.equal(calls.length, 0);
        context.props.onDragEnd({ active: { id: 'a' }, over: { id: 'b' } });
        assert.deepEqual(calls, [['a', 'b']]);
        await Promise.resolve();
    } finally { fixture.dispose(); }
});


test('template deletion requires dialog confirmation and respects cancellation and deletion lock', async () => {
    const entries = ['A', 'B'].map(name => templateModel.makeEntry(newDefinitionForTest(name)));
    const changes = [];
    const fixture = await componentFixture('./Templates/TemplateStackEditor.jsx', {
        '../../store/templateStore': { useTemplateStore: () => ({ templates: [], refresh: () => Promise.resolve(), error: '' }) },
        '../TNDesignSystem': { TN_Dialog: 'confirm-dialog', TN_Button: 'dialog-button' },
    });
    try {
        const props = { stack: entries, contentType: 'character', deletionLocked: false, onChange: next => changes.push(next) };
        const requestDelete = () => {
            const tree = fixture.render(props);
            const section = find(tree, node => node.type?.name === 'TemplateSection');
            section.props.menuItems.find(item => item.label === 'templates.remove').onClick();
            return find(fixture.render(), node => node.type === 'confirm-dialog');
        };
        let dialog = requestDelete();
        assert.equal(dialog.props.isOpen, true);
        assert.equal(changes.length, 0);
        dialog.props.onClose();
        assert.equal(find(fixture.render(), node => node.type === 'confirm-dialog').props.isOpen, false);
        assert.equal(changes.length, 0);
        dialog = requestDelete();
        assert.equal(find(dialog, node => node.type === 'dialog-button' && node.props.children === 'common.delete').props.variant, 'danger');
        find(dialog, node => node.type === 'dialog-button' && node.props.children === 'common.delete').props.onClick();
        assert.deepEqual(changes[0], [entries[1]]);
        requestDelete();
        dialog = find(fixture.render({ ...props, deletionLocked: true }), node => node.type === 'confirm-dialog');
        assert.equal(dialog.props.isOpen, false);
        find(dialog, node => node.type === 'dialog-button' && node.props.children === 'common.delete').props.onClick();
        assert.equal(changes.length, 1);
    } finally { fixture.dispose(); }
});


test('unlocked private fields delete inline while locked and shared fields have no trash buttons', async () => {
    const definition = { ...newDefinitionForTest('Memo'), scope: 'private' };
    const field = { ...templateModel.newField(), label: 'Role' };
    const list = { ...templateModel.newField(), label: 'Tags', type: 'StringList' };
    definition.fields = [field, list];
    let changed;
    const entry = { definition, values: { [field.id]: 'keeper', [list.id]: ['one', 'two'] } };
    const fixture = await componentFixture('./Templates/TemplateStackEditor.jsx', {}, 'TemplateSection');
    try {
        const props = { entry, menuItems: [], onChange: next => { changed = next; }, deletionLocked: true };
        let tree = fixture.render(props);
        assert.equal(find(tree, node => node.props?.['aria-label'] === 'templates.deleteField'), undefined);
        tree = fixture.render({ ...props, deletionLocked: false });
        const trash = find(tree, node => node.props?.['aria-label'] === 'templates.deleteField');
        assert.ok(trash);
        trash.props.onClick();
        assert.deepEqual(changed.definition.fields, [list]);
        assert.equal(Object.hasOwn(changed.values, field.id), false);
        assert.deepEqual(changed.values[list.id], ['one', 'two']);
        assert.ok(templateModel.validStack([changed]));
        tree = fixture.render({ ...props, deletionLocked: false, entry: { ...entry, definition: { ...definition, scope: 'character' } } });
        assert.equal(find(tree, node => node.props?.['aria-label'] === 'templates.deleteField'), undefined);
    } finally { fixture.dispose(); }
});

test('list row crosses appear only when deletion is unlocked and remove just the selected row', async () => {
    const changes = [];
    const fixture = await componentFixture('./JSONBox/PropertyEditor.jsx', {}, 'StringList');
    try {
        const props = { name: 'Tags', values: ['one', 'two'], onChange: next => changes.push(next), deletionLocked: true };
        let tree = fixture.render(props);
        assert.equal(find(tree, node => node.type === 'button' && node.props['aria-label']), undefined);
        tree = fixture.render({ ...props, deletionLocked: false });
        const remove = find(tree, node => node.type === 'button' && node.props['aria-label']);
        remove.props.onClick();
        assert.deepEqual(changes, [['two']]);
        const field = { ...templateModel.newField(), label: 'Tags', type: 'StringList' };
        const input = await componentFixture('./Templates/TemplateStackEditor.jsx', {}, 'TemplateFieldInput');
        try {
            assert.equal(input.render({ field, value: props.values, onChange() {}, deletionLocked: false }).props.deletionLocked, false);
            assert.equal(input.render({ field, value: props.values, onChange() {}, deletionLocked: true }).props.deletionLocked, true);
        } finally { input.dispose(); }
    } finally { fixture.dispose(); }
});
