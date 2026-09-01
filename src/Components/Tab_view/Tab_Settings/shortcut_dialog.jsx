import React from "react";
import { GhostDialog } from "../../GhostDesignSystem";
import { useTranslation } from "react-i18next";

const shortcuts = [
    { key: "Ctrl + S", descKey: "save" },
    { key: "Ctrl + W", descKey: "closeTab" },
    { key: "Ctrl + Tab", descKey: "nextTab" },
    { key: "Ctrl + Shift + Tab", descKey: "previousTab" },
    { key: "Ctrl + ,", descKey: "openSettings" },
    { key: "Ctrl + .", descKey: "openLibrary" },
    { key: "Ctrl + H", descKey: "openHome" },
    { key: "Ctrl + N", descKey: "create" },
    { key: "Ctrl + F", descKey: "search" },
    { key: "Esc", descKey: "closeDialog" },
];

export default function ShortcutDialog({ isOpen, onClose }) {
    const { t } = useTranslation();
    return (
        <GhostDialog
            isOpen={isOpen}
            onClose={onClose}
            title={t("settings.shortcuts.title")}
        >
            <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                maxHeight: "50vh",
                overflowY: "auto",
                paddingRight: "8px",
            }}>
                {shortcuts.map((shortcut) => (
                    <div key={shortcut.key} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "16px",
                        padding: "12px 16px",
                        background: "var(--ghost-hover-bg)",
                        borderRadius: "8px",
                    }}>
                        <span style={{ fontWeight: 500 }}>{t(`settings.shortcuts.${shortcut.descKey}`)}</span>
                        <span style={{
                            background: "var(--ghost-card-bg)",
                            color: "var(--ghost-text)",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "14px",
                            fontFamily: "monospace",
                            border: "1px solid var(--ghost-border-light)",
                            whiteSpace: "nowrap",
                        }}>
                            {shortcut.key}
                        </span>
                    </div>
                ))}
            </div>
        </GhostDialog>
    );
}
