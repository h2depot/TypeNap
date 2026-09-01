import React from "react";
import { GhostDialog } from "../../GhostDesignSystem";
import { useTranslation } from "react-i18next";

const EXPLANATION = "settings.licenses.explanation";

const MomoSignature = "settings.licenses.momoSignature";

const AIgenImage = "settings.licenses.aiGeneratedImages";

export default function LicenseDialog({ isOpen, onClose }) {
    const { t } = useTranslation();

    return (
        <GhostDialog
            isOpen={isOpen}
            onClose={onClose}
            title={t("settings.licenses.title")}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <p style={{ margin: 0 }}>{t(EXPLANATION)}</p>
                <p style={{ margin: 0 }}>{t(MomoSignature)}</p>
                <p style={{ margin: 0 }}>{t(AIgenImage)}</p>
            </div>
        </GhostDialog>
    );
}
