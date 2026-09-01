import React, { useEffect, useMemo, useState } from "react";
import { FileText, BarChart3, TrendingUp, Activity, Clock3 } from "lucide-react";
import { useStatsStore } from "../../../store/saving/stats";
import { useTabStore } from "../../../store/tabStore";
import { SpiritCard, SpiritListView, SpiritListItem } from "../../GhostDesignSystem";
import styles from "./tab_home.module.css";
import { useTranslation } from "react-i18next";

export default function Tab_Home() {
    const { t } = useTranslation();
    const { stats, isReady, initStats } = useStatsStore();
    const { addTab } = useTabStore();
    const [greetingKey, setGreetingKey] = useState("home.greeting.afternoon");

    const titleColor = "var(--ghost-text)";
    const accentColor = "var(--ghost-accent)";
    const secondaryColor = "var(--ghost-subtext)";

    useEffect(() => {
        if (!isReady) {
            initStats();
        }
        const hour = new Date().getHours();
        if (hour < 5) setGreetingKey("home.greeting.evening");
        else if (hour < 11) setGreetingKey("home.greeting.morning");
        else if (hour < 17) setGreetingKey("home.greeting.afternoon");
        else setGreetingKey("home.greeting.evening");
    }, [isReady, initStats]);

    const uniqueRecentFiles = useMemo(() => {
        if (!stats.recent_file) return [];
        const seen = new Set();
        const result = [];
        for (const file of stats.recent_file) {
            const key = `${file.storyName}/${file.txtName}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(file);
            }
        }
        return result;
    }, [stats.recent_file]);

    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayLabels = t("home.weekdays", { returnObjects: true });
    const weeklyData = days.map(day => stats.weekly_chars?.[day]?.chars || 0);
    const maxChars = Math.max(...weeklyData, 1); // 0除算防止
    const totalChars = weeklyData.reduce((a, b) => a + b, 0);
    const avgChars = Math.round(totalChars / 7);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 style={{ color: titleColor, margin: 0, fontSize: '28px', fontWeight: 800 }}>
                    {t("home.greeting.message", { greeting: t(greetingKey) })}
                </h1>
            </div>

            <div className={styles.dashboardGrid}>
                <div className={styles.mainCol}>
                    <div className={styles.statsRow}>
                        <SpiritCard style={{ flex: 1, padding: '16px', margin: 0, maxWidth: 'none', boxSizing: 'border-box', minWidth: 0 }}>
                            <div className={styles.statBadge}>
                                <div className={styles.statLabel} style={{ color: secondaryColor }}>
                                    <TrendingUp size={16} /> {t("home.stats.weekTotal")}
                                </div>
                                <div className={styles.statValue} style={{ color: titleColor }}>
                                    {totalChars.toLocaleString()} <span className={styles.statUnit}>{t("common.characters")}</span>
                                </div>
                            </div>
                        </SpiritCard>
                        <SpiritCard style={{ flex: 1, padding: '16px', margin: 0, maxWidth: 'none', boxSizing: 'border-box', minWidth: 0 }}>
                            <div className={styles.statBadge}>
                                <div className={styles.statLabel} style={{ color: secondaryColor }}>
                                    <Activity size={16} /> {t("home.stats.dailyAverage")}
                                </div>
                                <div className={styles.statValue} style={{ color: titleColor }}>
                                    {avgChars.toLocaleString()} <span className={styles.statUnit}>{t("common.characters")}</span>
                                </div>
                            </div>
                        </SpiritCard>
                    </div>

                    <SpiritCard style={{ padding: '20px', width: '100%', maxWidth: 'none', margin: '0', flexGrow: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', minWidth: 0 }}>
                        <div className={styles.sectionHeader}>
                            <h2 style={{ color: titleColor, display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '18px' }}>
                                <BarChart3 size={20} color={accentColor} />
                                {t("home.activity")}
                            </h2>
                        </div>
                        <div className={styles.chartContainer}>
                            <div className={styles.chartArea}>
                                {weeklyData.map((chars, index) => {
                                    const heightPercentage = (chars / maxChars) * 100;
                                    const isToday = index === new Date().getDay();
                                    return (
                                        <div key={days[index]} className={`${styles.barGroup} ${isToday ? styles.isToday : ''}`}>
                                            <div className={styles.barTrack} style={{ background: 'var(--ghost-hover-bg)' }}>
                                                <div
                                                    className={styles.barFill}
                                                    style={{
                                                        height: `${heightPercentage}%`,
                                                        backgroundColor: isToday ? accentColor : 'var(--ghost-border-light)',
                                                        boxShadow: isToday ? '0 0 10px var(--ghost-glow)' : 'none'
                                                    }}
                                                    title={t("common.characterCount", { count: chars })}
                                                />
                                            </div>
                                            <span className={styles.barLabel} style={{ color: isToday ? accentColor : secondaryColor, fontWeight: isToday ? 700 : 500 }}>
                                                {dayLabels[index]}
                                            </span>
                                            <span className={styles.barValue} style={{ color: secondaryColor }}>
                                                {chars > 0 ? chars : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </SpiritCard>
                </div>

                <div className={styles.sideCol}>
                    <SpiritCard style={{ padding: '20px', margin: 0, height: '100%', width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', minWidth: 0 }}>
                        <div className={styles.sectionHeader} style={{ marginBottom: '16px' }}>
                            <h2 style={{ color: titleColor, display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '18px' }}>
                                <Clock3 size={20} color={accentColor} />
                                {t("home.recentFiles")}
                            </h2>
                        </div>

                        <div className={styles.recentFilesWrapper}>
                            {uniqueRecentFiles.length > 0 ? (
                                <SpiritListView maxWidth="100%">
                                    {uniqueRecentFiles.map((file, idx) => (
                                        <div className={styles.listItemWrapper} key={`${file.storyName}-${file.txtName}-${idx}`} style={{ animationDelay: `${idx * 0.05}s` }}>
                                            <SpiritListItem
                                                icon={<FileText size={18} />}
                                                title={file.txtName}
                                                description={file.storyName}
                                                onClick={() => addTab('work', file.txtName, { story_name: file.storyName, title: file.txtName })}
                                            />
                                        </div>
                                    ))}
                                </SpiritListView>
                            ) : (
                                <div className={styles.emptyState}>
                                    <FileText size={32} style={{ opacity: 0.2, marginBottom: '12px' }} color={titleColor} />
                                    <p style={{ color: secondaryColor, margin: 0, fontSize: '14px' }}>{t("home.noRecentFiles")}</p>
                                </div>
                            )}
                        </div>
                    </SpiritCard>
                </div>
            </div>
        </div>
    );
}
