import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import { shortcuts, isShortcutAvailable } from './shortcuts.js';

async function setup(appMode = 'workspace', type = 'work') {
    const events = [];
    const calls = [];
    let callback, registeredKeys, options;
    let overlayOpen = false;
    const state = {
        appMode, selectedIndex: 0, tabLauncherOpen: false,
        tabsList: [0, 1, 2].map(() => ({ type, props: { story_name: 'A', title: 'B' } })),
        setAppMode: (mode) => { state.appMode = mode; },
        setSelectedIndex: (index) => { state.selectedIndex = index; },
        addTab: (...args) => calls.push(['addTab', ...args]),
    };
    const context = createContext({
        console,
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
        window: { dispatchEvent: (event) => events.push(event) },
        document: { querySelector: () => overlayOpen ? {} : null },
    });
    const dependencies = {
        'react-hotkeys-hook': { useHotkeys: (keys, handler, opts) => { registeredKeys = keys; callback = handler; options = opts; } },
        '../store/tabStore': { useTabStore: { getState: () => state } },
        '../store/txtStore': { useTxtStore: { getState: () => ({
            workspaces: { 'A/B': { isEdited: true, story_name: 'A' } },
            saveContent: async (id) => calls.push(['save', id]),
        }) } },
        '../store/fileStore': { useFileStore: { getState: () => ({ getStoryInfo: async (name) => ({ name }) }) } },
        '../store/storyStore': { useStoryStore: { getState: () => ({ updateStoryInfo: (...args) => calls.push(['update', ...args]) }) } },
        './shortcuts': { shortcuts, isShortcutAvailable },
    };
    const module = new SourceTextModule(await readFile(new URL('./KeyboardShortcutEvent.js', import.meta.url), 'utf8'), { context });
    await module.link((specifier) => {
        const exports = dependencies[specifier];
        return new SyntheticModule(Object.keys(exports), function () {
            for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
        }, { context });
    });
    await module.evaluate();
    module.namespace.default();
    return { state, events, calls, registeredKeys, options,
        overlay: (open) => { overlayOpen = open; },
        press: async (keys, extra = {}) => {
            let prevented = false;
            await callback({ preventDefault: () => { prevented = true; }, ...extra }, { hotkey: keys });
            return prevented;
        },
    };
}

test('current fixed views and tab launcher work from Settings; legacy bindings are removed', async () => {
    const app = await setup('settings');
    assert.equal(app.registeredKeys.includes('ctrl+h'), false);
    assert.equal(app.registeredKeys.includes('ctrl+period'), false);
    assert.equal(app.options.enableOnFormTags, true);
    await app.press('ctrl+2');
    assert.equal(app.state.appMode, 'library');
    await app.press('ctrl+comma');
    assert.equal(app.state.appMode, 'settings');
    await app.press('ctrl+t');
    assert.equal(app.state.appMode, 'workspace');
    assert.equal(app.events.at(-1).type, 'open-tab-launcher');
    await app.press('ctrl+shift+t');
    assert.equal(app.calls.at(-1)[1], 'search');
});

test('tab cycling wraps; closing goes through the unsaved confirmation event', async () => {
    const app = await setup();
    await app.press('ctrl+shift+tab');
    assert.equal(app.state.selectedIndex, 2);
    await app.press('ctrl+tab');
    assert.equal(app.state.selectedIndex, 0);
    await app.press('ctrl+w');
    assert.equal(app.events.at(-1).type, 'request-close-tab');
    assert.equal(app.events.at(-1).detail.index, 0);
    app.state.tabsList = [];
    assert.equal(await app.press('ctrl+w'), false);
    assert.equal(await app.press('ctrl+tab'), false);
});

test('saving, searching and creation target the current supported view', async () => {
    const app = await setup();
    await app.press('ctrl+s');
    assert.equal(app.calls[0][1], 'A/B');
    await app.press('ctrl+f');
    assert.equal(app.events.at(-1).detail.workspaceID, 'A/B');
    assert.equal(await app.press('ctrl+n'), false);
    app.state.tabsList[0].type = 'story';
    await app.press('ctrl+s');
    assert.equal(app.events.at(-1).type, 'save-story-synopsis');
    await app.press('ctrl+n');
    assert.equal(app.events.at(-1).type, 'open-add-episode-dialog');
    app.state.appMode = 'library';
    await app.press('ctrl+n');
    assert.equal(app.events.at(-1).type, 'open-add-story-dialog');
    assert.equal(await app.press('ctrl+s'), false);
    app.state.appMode = 'workspace';
    app.state.tabsList[0].type = 'search';
    assert.equal(await app.press('ctrl+f'), false);
    assert.equal(await app.press('ctrl+s'), false);
});

test('dialogs, launcher, IME and key repeat do not trigger background actions', async () => {
    const app = await setup();
    app.overlay(true);
    assert.equal(await app.press('ctrl+w'), false);
    assert.equal(await app.press('ctrl+2'), false);
    await app.press('esc');
    assert.equal(app.events.at(-1).type, 'close-dialogs');
    app.overlay(false);
    app.state.tabLauncherOpen = true;
    assert.equal(await app.press('ctrl+t'), false);
    app.state.tabLauncherOpen = false;
    assert.equal(await app.press('esc', { isComposing: true }), false);
    assert.equal(await app.press('ctrl+n', { keyCode: 229 }), false);
    await app.press('ctrl+shift+t', { repeat: true });
    assert.equal(app.calls.length, 0);
});
