import React from "react";
import { BluePrint, GoBack, Images, Library, Settings, Workspace } from '../../assets/IconList';
import { useTabStore } from "../../store/tabStore";
import styles from "./nav.module.css";
import { TN_IconButton, TN_NavButton, TN_Tooltip } from "../TNDesignSystem";
import { useTranslation } from "react-i18next";

export default function Navigation() {
    const { appMode, setAppMode } = useTabStore();
    const { t } = useTranslation();
    const workspaceLabel = t(appMode === "workspace" ? "navigation.workspace" : "navigation.resume");

    return (
        <nav className={styles.container} aria-label={t("navigation.label")}>
            <div className={styles.workspaceAnchor}>
            <TN_Tooltip content={workspaceLabel} position="right" subtle>
            {appMode === "workspace" ? <TN_NavButton
                className={styles.workspace}
                icon={<Workspace size={32} />}
                selected={appMode === "workspace"}
                onClick={() => setAppMode("workspace")}
                aria-label={workspaceLabel}
            /> : <TN_IconButton
                icon={<GoBack />}
                size="small"
                onClick={() => setAppMode("workspace")}
                aria-label={workspaceLabel}
            />}
            </TN_Tooltip>
            </div>
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
                <TN_Tooltip content="Template" position="right">
                    <TN_NavButton
                        icon={<BluePrint />}
                        onClick={() => setAppMode("template")}
                        selected={appMode === "template"}
                        aria-label="Template"
                        aria-current={appMode === "template" ? "page" : undefined}
                    />
                </TN_Tooltip>
                <TN_Tooltip content={t('navigation.images')} position="right">
                    <TN_NavButton
                        icon={<Images />}
                        onClick={() => setAppMode('images')}
                        selected={appMode === 'images'}
                        aria-label={t('navigation.images')}
                        aria-current={appMode === 'images' ? 'page' : undefined}
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
