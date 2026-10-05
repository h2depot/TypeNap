import { test } from "node:test";
import assert from "node:assert/strict";
import { getRecentCharacterCount, migrateDailyChars, getWritingStreak } from "./statsSummary.js";

test("includes today and six previous dates across a week/year boundary", () => {
    assert.equal(getRecentCharacterCount({
        sun: { date: "2025-12-28", chars: 100 },
        mon: { date: "2025-12-29", chars: 20 },
        tue: { date: "2026-01-04", chars: 500 },
        wed: { date: "2025-12-27", chars: 900 },
        thu: { date: 0, chars: 700 },
        fri: { date: "invalid", chars: 600 },
        sat: { date: "2026-01-03", chars: -10 },
    }, "2026-01-03"), 120);
});

test("empty or invalid counts do not produce NaN", () => {
    assert.equal(getRecentCharacterCount(undefined, "2026-01-03"), 0);
    assert.equal(getRecentCharacterCount({ sat: { date: "2026-01-03", chars: "12" } }, "2026-01-03"), 0);
});

test("migration preserves historical dates and never double counts existing daily entries", () => {
    const weekly = {
        sun: { date: "2024-02-29", chars: 100 },
        mon: { date: "2026-01-01", chars: -20 },
        tue: { date: "2024-02-30", chars: 400 },
        wed: { date: 0, chars: 100 },
    };
    const daily = migrateDailyChars({ "2024-02-29": 500, "invalid": 20 }, weekly);
    assert.deepEqual(daily, { "2024-02-29": 500, "2026-01-01": 0 });
    assert.deepEqual(migrateDailyChars(daily, weekly), daily);
});

test("daily summary includes exactly seven days and ignores negative counts", () => {
    assert.equal(getRecentCharacterCount({
        "2025-12-27": 999, "2025-12-28": 500,
        "2026-01-01": -20, "2026-01-03": 100, "2026-01-04": 888,
    }, "2026-01-03"), 600);
});

test("streak handles year boundaries, gaps, unordered entries and invalid/future records", () => {
    assert.deepEqual(getWritingStreak({
        "2026-01-01": 100, "2025-12-30": 1, "2025-12-31": 5,
        "2026-01-03": 50, "2026-01-02": -1, "2026-01-04": 0,
        "2026-01-06": 100, "bad": 999, "2025-02-30": 100,
    }, "2026-01-04"), {
        current_days: 1, longest_days: 3, last_writing_date: "2026-01-03", as_of_date: "2026-01-04",
    });
});

test("streak includes leap day and resets after a missed full day", () => {
    const daily = { "2024-02-28": 1, "2024-02-29": 1, "2024-03-01": 1 };
    assert.equal(getWritingStreak(daily, "2024-03-01").current_days, 3);
    assert.equal(getWritingStreak(daily, "2024-03-02").current_days, 3);
    const ended = getWritingStreak(daily, "2024-03-03");
    assert.equal(ended.current_days, 0);
    assert.equal(ended.longest_days, 3);
    assert.deepEqual(getWritingStreak({}, "2024-03-03"), {
        current_days: 0, longest_days: 0, last_writing_date: null, as_of_date: "2024-03-03",
    });
});
