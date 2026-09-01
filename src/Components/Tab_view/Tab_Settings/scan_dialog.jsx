import React from "react";
import { GhostButton, GhostCheckBox, GhostDialog } from "../../GhostDesignSystem";
import { useTranslation } from "react-i18next";

export default function ScanDialog({
    isScanDialogOpen,
    setIsScanDialogOpen,
    scanList,
    setScanList,
    deleteList,
    setDeleteList,
    deleteNonTxtFiles,
    addToast,
}) {
    const { t } = useTranslation();
    return (
        <GhostDialog
            isOpen={isScanDialogOpen}
            onClose={() => setIsScanDialogOpen(false)}
            title={t("scan.title")}
        >
            <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                maxHeight: "50vh",
                overflowY: "auto",
                paddingRight: "8px",
            }}>
                <p style={{ margin: 0, fontWeight: 500, color: "var(--ghost-text)" }}>
                    {t("scan.found", { count: scanList.length })}
                </p>
                {scanList.map((path) => (
                    <div key={path} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 16px",
                        background: "var(--ghost-hover-bg)",
                        borderRadius: "8px",
                    }}>
                        <GhostCheckBox
                            checked={deleteList.includes(path)}
                            onChange={(checked) => {
                                setDeleteList((prev) => checked
                                    ? [...new Set([...prev, path])]
                                    : prev.filter((item) => item !== path));
                            }}
                        />
                        <div style={{
                            wordBreak: "break-all",
                            fontSize: "14px",
                            fontFamily: "monospace",
                            flex: 1,
                            color: "var(--ghost-text)",
                        }}>
                            {path}
                        </div>
                    </div>
                ))}
                {scanList.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
                        <GhostButton
                            variant="secondary"
                            borderRadius="6px"
                            onClick={() => {
                                setIsScanDialogOpen(false);
                                setScanList([]);
                                setDeleteList([]);
                            }}
                        >
                            {t("common.cancel")}
                        </GhostButton>
                        <GhostButton
                            variant="danger"
                            borderRadius="6px"
                            disabled={deleteList.length === 0}
                            onClick={async () => {
                                try {
                                    await deleteNonTxtFiles(deleteList);
                                    addToast(t("scan.deleted"), "success");
                                    setIsScanDialogOpen(false);
                                    setScanList([]);
                                    setDeleteList([]);
                                } catch (error) {
                                    console.error(error);
                                }
                            }}
                        >
                            {t("common.delete")}
                        </GhostButton>
                    </div>
                )}
            </div>
        </GhostDialog>
    );
}
