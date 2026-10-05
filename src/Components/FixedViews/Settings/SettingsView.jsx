import React, { useId, useRef, useState } from "react";
import { Help, Settings, Statistics, Wrench } from '../../../assets/IconList';
import { useTranslation } from "react-i18next";
import GeneralSettings from "./General/general_settings";
import EnvironmentSettings from "./Environment/environment_settings";
import HelpSettings from "./Help/help_settings";
import StatisticsSettings from "./Statistics/statistics_settings";
import TypeNapLogo from "../../TypeNapLogo/TypeNapLogo";
import styles from "./SettingsView.module.css";

const sections = [
    { id: "general", label: "settings.design.general", icon: Settings, component: GeneralSettings },
    { id: "environment", label: "settings.environment.title", icon: Wrench, component: EnvironmentSettings },
    { id: "help", label: "settings.help.title", icon: Help, component: HelpSettings },
    { id: "statistics", label: "settings.statistics.title", icon: Statistics, component: StatisticsSettings },
];

export default function SettingsView() {
    const { t } = useTranslation();
    const instanceId = useId();
    const [selectedTab, setSelectedTab] = useState("general");
    const tabRefs = useRef([]);

    const handleTabKeyDown = (event, index) => {
        let nextIndex;
        switch (event.key) {
            case "ArrowRight":
            case "ArrowDown": nextIndex = (index + 1) % sections.length; break;
            case "ArrowLeft":
            case "ArrowUp": nextIndex = (index - 1 + sections.length) % sections.length; break;
            case "Home": nextIndex = 0; break;
            case "End": nextIndex = sections.length - 1; break;
            default: return;
        }
        event.preventDefault();
        setSelectedTab(sections[nextIndex].id);
        tabRefs.current[nextIndex]?.focus();
    };

    return (
        <div className={styles.layout}>
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeading}><Settings size={22} aria-hidden="true" /><span>{t("settings.title")}</span></div>
                <div role="tablist" aria-label={t("settings.title")} aria-orientation="vertical" className={styles.tabList}>
                    {sections.map(({ id, label, icon: Icon }, index) => (
                        <button
                            key={id}
                            ref={(element) => { tabRefs.current[index] = element; }}
                            type="button"
                            role="tab"
                            aria-label={t(label)}
                            title={t(label)}
                            id={`${instanceId}-tab-${id}`}
                            aria-controls={`${instanceId}-panel-${id}`}
                            aria-selected={selectedTab === id}
                            tabIndex={selectedTab === id ? 0 : -1}
                            className={styles.tab}
                            onClick={() => setSelectedTab(id)}
                            onKeyDown={(event) => handleTabKeyDown(event, index)}
                        >
                            <Icon size={19} aria-hidden="true" />
                            <span className={styles.tabText}>{t(label)}</span>
                        </button>
                    ))}
                </div>
                <div className={styles.sidebarFooter}><TypeNapLogo className={styles.footerLogo} /><span>{t("settings.design.footer")}</span></div>
            </aside>

            {sections.map(({ id, label, component: Content }) => (
                <section
                    key={id}
                    role="tabpanel"
                    id={`${instanceId}-panel-${id}`}
                    aria-labelledby={`${instanceId}-tab-${id}`}
                    hidden={selectedTab !== id}
                    tabIndex={0}
                    className={styles.content}
                >
                    {selectedTab === id && (
                        <div className={styles.contentInner}>
                            <header className={styles.pageHeader}>
                                <p className={styles.eyebrow}>PREFERENCES / {String(sections.findIndex((section) => section.id === id) + 1).padStart(2, "0")}</p>
                                <h1 className={styles.heading}>{t(label)}</h1>
                                <p className={styles.pageDescription}>{t(`settings.design.description.${id}`)}</p>
                            </header>
                            <Content />
                        </div>
                    )}
                </section>
            ))}
        </div>
    );
}
