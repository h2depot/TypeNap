import React, { memo, useEffect, useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Plus } from "lucide-react";
import { GhostButton, GhostCheckBox, GhostDialog, GhostIconButton, GhostTooltip } from "../../GhostDesignSystem";
import { useTranslation } from "react-i18next";

function BgDeleteDialog({
    isBgDeleteDialogOpen,
    setIsBgDeleteDialogOpen,
    wholeImageList,
    deleteUserImage,
    fetchImageList,
    settings,
    updateSetting,
    selectedBgImage,
    setSelectedBgImage,
    addToast,
    currentTheme,
    onAddImageClick,
}) {
    const { t } = useTranslation();
    const [selectedImageNames, setSelectedImageNames] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    const userImageList = useMemo(
        () => wholeImageList.filter((image) => image.kind === "user"),
        [wholeImageList]
    );

    useEffect(() => {
        if (!isBgDeleteDialogOpen) {
            setSelectedImageNames([]);
        }
    }, [isBgDeleteDialogOpen]);

    const selectedImageNameSet = useMemo(() => new Set(selectedImageNames), [selectedImageNames]);
    const selectedImages = useMemo(
        () => userImageList.filter((image) => selectedImageNameSet.has(image.name)),
        [selectedImageNameSet, userImageList]
    );

    const toggleImage = (imageName, checked) => {
        setSelectedImageNames((prev) => checked
            ? [...new Set([...prev, imageName])]
            : prev.filter((name) => name !== imageName));
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            for (const image of selectedImages) {
                await deleteUserImage(image.name);
            }

            const deletedPaths = new Set(selectedImages.map((image) => image.path));
            if (deletedPaths.has(settings.bgimage?.path)) {
                updateSetting("bgimage", {});
            }
            if (deletedPaths.has(selectedBgImage)) {
                setSelectedBgImage("");
            }

            await fetchImageList();
            setSelectedImageNames([]);
            addToast(t("settings.imageManager.deleted"), "success");
            setIsBgDeleteDialogOpen(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleAddImage = async () => {
        setIsAdding(true);
        try {
            await onAddImageClick();
        } catch (error) {
            console.error(error);
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <GhostDialog
            isOpen={isBgDeleteDialogOpen}
            onClose={() => {
                if (!isDeleting) {
                    setIsBgDeleteDialogOpen(false);
                }
            }}
            title={t("settings.imageManager.title")}
        >
            {isBgDeleteDialogOpen && <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                maxHeight: "60vh",
                overflowY: "auto",
                padding: "16px",
                color: "var(--ghost-text)",
            }}>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "14px", fontWeight: 700 }}>
                            {t("settings.imageManager.userImages")}
                        </div>
                        <div style={{ marginTop: "4px", fontSize: "12px", opacity: 0.7 }}>
                            {t("settings.imageManager.count", { count: userImageList.length })}
                        </div>
                    </div>
                    <GhostTooltip content={t("settings.backgroundDialog.addImage")} position="left">
                        <GhostIconButton
                            variant="primary"
                            size="large"
                            borderRadius="8px"
                            icon={<Plus />}
                            disabled={isDeleting || isAdding}
                            onClick={handleAddImage}
                        />
                    </GhostTooltip>
                </div>

                {userImageList.length === 0 ? (
                    <div style={{ fontSize: "14px", opacity: 0.7 }}>
                        {t("settings.imageManager.empty")}
                    </div>
                ) : (
                    userImageList.map((image) => (
                        <div
                            key={image.path}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                padding: "12px",
                                borderRadius: "8px",
                                background: currentTheme === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
                            }}
                        >
                            <GhostCheckBox
                                checked={selectedImageNameSet.has(image.name)}
                                onChange={(checked) => toggleImage(image.name, checked)}
                                disabled={isDeleting}
                            />
                            <img
                                src={convertFileSrc(image.path)}
                                alt={image.name}
                                loading="lazy"
                                decoding="async"
                                draggable="false"
                                style={{
                                    width: "72px",
                                    height: "48px",
                                    objectFit: "cover",
                                    borderRadius: "6px",
                                    flex: "0 0 auto",
                                }}
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}>
                                    {image.name}
                                </div>
                                <div style={{
                                    marginTop: "4px",
                                    fontSize: "12px",
                                    opacity: 0.65,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}>
                                    {image.path}
                                </div>
                            </div>
                        </div>
                    ))
                )}

                <div style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "12px",
                    marginTop: "8px",
                    paddingTop: "16px",
                    borderTop: currentTheme === "light" ? "1px solid rgba(0,0,0,0.1)" : "1px solid rgba(255,255,255,0.1)",
                }}>
                    <GhostButton
                        variant="secondary"
                        borderRadius="6px"
                        disabled={isDeleting}
                        onClick={() => setIsBgDeleteDialogOpen(false)}
                    >
                        {t("common.cancel")}
                    </GhostButton>
                    <GhostButton
                        variant="danger"
                        borderRadius="6px"
                        disabled={selectedImageNames.length === 0 || isDeleting}
                        onClick={handleDelete}
                    >
                        {isDeleting ? t("common.deleting") : t("common.delete")}
                    </GhostButton>
                </div>
            </div>}
        </GhostDialog>
    );
}

export default memo(BgDeleteDialog);
