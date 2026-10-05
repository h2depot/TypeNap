// Persisted calendar dates use the backend's UTC clock.
export function isStatsDate(date) {
    return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
        && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
        && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
}

export function migrateDailyChars(dailyChars, weeklyChars) {
    const result = {};
    for (const [date, chars] of Object.entries(dailyChars ?? {})) {
        if (isStatsDate(date) && Number.isFinite(chars)) result[date] = Math.max(0, chars);
    }
    for (const entry of Object.values(weeklyChars ?? {})) {
        if (isStatsDate(entry?.date) && Number.isFinite(entry?.chars)
            && !Object.hasOwn(result, entry.date)) result[entry.date] = Math.max(0, entry.chars);
    }
    return result;
}

export function getRecentCharacterCount(dailyChars, today = new Date().toISOString().slice(0, 10)) {
    const end = Date.parse(`${today}T00:00:00Z`);
    const start = end - 6 * 86400000;
    return Object.entries(dailyChars ?? {}).reduce((sum, [key, value]) => {
        // Also accept legacy entries while migrating older callers.
        const date = Date.parse(`${typeof value === "object" ? value?.date : key}T00:00:00Z`);
        const chars = typeof value === "object" ? value?.chars : value;
        return date >= start && date <= end && Number.isFinite(chars) ? sum + Math.max(0, chars) : sum;
    }, 0);
}

export function getWritingStreak(dailyChars, today = new Date().toISOString().slice(0, 10)) {
    const dates = Object.entries(dailyChars ?? {})
        .filter(([date, chars]) => isStatsDate(date) && date <= today && Number.isFinite(chars) && chars >= 1)
        .map(([date]) => date).sort();
    let run = 0;
    let longest = 0;
    let previous = null;
    for (const date of dates) {
        const timestamp = Date.parse(`${date}T00:00:00Z`);
        run = previous !== null && timestamp - previous === 86400000 ? run + 1 : 1;
        longest = Math.max(longest, run);
        previous = timestamp;
    }
    const end = Date.parse(`${today}T00:00:00Z`);
    return {
        current_days: previous !== null && end - previous <= 86400000 ? run : 0,
        longest_days: longest,
        last_writing_date: dates.at(-1) ?? null,
        as_of_date: today,
    };
}
