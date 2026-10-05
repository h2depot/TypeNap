import React from "react";
import { TN_Button, TN_CheckBox, TN_Dialog } from "../../../TNDesignSystem";
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
        <TN_Dialog
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
                <p style={{ margin: 0, fontWeight: 'var(--font-weight-ui)', color: "var(--tn-text)" }}>
                    {t("scan.found", { count: scanList.length })}
                </p>
                {scanList.map((path) => (
                    <div key={path} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 16px",
                        background: "var(--tn-hover-bg)",
                        borderRadius: "8px",
                    }}>
                        <TN_CheckBox
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
                            fontFamily: 'var(--font-family-ui)',
                            flex: 1,
                            color: "var(--tn-text)",
                        }}>
                            {path}
                        </div>
                    </div>
                ))}
                {scanList.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
                        <TN_Button
                            variant="secondary"
                            borderRadius="6px"
                            onClick={() => {
                                setIsScanDialogOpen(false);
                                setScanList([]);
                                setDeleteList([]);
                            }}
                        >
                            {t("common.cancel")}
                        </TN_Button>
                        <TN_Button
                            variant="proceed"
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
                        </TN_Button>
                    </div>
                )}
            </div>
        </TN_Dialog>
    );
}
