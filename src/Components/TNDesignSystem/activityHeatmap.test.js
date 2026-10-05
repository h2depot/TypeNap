import { test } from "node:test";
import assert from "node:assert/strict";
import { buildActivityCalendar, getActivityLevel } from "./activityHeatmap.js";

test("activity levels respect all requested boundaries and negative counts", () => {
    for (const [value, level] of [[-10, 0], [0, 0], [1, 1], [499, 1], [500, 2], [1999, 2], [2000, 3], [3999, 3], [4000, 4], [NaN, 0]]) {
        assert.equal(getActivityLevel(value), level);
    }
    assert.equal(getActivityLevel(10, [1, 10, 20, 30]), 2);
});

test("365 dates align to weekdays across every possible ending weekday", () => {
    for (let day = 1; day <= 7; day++) {
        const end = `2026-01-0${day}`;
        const { cells } = buildActivityCalendar(end);
        const actual = cells.filter(Boolean);
        assert.equal(actual.length, 365);
        assert.equal(new Set(actual.map((cell) => cell.date)).size, 365);
        assert.equal(cells.length % 7, 0);
        assert.equal(actual.at(-1).date, end);
        cells.forEach((cell, index) => {
            if (cell) assert.equal(new Date(`${cell.date}T00:00:00Z`).getUTCDay(), index % 7);
        });
    }
});

test("leap day is included and source values remain signed", () => {
    const { cells, startDate } = buildActivityCalendar("2024-03-01", { "2024-02-29": -100 });
    assert.equal(startDate, "2023-03-03");
    assert.deepEqual(cells.find((cell) => cell?.date === "2024-02-29"), { date: "2024-02-29", value: -100 });
    assert.equal(cells.filter(Boolean).at(-1).value, 0);
});
