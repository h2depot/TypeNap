import React from "react";
import { useTranslation } from "react-i18next";
import { GhostButton, GhostDialog } from "../GhostDesignSystem";

export default function TerminateAppDialog({ isOpen, files, onCancel, onTerminate }) {
    const { t } = useTranslation();

    return (
        <GhostDialog
            isOpen={isOpen}
            onClose={onCancel}
            title={t("app.terminate.title")}
            maxWidth="440px"
        >
            <p style={{ margin: "0 0 16px" }}>{t("app.terminate.message")}</p>
            <div style={{
                maxHeight: "160px",
                overflowY: "auto",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "var(--ghost-hover-bg)",
            }}>
                {files.map((file) => (
                    <div key={file} style={{ wordBreak: "break-word" }}>{file}</div>
                ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <GhostButton variant="default" onClick={onCancel}>
                    {t("common.cancel")}
                </GhostButton>
                <GhostButton variant="danger" onClick={onTerminate}>
                    {t("app.terminate.closeWithoutSaving")}
                </GhostButton>
            </div>
        </GhostDialog>
    );
}
