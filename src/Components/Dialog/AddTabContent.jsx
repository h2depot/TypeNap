import React, { useState, useEffect, useCallback, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useTabStore } from "../../store/tabStore";
import { useFileStore } from "../../store/fileStore";
import { useAppSettings } from "../../store/saving/appSettings";
import { useBgImageStore } from "../../store/bgImageStore";
import { TN_TextField, TN_Button, TN_IconButton, TN_ImageOption, TN_Tooltip } from "../TNDesignSystem";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from '../../assets/IconList';
import { SOLID_PALETTE_COLORS } from "../../Constants/colors";
import { useTranslation } from "react-i18next";

export default function AddTabContent({ onComplete }) {
    const { t } = useTranslation();
    const addTab = useTabStore((state) => state.addTab);
    const createStory = useFileStore((state) => state.createStory);
    const storyList = useFileStore((state) => state.storyList);
    const themeSetting = useAppSettings((state) => state.settings.theme);
    const fetchImageList = useBgImageStore((state) => state.fetchImageList);
    const addUserImage = useBgImageStore((state) => state.addUserImage);
    const wholeImageList = useBgImageStore((state) => state.wholeImageList);

    const [tabName, setTabName] = useState("");
    const [coverColor, setCoverColor] = useState(SOLID_PALETTE_COLORS[0]);
    const [isAddingImage, setIsAddingImage] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const normalizedTabName = tabName.trim().toLocaleLowerCase();
    const storyNameExists = useMemo(() => normalizedTabName !== "" && storyList.some((story) => (
        story.story_name.trim().toLocaleLowerCase() === normalizedTabName
    )), [normalizedTabName, storyList]);

    useEffect(() => {
        fetchImageList();
    }, [fetchImageList]);

    const currentTheme = themeSetting === "Light Theme" ? "light" : "dark";
    const selectCover = useCallback((path) => setCoverColor(path), []);

    const handleAddImageClick = async () => {
        if (isAddingImage) return;
        setIsAddingImage(true);
        try {
            const selected = await open({
                multiple: false,
                filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }]
            });
            if (selected) {
                await addUserImage(selected);
                await fetchImageList();
            }
        } catch (error) {
            console.error("Failed to select or add image", error);
        } finally {
            setIsAddingImage(false);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (tabName.trim() === "" || storyNameExists || isSubmitting) return;

        setIsSubmitting(true);
        const trimmedTabName = tabName.trim();
        try {
            await createStory(trimmedTabName, coverColor);

            addTab('story', trimmedTabName, { story_name: trimmedTabName });

            if (onComplete) onComplete();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{
                    fontSize: '14px',
                    fontWeight: 'var(--font-weight-ui)',
                    color: currentTheme === 'light' ? '#232b69' : '#D4CFBF',
                    opacity: 0.8
                }}>
                    {t("story.create.nameLabel")}
                </label>
                <TN_TextField
                    value={tabName}
                    onChange={(e) => setTabName(e.target.value)}
                    placeholder={t("story.create.namePlaceholder")}
                    autoFocus
                />
                {storyNameExists && (
                    <div style={{ color: "#d9534f", fontSize: "13px", fontWeight: 'var(--font-weight-ui)' }}>
                        {t("story.create.duplicateName")}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{
                    fontSize: '14px',
                    fontWeight: 'var(--font-weight-ui)',
                    color: currentTheme === 'light' ? '#232b69' : '#D4CFBF',
                    opacity: 0.8
                }}>
                    {t("story.cover.color")}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {SOLID_PALETTE_COLORS.map((color) => {
                        const isSelected = coverColor === color;
                        return (
                            <div
                                key={color}
                                onClick={() => setCoverColor(color)}
                                style={{
                                    position: "relative",
                                    width: "40px",
                                    height: "40px",
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
                                                background: "var(--tn-gradient, linear-gradient(135deg, #a777e3, #6e8efb))",
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{
                    fontSize: '14px',
                    fontWeight: 'var(--font-weight-ui)',
                    color: currentTheme === 'light' ? '#232b69' : '#D4CFBF',
                    opacity: 0.8
                }}>
                    {t("background.chooseImage")}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {wholeImageList.map((image) => (
                        <TN_ImageOption
                            key={image.path}
                            image={image}
                            selected={coverColor === image.path}
                            onSelect={selectCover}
                            width={80}
                            height={70}
                        />
                    ))}
                    <TN_Tooltip content={t("image.addNew")} position="bottom">
                        <TN_IconButton
                            variant="primary"
                            size="medium"
                            borderRadius="8px"
                            icon={<Plus size={18} />}
                            onClick={handleAddImageClick}
                            disabled={isAddingImage || isSubmitting}
                        />
                    </TN_Tooltip>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <TN_Button
                    onClick={(e) => {
                        e.preventDefault();
                        if (onComplete) onComplete();
                    }}
                    variant="secondary"
                >
                    {t("common.cancel")}
                </TN_Button>
                <TN_Button
                    onClick={handleSubmit}
                    variant="proceed"
                    disabled={tabName.trim() === "" || storyNameExists || isSubmitting}
                >
                    {t("story.create.submit")}
                </TN_Button>
            </div>
        </form>
    );
}
