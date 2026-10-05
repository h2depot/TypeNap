import React, { useEffect, useState } from "react";
import { Computer, Languages, Moon, Save, Sun, Type, Speaker, Wallpaper } from "lucide-react";
import { GhostRadioButton, GhostSlider, GhostDropdown, GhostToggle, SpiritListItem, SpiritListView } from "../../../GhostDesignSystem";
import BackgroundDialog from "./background_dialog";
import { SOLID_PALETTE_COLORS } from "../../../../constants/colors";
import { useTranslation } from "react-i18next";
import { useAppSettings } from "../../../../store/saving/appSettings";
import { useToastStore } from "../../../../store/toastStore";
import { useBackgroundSettings } from "../shared/useBackgroundSettings";
import styles from "../tab_settings.module.css";

export default function GeneralSettings() {
    const { t } = useTranslation();
    const settings = useAppSettings((state) => state.settings);
    const updateSetting = useAppSettings((state) => state.updateSetting);
    const addToast = useToastStore((state) => state.addToast);
    const { selectedBgImage, setSelectedBgImage, wholeImageList, fetchImageList, handleAddBackgroundImage } = useBackgroundSettings(settings.bgimage?.path);
    const [isBackgroundDialogOpen, setIsBackgroundDialogOpen] = useState(false);

    const isSystem = settings.theme === "System Theme";
    const isDark = settings.theme === "Dark Theme";
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const currentTheme = isSystem ? systemTheme : (isDark ? "dark" : "light");
    const selectedBgImageName = settings.bgimage?.name
        || settings.bgimage?.path?.split(/[\\/]/).pop()
        || t("common.notSelected");
    const localizedBgImageName = selectedBgImageName === "単色背景"
        ? t("settings.background.solidColor")
        : selectedBgImageName === "背景"
            ? t("settings.background.image")
            : selectedBgImageName;


    useEffect(() => {
        if (isBackgroundDialogOpen) fetchImageList().catch(console.error);
    }, [isBackgroundDialogOpen, fetchImageList]);

    const setThemeMode = (nextTheme) => {
        updateSetting("theme", nextTheme);
        const themeLabelKey = {
            "System Theme": "settings.theme.names.system",
            "Light Theme": "settings.theme.names.light",
            "Dark Theme": "settings.theme.names.dark",
        }[nextTheme];
        addToast(t("settings.theme.changed", { theme: t(themeLabelKey) }), "info");
    };


    return (
        <>
            <SpiritListView maxWidth="100%" className={styles.settingsList}>
                <SpiritListItem
                    icon={<Computer size={20} />}
                    title={t("settings.theme.system.title")}
                    description={t("settings.theme.system.description")}
                    onClick={() => setThemeMode(isSystem ? "Dark Theme" : "System Theme")}
                    control={
                        <GhostRadioButton
                            checked={isSystem}
                            onChange={() => setThemeMode(isSystem ? "Dark Theme" : "System Theme")}
                            iconType="dot"
                        />
                    }
                />

                <SpiritListItem
                    style={{ marginLeft: "24px" }}
                    icon={isDark ? <Moon size={20} /> : <Sun size={20} />}
                    title={t(isDark ? "settings.theme.names.dark" : "settings.theme.names.light")}
                    description={t("settings.theme.manual.description")}
                    disabled={isSystem}
                    onClick={() => setThemeMode(isDark ? "Light Theme" : "Dark Theme")}
                    control={
                        <GhostToggle
                            isOn={isDark}
                            onToggle={() => setThemeMode(isDark ? "Light Theme" : "Dark Theme")}
                            scale={0.7}
                            disabled={isSystem}
                        />
                    }
                />

                <SpiritListItem
                    icon={<Wallpaper size={20} />}
                    title={t("settings.background.title")}
                    description={localizedBgImageName}
                    onClick={() => setIsBackgroundDialogOpen(true)}
                />

                <SpiritListItem
                    icon={<Languages size={20} />}
                    title={t("settings.language.title")}
                    description={t("settings.language.description")}
                    control={
                        <GhostDropdown
                            options={[
                                { value: "ja", label: t("settings.language.japanese") },
                                { value: "en", label: "English" }
                            ]}
                            value={settings.language}
                            onChange={(value) => updateSetting("language", value)}
                        />
                    }
                />

                <SpiritListItem
                    icon={<Speaker size={20} />}
                    title={t("settings.soundEffect.title")}
                    description={t("settings.soundEffect.description")}
                    control={
                        <GhostDropdown
                            options={[
                                { value: "None", label: t("settings.soundEffect.none") },
                                { value: "ChillWood", label: t("settings.soundEffect.chillWood") },
                                { value: "Raindrop", label: t("settings.soundEffect.raindrop") },
                                { value: "TypeWriter", label: t("settings.soundEffect.typeWriter") },
                            ]}
                            value={settings.sound_effect || "None"}
                            onChange={(value) => updateSetting("sound_effect", value)}
                        />
                    }
                />

                <SpiritListItem
                    icon={<Type size={20} />}
                    title={t("settings.fontSize.title")}
                    description={t("settings.fontSize.description")}
                    control={
                        <div style={{ width: "200px" }}>
                            <GhostSlider
                                min={12}
                                max={24}
                                value={settings.fontSize}
                                defaultValue={settings.fontSize}
                                onChange={(value) => {
                                    updateSetting("fontSize", value);
                                }}
                            />
                        </div>
                    }
                />

                <SpiritListItem
                    icon={<Save size={20} />}
                    title={t("settings.tabs.title")}
                    description={t("settings.tabs.description")}
                    control={
                        <GhostToggle
                            isOn={settings.SavingTab === "On"}
                            onToggle={() => {
                                const nextValue = settings.SavingTab === "On" ? "Off" : "On";
                                updateSetting("SavingTab", nextValue);
                                addToast(t(nextValue === "On" ? "settings.tabs.enabled" : "settings.tabs.disabled"), "info");
                            }}
                            scale={0.7}
                        />
                    }
                />
            </SpiritListView>
            <BackgroundDialog
                isBackgroundDialogOpen={isBackgroundDialogOpen}
                setIsBackgroundDialogOpen={setIsBackgroundDialogOpen}
                settings={settings}
                selectedBgImage={selectedBgImage}
                setSelectedBgImage={setSelectedBgImage}
                wholeImageList={wholeImageList}
                updateSetting={updateSetting}
                currentTheme={currentTheme}
                solidColors={SOLID_PALETTE_COLORS}
                onAddImageClick={handleAddBackgroundImage}
            />
        </>
    );
}
