import React, { memo } from "react";
import { TN_Button, TN_Dialog } from "../../../TNDesignSystem";
import { EyeOff_TN } from '../../../../assets/IconList';
import { normalizeBackgroundPath, backgroundShellColor } from '../../../../Constants/colors';
import { useTranslation } from "react-i18next";

import ImageCollectionPicker from "../../../Dialog/ImageCollectionPicker";
import paletteStyles from "../../../Dialog/ColorPalette.module.css";

function BackgroundDialog({
    isBackgroundDialogOpen,
    setIsBackgroundDialogOpen,
    settings,
    selectedBgImage,
    setSelectedBgImage,
    wholeImageList,
    updateSetting,
    solidColors,
    onAddImageClick,
}) {
    const { t } = useTranslation();

    return (
        <TN_Dialog
            isOpen={isBackgroundDialogOpen}
            onClose={() => {
                setIsBackgroundDialogOpen(false);
                setSelectedBgImage(settings.bgimage?.path || "");
            }}
            title={t("settings.backgroundDialog.title")}
            maxWidth="860px"
        >
            {isBackgroundDialogOpen && <div style={{ display: "flex", flexDirection: "column", gap: "24px", color: "var(--tn-text)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 'var(--font-weight-ui)' }}>{t("settings.backgroundDialog.chooseColour")}</p>
                    <div className={paletteStyles.palette}>
                        {["", ...solidColors].map((color) => {
                            const isSelected = selectedBgImage === color;
                            return (
                                <button
                                    type="button"
                                    className={paletteStyles.swatch}
                                    aria-label={color || t("settings.backgroundDialog.noColor")}
                                    aria-pressed={isSelected}
                                    key={color}
                                    onClick={() => setSelectedBgImage(color)}
                                    style={{
                                        position: "relative",
                                        backgroundColor: color ? backgroundShellColor(color) : "var(--app-default-shell)",
                                        color: "var(--tn-text)",
                                        padding: 0,
                                        cursor: "pointer",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                    }}
                                >
                                    {!color && <EyeOff_TN size={18} />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: 'var(--font-weight-ui)' }}>{t("settings.backgroundDialog.chooseImage")}</p>
                <ImageCollectionPicker images={wholeImageList} selectedPath={selectedBgImage}
                    onSelect={setSelectedBgImage} onImport={onAddImageClick} />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                    <TN_Button
                        variant="secondary"
                        borderRadius="6px"
                        onClick={() => {
                            setIsBackgroundDialogOpen(false);
                            setSelectedBgImage(settings.bgimage?.path || "");
                        }}
                    >
                        {t("common.cancel")}
                    </TN_Button>
                    <TN_Button
                        variant="proceed"
                        borderRadius="6px"
                        disabled={selectedBgImage === normalizeBackgroundPath(settings.bgimage?.path)}
                        onClick={() => {
                            const selectedImageObj = wholeImageList.find(img => img.path === selectedBgImage);
                            if (!selectedBgImage) {
                                updateSetting("bgimage", {});
                            } else if (selectedImageObj) {
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
                    </TN_Button>
                </div>
            </div>}
        </TN_Dialog>
    );
}

export default memo(BackgroundDialog);
