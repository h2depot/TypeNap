import React from "react";
import { useTranslation } from "react-i18next";
import { TN_Button, TN_Dialog } from "../TNDesignSystem";

export default function TerminateAppDialog({ isOpen, files, onCancel, onTerminate }) {
    const { t } = useTranslation();

    return (
        <TN_Dialog
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
                background: "var(--tn-hover-bg)",
            }}>
                {files.map((file) => (
                    <div key={file} style={{ wordBreak: "break-word" }}>{file}</div>
                ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <TN_Button variant="default" onClick={onCancel}>
                    {t("common.cancel")}
                </TN_Button>
                <TN_Button variant="proceed" onClick={onTerminate}>
                    {t("app.terminate.closeWithoutSaving")}
                </TN_Button>
            </div>
        </TN_Dialog>
    );
}
