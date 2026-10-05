import React, { useMemo, useRef, useState } from "react";
import { useTNTheme } from "./theme";
import TN_Tooltip from "./TN_Tooltip";
import { buildActivityCalendar, DEFAULT_ACTIVITY_THRESHOLDS, getActivityLevel } from "./activityHeatmap";
import styles from "./TN_ActivityHeatmap.module.css";

/** Date-keyed numeric data, UTC YYYY-MM-DD endDate, four ascending thresholds.
 * Labels/formatValue are supplied by the consumer so the component has no store/i18n dependency.
 */
export default function TN_ActivityHeatmap({
    data = {}, endDate = new Date().toISOString().slice(0, 10),
    color = "#E8890D", thresholds = DEFAULT_ACTIVITY_THRESHOLDS,
    locale = "en", title = "Activity in the last 365 days",
    lessLabel = "Less", moreLabel = "More", loadingLabel = "Loading…",
    formatValue = (value) => new Intl.NumberFormat(locale).format(value),
    loading = false, theme: themeOverride, className = "",
}) {
    const theme = useTNTheme(themeOverride);
    const calendar = useMemo(() => buildActivityCalendar(endDate, data), [endDate, data]);
    const buttons = useRef({});
    const [focusedDate, setFocusedDate] = useState(null);
    const monthFormat = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
    const dayFormat = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" });
    const shortFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
    const asDate = (date) => new Date(`${date}T00:00:00Z`);
    const activeDate = calendar.cells.some((cell) => cell?.date === focusedDate) ? focusedDate : calendar.endDate;
    const columns = calendar.cells.length / 7;
    const colors = ["var(--heatmap-empty)", ...[25, 45, 70, 100].map((amount) =>
        `color-mix(in srgb, ${color} ${amount}%, var(--heatmap-empty))`)];
    const handleKeyDown = (event, index) => {
        const delta = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[event.key];
        let next;
        if (delta != null) next = index + delta;
        else if (event.key === "Home") next = calendar.cells.findIndex(Boolean);
        else if (event.key === "End") next = calendar.cells.findLastIndex(Boolean);
        else return;
        event.preventDefault();
        const cell = calendar.cells[next];
        if (cell) buttons.current[cell.date]?.focus();
    };
    return (
        <section className={`${styles.root} ${className}`} style={{ "--heatmap-columns": columns }} data-theme={theme} aria-label={title} aria-busy={loading}>
            <div className={styles.header}>
                <h3 className={styles.title}>{title}</h3>
                <span className={styles.range}>{calendar.startDate && `${shortFormat.format(asDate(calendar.startDate))} – ${shortFormat.format(asDate(calendar.endDate))}`}</span>
            </div>
            {loading ? <p className={styles.loading} role="status">{loadingLabel}</p> : (
                <div className={styles.viewport}>
                    <div className={styles.calendar}>
                        <div className={styles.months} aria-hidden="true">
                            {calendar.months.map(({ column, month, date }) => (
                                <span key={month} style={{ gridColumn: column + 1 }}>{monthFormat.format(asDate(date))}</span>
                            ))}
                        </div>
                        <div className={styles.weekdays} aria-hidden="true">
                            {Array.from({ length: 7 }, (_, day) => <span key={day}>{day % 2 === 1 ? dayFormat.format(new Date(Date.UTC(2026, 0, 4 + day))) : ""}</span>)}
                        </div>
                        <div className={styles.cells}>
                            {calendar.cells.map((cell, index) => cell ? (
                                <TN_Tooltip key={cell.date} subtle content={`${dateFormat.format(asDate(cell.date))}: ${formatValue(cell.value)}`}>
                                    <button type="button" className={styles.cell}
                                        ref={(node) => { if (node) buttons.current[cell.date] = node; else delete buttons.current[cell.date]; }}
                                        style={{ background: colors[getActivityLevel(cell.value, thresholds)] }}
                                        aria-label={`${dateFormat.format(asDate(cell.date))}: ${formatValue(cell.value)}`}
                                        tabIndex={cell.date === activeDate ? 0 : -1}
                                        onFocus={() => setFocusedDate(cell.date)}
                                        onKeyDown={(event) => handleKeyDown(event, index)} />
                                </TN_Tooltip>
                            ) : <span key={`padding-${index}`} className={styles.padding} aria-hidden="true" />)}
                        </div>
                    </div>
                </div>
            )}
            <div className={styles.legend} aria-label={`${lessLabel} – ${moreLabel}`}>
                <span>{lessLabel}</span>
                {colors.map((background, level) => {
                    const label = level === 0 ? formatValue(0) : level === thresholds.length
                        ? `${formatValue(thresholds[level - 1])}+`
                        : `${formatValue(thresholds[level - 1])} – ${formatValue(thresholds[level] - 1)}`;
                    return <TN_Tooltip key={level} subtle content={label}><span className={styles.swatch} style={{ background }} role="img" aria-label={label} tabIndex={0} /></TN_Tooltip>;
                })}
                <span>{moreLabel}</span>
            </div>
        </section>
    );
}
