import React from "react";
import { TN_Dialog } from "../../../TNDesignSystem";
import { useTranslation } from "react-i18next";

import { shortcuts } from "../../../../InputEvent/shortcuts";

export default function ShortcutDialog({ isOpen, onClose }) {
    const { t } = useTranslation();
    return (
        <TN_Dialog
            isOpen={isOpen}
            onClose={onClose}
            title={t("settings.shortcuts.title")}
            maxWidth="680px"
        >
            <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                maxHeight: "50vh",
                overflowY: "auto",
                paddingRight: "8px",
            }}>
                <p style={{ margin: 0, color: 'var(--tn-subtext)', fontSize: '14px' }}>
                    {t('settings.shortcuts.note')}
                </p>
                {shortcuts.map((shortcut) => (
                    <div key={shortcut.id} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "16px",
                        padding: "12px 16px",
                        background: "var(--tn-hover-bg)",
                        borderRadius: "8px",
                    }}>
                        <div>
                            <div style={{ fontWeight: 'var(--font-weight-ui)' }}>{t(`settings.shortcuts.${shortcut.id}`)}</div>
                            <div style={{ color: 'var(--tn-subtext)', fontSize: '12px', marginTop: '4px' }}>{t(`settings.shortcuts.scopes.${shortcut.scope}`)}</div>
                        </div>
                        <kbd style={{
                            background: "var(--tn-card-bg)",
                            color: "var(--tn-text)",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "14px",
                            fontFamily: 'var(--font-family-ui)',
                            border: "1px solid var(--tn-border-light)",
                            whiteSpace: "nowrap",
                        }}>
                            {shortcut.label}
                        </kbd>
                    </div>
                ))}
            </div>
        </TN_Dialog>
    );
}
