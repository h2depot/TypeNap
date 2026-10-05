import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SourceTextModule, SyntheticModule } from "node:vm";
import { create } from "zustand";
import { arrayMove } from "@dnd-kit/sortable";

// Exercise the real store with only persistence/desktop dependencies replaced.
// Run: node --experimental-vm-modules --test src/store/tabStore.test.js
async function setup(saved = [], selected = {}, saving = "On") {
    const persisted = {};
    const dependencies = {
        zustand: { create },
        "@dnd-kit/sortable": { arrayMove },
        "./toastStore": { useToastStore: { getState: () => ({ addToast: () => {} }) } },
        "./saving/appSettings": { useAppSettings: { getState: () => ({ settings: { SavingTab: saving } }) } },
        "./saving/stats": { useStatsStore: { getState: () => ({
            stats: { recent_tabs: saved, selected_tab: selected },
            updateRecentTabs: (tabs) => { persisted.tabs = tabs; },
            updateSelectedTab: (tab) => { persisted.selected = tab; },
            addRecentFile: () => {},
        }) } },
        "./languageController": { default: { t: (key) => key } },
    };
    const module = new SourceTextModule(await readFile(new URL("./tabStore.js", import.meta.url), "utf8"));
    await module.link((specifier) => {
        const exports = dependencies[specifier];
        return new SyntheticModule(Object.keys(exports), function () {
            for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
        });
    });
    await module.evaluate();
    const store = module.namespace.useTabStore;
    store.getState().initialize();
    return { state: store.getState, persisted };
}

const story = (name) => ({ story_name: name });
const work = (name, title) => ({ story_name: name, title });

test("fixed modes retain tabs; opening the same Story creates an independent tab", async () => {
    const { state } = await setup();
    assert.equal(state().appMode, "workspace");
    assert.equal(state().selectedIndex, -1);
    state().addTab("story", "A", story("A"));
    state().addTab("work", "Chapter", work("A", "Chapter"));
    const tabs = state().tabsList;
    for (const mode of ["library", "settings", "workspace"]) {
        state().setAppMode(mode);
        assert.equal(state().tabsList, tabs);
        assert.equal(state().selectedIndex, 1);
    }
    state().setAppMode("library");
    state().addTab("story", "A", story("A"));
    assert.equal(state().appMode, "workspace");
    assert.equal(state().selectedIndex, 2);
    assert.equal(state().tabsList.length, 3);
    assert.notEqual(state().tabsList[0].id, state().tabsList[2].id);
    state().closeTab(2);
    assert.equal(state().tabsList[0].props.story_name, "A");
});

test("Story and Work are independent tabs; Search can open multiple instances", async () => {
    const { state } = await setup();
    state().addTab("story", "A", story("A"));
    state().addTab("work", "Chapter", work("A", "Chapter"));
    state().closeTab(0);
    assert.equal(state().tabsList[0].type, "work");
    assert.equal(state().tabsList[0].props.story_name, "A");
    state().addTab("work", "Chapter", work("A", "Chapter"));
    assert.equal(state().tabsList.length, 1);
    state().addTab("search", "Search");
    state().addTab("search", "Search");
    assert.equal(state().tabsList.length, 3);
    assert.notEqual(state().tabsList[1].id, state().tabsList[2].id);
});

test("restoration retains duplicate Story instances and their exact active selection", async () => {
    const saved = [
        { id: "home", type: "home" },
        { id: "library", type: "library" },
        { id: "a", type: "story", props: story("A") },
        { id: "settings", type: "settings" },
        { id: "b", type: "work", props: work("A", "Chapter") },
        { id: "duplicate", type: "story", props: story("A") },
    ];
    const { state } = await setup(saved, { id: "duplicate", index: 5 });
    assert.deepEqual(state().tabsList.map((tab) => tab.id), ["a", "b", "duplicate"]);
    assert.equal(state().selectedIndex, 2);
    const fallback = await setup(saved, { index: 4 });
    assert.equal(fallback.state().selectedIndex, 1);
    const disabled = await setup(saved, {}, "Off");
    assert.equal(disabled.state().tabsList.length, 0);
    const legacySearch = await setup([
        { type: "home" },
        { type: "search", props: { url: "https://example.com/a" } },
        { type: "search", props: { url: "https://example.com/b" } },
    ], { index: 2 });
    assert.equal(legacySearch.state().selectedIndex, 1);
});

test("reordering and closing preserve selection, including empty state and persistence", async () => {
    const { state, persisted } = await setup();
    for (const name of ["A", "B", "C"]) state().addTab("story", name, story(name));
    const selectedId = state().tabsList[2].id;
    state().reorderTabs(2, 0);
    assert.equal(state().tabsList[state().selectedIndex].id, selectedId);
    state().closeTab(2);
    assert.equal(state().tabsList[state().selectedIndex].id, selectedId);
    state().closeTab(0);
    state().closeTab(0);
    assert.equal(state().selectedIndex, -1);
    assert.deepEqual(persisted.tabs, []);
    assert.equal(persisted.selected, undefined);
    state().setSelectedIndex(NaN);
    state().closeTab(-1);
    assert.equal(state().selectedIndex, -1);
});

test("renaming keeps resource identity and deletion removes related tabs only", async () => {
    const { state } = await setup();
    state().addTab("story", "A", story("A"));
    state().addTab("work", "Chapter", work("A", "Chapter"));
    state().addTab("story", "B", story("B"));
    state().addTab("story", "A", story("A"));
    state().renameStoryTabs("A", "Renamed");
    assert.equal(state().tabsList.filter((tab) => tab.type === "story" && tab.title === "Renamed").length, 2);
    state().renameWorkTabs("Renamed", "Chapter", "New chapter");
    state().addTab("story", "Renamed", story("Renamed"));
    state().addTab("work", "New chapter", work("Renamed", "New chapter"));
    assert.equal(state().tabsList.length, 5);
    state().removeStoryTabs("Renamed");
    assert.equal(state().tabsList.length, 1);
    assert.equal(state().tabsList[0].title, "B");
    state().removeStoryTabs("B");
    assert.equal(state().selectedIndex, -1);
});

test("Story duplicates respect the tab limit; existing Work tabs still focus at the limit", async () => {
    const { state } = await setup();
    for (const type of ["home", "library", "settings"]) state().addTab(type, type);
    assert.equal(state().tabsList.length, 0);
    state().addTab("work", "Chapter", work("A", "Chapter"));
    for (let index = 0; index < 19; index++) state().addTab("story", String(index), story(String(index)));
    state().setAppMode("library");
    state().addTab("story", "0", story("0"));
    assert.equal(state().tabsList.length, 20);
    assert.equal(state().selectedIndex, 19);
    state().addTab("work", "Chapter", work("A", "Chapter"));
    assert.equal(state().selectedIndex, 0);
    assert.equal(state().appMode, "workspace");
    state().addTab("search", "Search");
    assert.equal(state().tabsList.length, 20);
});
