import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { migrateDailyChars, getWritingStreak } from "./statsSummary.js";

// Run the actual store actions with an in-memory Tauri adapter (no user files touched).
const source = (await readFile(new URL("./stats.js", import.meta.url), "utf8"))
    .replace(/^import .*;\r?\n/gm, "")
    .replace("export const useStatsStore", "const useStatsStore");

function fixture(initial) {
    let today = "2026-10-03";
    const records = structuredClone(initial);
    const snapshots = [];
    const create = (factory) => {
        let state;
        const get = () => state;
        const set = (update) => { state = { ...state, ...(typeof update === "function" ? update(state) : update) }; };
        state = factory(set, get);
        return { getState: get };
    };
    class LazyStore {
        async get(key) { return structuredClone(records[key]); }
        async set(key, value) { records[key] = structuredClone(value); }
        async delete(key) { delete records[key]; }
        async save() { snapshots.push(structuredClone(records)); }
    }
    const build = new Function("create", "invoke", "LazyStore", "useToastStore", "i18next",
        "initialBookmarksJa", "initialBookmarksEn", "bookmarkUrl", "useAppSettings", "migrateDailyChars", "getWritingStreak",
        `${source}\nreturn useStatsStore;`);
    const store = build(create, async () => today, LazyStore,
        { getState: () => ({ addToast: () => {} }) }, { t: (key) => key }, [], [],
        (url) => url, { getState: () => ({ settings: { language: "ja" } }) }, migrateDailyChars, getWritingStreak);
    return { store, records, snapshots, setDate: (date) => { today = date; } };
}

test("initialization saves migration before removing legacy data and preserves unrelated stats", async () => {
    const { store, records, snapshots } = fixture({
        total_chars: 1234,
        weekly_chars: { sun: { date: "2026-09-01", chars: 500 } },
        bookmarks: [{ url: "https://example.com", title: "Saved" }],
        recent_tabs: [{ id: "tab1" }],
    });
    await store.getState().initStats();
    assert.equal(store.getState().isReady, true);
    assert.deepEqual(records.daily_chars, { "2026-09-01": 500 });
    assert.equal(records.total_chars, 1234);
    assert.equal(records.bookmarks[0].title, "Saved");
    assert.deepEqual(records.recent_tabs, [{ id: "tab1" }]);
    assert.ok(snapshots.some((saved) => saved.weekly_chars && saved.daily_chars["2026-09-01"] === 500));
    assert.equal(records.weekly_chars, undefined);
    await store.getState().initStats();
    assert.equal(store.getState().stats.daily_chars["2026-09-01"], 500);
});

test("concurrent saves accumulate increases and ignore deletions without losing history", async () => {
    const { store, records, snapshots } = fixture({ total_chars: 1000, daily_chars: { "2025-01-01": 100, "2026-10-03": 20 } });
    await store.getState().initStats();
    await Promise.all([500, 2000, -100].map((value) => store.getState().recordCharacterChange(value)));
    assert.equal(records.total_chars, 3500);
    assert.deepEqual(records.daily_chars, { "2025-01-01": 100, "2026-10-03": 2520 });
    assert.deepEqual(store.getState().stats.daily_chars, records.daily_chars);
    assert.equal(records.writing_streak.current_days, 1);
    assert.equal(records.writing_streak.longest_days, 1);
    assert.deepEqual(snapshots.slice(-2).map((saved) => [saved.total_chars, saved.daily_chars["2026-10-03"]]),
        [[1500, 520], [3500, 2520]]);
});

test("old negative counts are normalized and deletion-only saves leave statistics unchanged", async () => {
    const { store, records, snapshots } = fixture({ total_chars: -50, daily_chars: { "2026-10-02": -50 } });
    await store.getState().initStats();
    assert.equal(records.total_chars, 0);
    assert.deepEqual(records.daily_chars, { "2026-10-02": 0 });
    const before = structuredClone(records);
    const saveCount = snapshots.length;
    await store.getState().recordCharacterChange(-1000);
    await store.getState().recordCharacterChange(0);
    assert.deepEqual(records, before);
    assert.equal(snapshots.length, saveCount);
    await store.getState().recordCharacterChange(100);
    const afterWriting = structuredClone(records);
    await store.getState().recordCharacterChange(-200);
    assert.deepEqual(records, afterWriting);
    assert.equal(records.writing_streak.current_days, 1);
});

test("streak persists on startup, after writing, and after a day without writing", async () => {
    const { store, records, setDate } = fixture({
        total_chars: 20, daily_chars: { "2026-10-01": 10, "2026-10-02": 10 },
    });
    await store.getState().initStats();
    assert.equal(records.writing_streak.current_days, 2);
    await store.getState().recordCharacterChange(10);
    assert.equal(records.writing_streak.current_days, 3);
    assert.equal(records.writing_streak.longest_days, 3);
    setDate("2026-10-04");
    await store.getState().refreshWritingStreak();
    assert.equal(records.writing_streak.current_days, 3);
    setDate("2026-10-05");
    await store.getState().refreshWritingStreak();
    assert.equal(records.writing_streak.current_days, 0);
    assert.equal(records.writing_streak.longest_days, 3);
    assert.deepEqual(store.getState().stats.writing_streak, records.writing_streak);
});
