import React, { memo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";
import { GhostButton, GhostDialog, GhostIconButton, GhostTooltip } from "../../GhostDesignSystem";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

function BackgroundDialog({
    isBackgroundDialogOpen,
    setIsBackgroundDialogOpen,
    settings,
    selectedBgImage,
    setSelectedBgImage,
    wholeImageList,
    updateSetting,
    currentTheme,
    solidColors,
    onAddImageClick,
}) {
    const { t } = useTranslation();

    return (
        <GhostDialog
            isOpen={isBackgroundDialogOpen}
            onClose={() => {
                setIsBackgroundDialogOpen(false);
                setSelectedBgImage(settings.bgimage?.path || "");
            }}
            title={t("settings.backgroundDialog.title")}
        >
            {isBackgroundDialogOpen && <div style={{ padding: "16px", color: "var(--ghost-text)", maxHeight: "60vh", overflowY: "auto" }}>
                <div style={{ marginBottom: "24px" }}>
                    <p style={{ marginBottom: "12px", fontSize: "14px", fontWeight: "bold" }}>{t("settings.backgroundDialog.chooseColour")}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                        {solidColors.map((color) => {
                            const isSelected = selectedBgImage === color;
                            return (
                                <div
                                    key={color}
                                    onClick={() => setSelectedBgImage(color)}
                                    style={{
                                        position: "relative",
                                        width: "48px",
                                        height: "48px",
                                        borderRadius: "50%",
                                        backgroundColor: color,
                                        cursor: "pointer",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        border: currentTheme === "light" ? "1px solid rgba(0,0,0,0.1)" : "1px solid rgba(255,255,255,0.1)",
                                    }}
                                >
                                    <AnimatePresence>
                                        {isSelected && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.25, ease: "easeOut" }}
                                                style={{
                                                    position: "absolute",
                                                    inset: 0,
                                                    borderRadius: "50%",
                                                    padding: "2px",
                                                    background: "var(--ghost-gradient, linear-gradient(135deg, #a777e3, #6e8efb))",
                                                    WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                                    WebkitMaskComposite: "xor",
                                                    maskComposite: "exclude",
                                                    pointerEvents: "none",
                                                    zIndex: 10,
                                                }}
                                            />
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <p style={{ marginBottom: "12px", fontSize: "14px", fontWeight: "bold" }}>{t("settings.backgroundDialog.chooseImage")}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
                    {wholeImageList.length === 0 ? (
                        <p style={{ fontSize: "14px", opacity: 0.6 }}>{t("settings.backgroundDialog.noImages")}</p>
                    ) : (
                        wholeImageList.map((image) => {
                            const isSelected = selectedBgImage === image.path;
                            return (
                                <div
                                    key={image.path}
                                    onClick={() => {
                                        setSelectedBgImage(image.path);
                                    }}
                                    style={{
                                        position: "relative",
                                        width: "120px",
                                        height: "105px",
                                        display: "flex",
                                        flexDirection: "column",
                                        cursor: "pointer",
                                        borderRadius: "8px",
                                        overflow: "hidden",
                                        background: currentTheme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)"
                                    }}>
                                    <AnimatePresence>
                                        {isSelected && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.25, ease: "easeOut" }}
                                                style={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    borderRadius: '8px',
                                                    padding: '2px',
                                                    background: 'var(--ghost-gradient, linear-gradient(135deg, #a777e3, #6e8efb))',
                                                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                                                    WebkitMaskComposite: 'xor',
                                                    maskComposite: 'exclude',
                                                    pointerEvents: 'none',
                                                    zIndex: 10
                                                }}
                                            />
                                        )}
                                    </AnimatePresence>
                                    {image.path && (
                                        <>
                                            <img
                                                src={convertFileSrc(image.path)}
                                                alt={image.name}
                                                loading="lazy"
                                                decoding="async"
                                                draggable="false"
                                                style={{ width: "100%", height: "100%", objectFit: "cover", minHeight: 0 }}
                                            />
                                            <span style={{
                                                color: "var(--ghost-text)",
                                                fontSize: "12px",
                                                textAlign: "center",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                padding: "4px"
                                            }}>
                                                {image.name}
                                            </span>
                                        </>
                                    )}
                                    {!image.path &&
                                        <span>{t("settings.backgroundDialog.missingPath")}</span>
                                    }
                                </div>
                            );
                        })
                    )}
                    <GhostTooltip content={t("settings.backgroundDialog.addImage")} position="bottom">
                        <GhostIconButton
                            variant="primary"
                            size="large"
                            borderRadius="8px"
                            icon={<Plus />}
                            onClick={onAddImageClick}
                        />
                    </GhostTooltip>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: currentTheme === "light" ? "1px solid rgba(0,0,0,0.1)" : "1px solid rgba(255,255,255,0.1)" }}>
                    <GhostButton
                        variant="secondary"
                        borderRadius="6px"
                        onClick={() => {
                            setIsBackgroundDialogOpen(false);
                            setSelectedBgImage(settings.bgimage?.path || "");
                        }}
                    >
                        {t("common.cancel")}
                    </GhostButton>
                    <GhostButton
                        variant="primary"
                        borderRadius="6px"
                        disabled={!selectedBgImage || selectedBgImage === settings.bgimage?.path}
                        onClick={() => {
                            const selectedImageObj = wholeImageList.find(img => img.path === selectedBgImage);
                            if (selectedImageObj) {
                                updateSetting("bgimage", selectedImageObj);
                            } else if (selectedBgImage && (selectedBgImage.startsWith("#") || selectedBgImage.startsWith("var("))) {
                                updateSetting("bgimage", { path: selectedBgImage, name: t("settings.backgroundDialog.solidName") });
                            } else {
                                updateSetting("bgimage", { path: selectedBgImage, name: t("settings.backgroundDialog.imageName") });
                            }
                            setIsBackgroundDialogOpen(false);
                        }}
                    >
                        {t("common.confirm")}
                    </GhostButton>
                </div>
            </div>}
        </GhostDialog>
    );
}

export default memo(BackgroundDialog);
