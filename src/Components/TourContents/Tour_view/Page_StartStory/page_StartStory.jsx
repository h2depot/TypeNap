import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { GhostImageOption } from "../../../GhostDesignSystem";
import { useBgImageStore } from "../../../../store/bgImageStore";
import { useAppSettings } from "../../../../store/saving/appSettings";
import styles from "./page_StartStory.module.css";

export default function PageStartStory() {
    const { t } = useTranslation();
    const wholeImageList = useBgImageStore((state) => state.wholeImageList);
    const fetchImageList = useBgImageStore((state) => state.fetchImageList);
    const background = useAppSettings((state) => state.settings.bgimage);
    const isSettingsReady = useAppSettings((state) => state.isReady);
    const updateSetting = useAppSettings((state) => state.updateSetting);

    const presetBackgrounds = useMemo(
        () => wholeImageList.filter((image) => image.kind === "preset"),
        [wholeImageList]
    );

    useEffect(() => {
        fetchImageList();
    }, [fetchImageList]);

    useEffect(() => {
        if (!isSettingsReady || background?.path || presetBackgrounds.length === 0) return;
        updateSetting("bgimage", presetBackgrounds[0]);
    }, [background?.path, presetBackgrounds, isSettingsReady, updateSetting]);

    const selectBackground = (path) => {
        const selectedImage = presetBackgrounds.find((image) => image.path === path);
        if (selectedImage) updateSetting("bgimage", selectedImage);
    };

    return (
        <motion.div
            className={styles.content}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
        >
            <h1>{t("tour.startStory.title")}</h1>
            <p className={styles.description}>
                {t("tour.startStory.description")}
            </p>

            <div className={styles.backgrounds} aria-label={t("tour.startStory.selectBackground")}>
                {presetBackgrounds.map((image, index) => (
                    <motion.div
                        key={image.path}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.18 + index * 0.1, duration: 0.4 }}
                    >
                        <GhostImageOption
                            image={image}
                            selected={background?.path === image.path}
                            onSelect={selectBackground}
                            width={220}
                            height={145}
                        />
                    </motion.div>
                ))}
            </div>

            {presetBackgrounds.length === 0 && (
                <p className={styles.loading}>{t("tour.startStory.loadingBackgrounds")}</p>
            )}
        </motion.div>
    );
}
