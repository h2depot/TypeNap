import React, { useId, useRef, useState } from "react";
import { CircleHelp, Settings, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import GeneralSettings from "./General/general_settings";
import EnvironmentSettings from "./Environment/environment_settings";
import HelpSettings from "./Help/help_settings";
import styles from "./tab_settings.module.css";

const sections = [
    { id: "general", label: "settings.title", icon: Settings, component: GeneralSettings },
    { id: "environment", label: "settings.environment.title", icon: Wrench, component: EnvironmentSettings },
    { id: "help", label: "settings.help.title", icon: CircleHelp, component: HelpSettings },
];

export default function Tab_Settings() {
    const { t } = useTranslation();
    const instanceId = useId();
    const [selectedTab, setSelectedTab] = useState("general");
    const tabRefs = useRef([]);

    const handleTabKeyDown = (event, index) => {
        let nextIndex;
        switch (event.key) {
            case "ArrowDown": nextIndex = (index + 1) % sections.length; break;
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
                <div role="tablist" aria-label={t("settings.title")} aria-orientation="vertical" className={styles.tabList}>
                    {sections.map(({ id, label, icon: Icon }, index) => (
                        <button
                            key={id}
                            ref={(element) => { tabRefs.current[index] = element; }}
                            type="button"
                            role="tab"
                            id={`${instanceId}-tab-${id}`}
                            aria-controls={`${instanceId}-panel-${id}`}
                            aria-selected={selectedTab === id}
                            tabIndex={selectedTab === id ? 0 : -1}
                            className={styles.tab}
                            onClick={() => setSelectedTab(id)}
                            onKeyDown={(event) => handleTabKeyDown(event, index)}
                        >
                            <Icon size={19} aria-hidden="true" />
                            <span>{t(label)}</span>
                        </button>
                    ))}
                </div>
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
                            <h1 className={styles.heading}>{t(label)}</h1>
                            <Content />
                        </div>
                    )}
                </section>
            ))}
        </div>
    );
}
