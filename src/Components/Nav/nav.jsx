import React from "react";
import { Library, Settings, Workspace } from '../../assets/IconList';
import { useTabStore } from "../../store/tabStore";
import styles from "./nav.module.css";
import { TN_NavButton, TN_Tooltip } from "../TNDesignSystem";

export default function Navigation() {
    const { appMode, setAppMode } = useTabStore();

    return (
        <nav className={styles.container} aria-label="Main navigation">
            <TN_NavButton
                className={styles.workspace}
                icon={<Workspace size={32} />}
                selected={appMode === "workspace"}
                onClick={() => setAppMode("workspace")}
                aria-label="Workspace"
            />
            <div className={styles.group}>
                <TN_Tooltip content="Library" position="right">
                    <TN_NavButton
                        icon={<Library />}
                        onClick={() => setAppMode("library")}
                        selected={appMode === "library"}
                        aria-label="Library"
                        aria-current={appMode === "library" ? "page" : undefined}
                    />
                </TN_Tooltip>
            </div>

            <div className={styles.group}>
                <TN_Tooltip content="Settings" position="right">
                    <TN_NavButton
                        icon={<Settings />}
                        onClick={() => setAppMode("settings")}
                        selected={appMode === "settings"}
                        aria-label="Settings"
                        aria-current={appMode === "settings" ? "page" : undefined}
                    />
                </TN_Tooltip>
            </div>
        </nav>
    );
}
