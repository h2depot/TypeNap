const DAY_MS = 86400000;
export const DEFAULT_ACTIVITY_THRESHOLDS = [1, 500, 2000, 4000];

export function getActivityLevel(value, thresholds = DEFAULT_ACTIVITY_THRESHOLDS) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return thresholds.filter((threshold) => value >= threshold).length;
}

// Exactly 365 real dates; null cells only align the first and last weeks.
export function buildActivityCalendar(endDate, data = {}) {
    const end = Date.parse(`${endDate}T00:00:00Z`);
    if (!Number.isFinite(end)) return { cells: [], months: [], startDate: "", endDate: "" };
    const start = end - 364 * DAY_MS;
    const offset = new Date(start).getUTCDay();
    const length = Math.ceil((offset + 365) / 7) * 7;
    const cells = Array.from({ length }, (_, index) => {
        const dayIndex = index - offset;
        if (dayIndex < 0 || dayIndex >= 365) return null;
        const date = new Date(start + dayIndex * DAY_MS).toISOString().slice(0, 10);
        return { date, value: Number.isFinite(data[date]) ? data[date] : 0 };
    });
    const months = [];
    for (let column = 0; column < length / 7; column++) {
        const first = cells.slice(column * 7, column * 7 + 7).find(Boolean);
        const month = first.date.slice(0, 7);
        if (months.at(-1)?.month !== month) months.push({ column, month, date: first.date });
    }
    return { cells, months, startDate: new Date(start).toISOString().slice(0, 10), endDate };
}
