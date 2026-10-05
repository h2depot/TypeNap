import React, { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./WindowControls.module.css";

export default function WindowControls({ standalone = false }) {
    const { t } = useTranslation();
    const [maximized, setMaximized] = useState(false);

    useEffect(() => {
        if (!isTauri()) return;
        const appWindow = getCurrentWindow();
        let active = true;
        let unlisten;
        const sync = async () => {
            try {
                const value = await appWindow.isMaximized();
                if (active) setMaximized(value);
            } catch (error) {
                console.error("Failed to read window state:", error);
            }
        };
        sync();
        appWindow.onResized(sync).then((dispose) => {
            if (active) unlisten = dispose;
            else dispose();
        }).catch(console.error);
        return () => { active = false; unlisten?.(); };
    }, []);

    const run = async (action) => {
        if (!isTauri()) return;
        try {
            const appWindow = getCurrentWindow();
            await appWindow[action]();
            if (action === "toggleMaximize") setMaximized(await appWindow.isMaximized());
        } catch (error) {
            console.error(`Window action ${action} failed:`, error);
        }
    };

    return (
        <div className={standalone ? styles.standalone : styles.controls}>
            {standalone && <div className={styles.dragRegion} data-tauri-drag-region />}
            {[
                ["minimize", t("windowControls.minimize"), Minus],
                ["toggleMaximize", t(maximized ? "windowControls.restore" : "windowControls.maximize"), maximized ? Copy : Square],
                ["close", t("windowControls.close"), X],
            ].map(([action, label, Icon]) => (
                <button key={action} type="button" title={label} aria-label={label}
                    className={`${styles.button} ${action === "close" ? styles.close : ""}`}
                    onClick={() => run(action)}>
                    <Icon size={16} aria-hidden="true" />
                </button>
            ))}
        </div>
    );
}
