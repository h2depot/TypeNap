import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStatsStore } from "../../../../store/saving/stats";
import { getRecentCharacterCount, getWritingStreak } from "../../../../store/saving/statsSummary";
import TN_ActivityHeatmap from "../../../TNDesignSystem/TN_ActivityHeatmap";
import { formatCharacterCount } from "./formatCharacterCount";
import styles from "./statistics_settings.module.css";

export default function StatisticsSettings() {
    const { t, i18n } = useTranslation();
    const stats = useStatsStore((state) => state.stats);
    const isReady = useStatsStore((state) => state.isReady);
    const refreshWritingStreak = useStatsStore((state) => state.refreshWritingStreak);
    const [today, setToday] = useState(() => new Date().toISOString().slice(0, 10));

    useEffect(() => {
        const timer = setInterval(() => setToday(new Date().toISOString().slice(0, 10)), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (isReady) void refreshWritingStreak();
    }, [today, isReady, refreshWritingStreak]);

    const locale = i18n.resolvedLanguage || i18n.language;
    const formatter = new Intl.NumberFormat(locale);
    const streak = getWritingStreak(stats.daily_chars, today);
    const values = [
        { label: "total", value: stats.total_chars, unit: "unit", compact: true },
        { label: "recent", value: getRecentCharacterCount(stats.daily_chars, today), unit: "unit", compact: true },
        { label: "longestStreak", value: streak.longest_days, unit: "days" },
        { label: "currentStreak", value: streak.current_days, unit: "days" },
    ];

    return (
        <div aria-busy={!isReady}>
            <dl className={styles.cards}>
                {values.map(({ label, value, unit, compact }) => (
                    <div key={label} className={styles.card}>
                        <dt className={styles.label}>{t(`settings.statistics.${label}`)}</dt>
                        <dd className={styles.value} title={isReady ? `${formatter.format(Number.isFinite(value) ? value : 0)} ${t(`settings.statistics.${unit}`)}` : undefined}>
                            {isReady ? (compact ? formatCharacterCount(value, locale) : formatter.format(value)) : "—"}
                            <span className={styles.unit}>{t(`settings.statistics.${unit}`)}</span>
                        </dd>
                    </div>
                ))}
            </dl>
            <TN_ActivityHeatmap
                className={styles.heatmap}
                data={stats.daily_chars}
                endDate={today}
                loading={!isReady}
                locale={i18n.resolvedLanguage || i18n.language}
                title={t("settings.statistics.activity")}
                lessLabel={t("settings.statistics.less")}
                moreLabel={t("settings.statistics.more")}
                loadingLabel={t("settings.statistics.loading")}
                formatValue={(value) => `${formatter.format(value)} ${t("settings.statistics.unit")}`}
            />
            <p className={styles.note}>{t("settings.statistics.description")}</p>
            <p className={styles.streakNote}>{t("settings.statistics.streakDescription")}</p>
        </div>
    );
}
