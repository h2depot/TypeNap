import { useEffect, useState } from "react";
import { Sun, Moon, Computer } from 'lucide-react';
import { WallPaper, Languages, Search, Speaker, Stack, Type, Check } from '../../../../assets/IconList';
import { SettingsListView, SettingsRow, SettingsSelect, SettingsToggle } from "../shared/SettingsListView";
import BackgroundDialog from "./background_dialog";
import { BACKGROUND_PALETTE_COLORS, normalizeBackgroundPath } from "../../../../Constants/colors";
import { useTranslation } from "react-i18next";
import { useAppSettings } from "../../../../store/saving/appSettings";
import { useToastStore } from "../../../../store/toastStore";
import { useBackgroundSettings } from "../shared/useBackgroundSettings";
import styles from "../SettingsView.module.css";
import TN_Slider from '../../../TNDesignSystem/TN_Slider';

const themeOptions = [
    { value: "Light Theme", key: "light", icon: Sun },
    { value: "Dark Theme", key: "dark", icon: Moon },
    { value: "System Theme", key: "system", icon: Computer },
];

function ThemePreview({ mode }) {
    const modes = mode === 'system' ? ['light', 'dark'] : [mode];
    return (
        <span className={styles.themePreview} data-mode={mode} aria-hidden="true">
            {modes.map((appearance) => (
                <span key={appearance} className={styles.previewApp} data-mode={appearance}>
                    <span className={styles.previewSidebar}><i /><i /><i /></span>
                    <span className={styles.previewPanel}><i /><i /><i /></span>
                </span>
            ))}
        </span>
    );
}

export default function GeneralSettings() {
    const { t } = useTranslation();
    const settings = useAppSettings((state) => state.settings);
    const updateSetting = useAppSettings((state) => state.updateSetting);
    const addToast = useToastStore((state) => state.addToast);
    const { selectedBgImage, setSelectedBgImage, wholeImageList, fetchImageList, handleAddBackgroundImage } = useBackgroundSettings(settings.bgimage?.path);
    const [isBackgroundDialogOpen, setIsBackgroundDialogOpen] = useState(false);
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const currentTheme = settings.theme === "System Theme" ? systemTheme : settings.theme === "Dark Theme" ? "dark" : "light";
    const selectedBgImageName = settings.bgimage?.name || settings.bgimage?.path?.split(/[\\/]/).pop() || t("common.notSelected");
    const localizedBgImageName = !normalizeBackgroundPath(settings.bgimage?.path)
        ? t("settings.backgroundDialog.noColor")
        : selectedBgImageName === "単色背景" ? t("settings.background.solidColor")
        : selectedBgImageName === "背景" ? t("settings.background.image") : selectedBgImageName;

    useEffect(() => {
        if (isBackgroundDialogOpen) fetchImageList().catch(console.error);
    }, [isBackgroundDialogOpen, fetchImageList]);

    const setThemeMode = (option) => {
        if (settings.theme === option.value) return;
        updateSetting("theme", option.value);
        addToast(t("settings.theme.changed", { theme: t(`settings.theme.names.${option.key}`) }), "info");
    };

    return (
        <div className={styles.groups}>
            <SettingsListView title={t("settings.design.appearance")} description={t("settings.design.appearanceDescription")}>
                <fieldset className={styles.themePicker}>
                    <legend>{t("settings.design.theme")}</legend>
                    <div className={styles.themeOptions}>
                        {themeOptions.map((option) => {
                            const Icon = option.icon;
                            return <label key={option.key} className={styles.themeOption} data-selected={settings.theme === option.value}>
                                <input type="radio" name="settings-theme" value={option.value} checked={settings.theme === option.value} onChange={() => setThemeMode(option)} />
                                <ThemePreview mode={option.key} />
                                <span className={styles.themeLabel}><Icon size={16} aria-hidden="true" />{t(`settings.design.${option.key}`)}<span className={styles.themeCheck} aria-hidden="true">{settings.theme === option.value && <Check size={14} />}</span></span>
                            </label>;
                        })}
                    </div>
                </fieldset>
                <SettingsRow icon={<WallPaper size={20} />} title={t("settings.background.title")} description={localizedBgImageName}
                    onClick={() => { setSelectedBgImage(normalizeBackgroundPath(settings.bgimage?.path)); setIsBackgroundDialogOpen(true); }} />
            </SettingsListView>

            <SettingsListView title={t("settings.design.writing")} description={t("settings.design.writingDescription")}>
                <SettingsRow icon={<Type size={20} />} title={t("settings.design.fontSize")} description={t("settings.fontSize.description")}
                    control={<div className={styles.rangeControl}>
                        <div className={styles.sliderWrap}><TN_Slider min={12} max={24} value={settings.fontSize} defaultValue={settings.fontSize} scale={0.7} aria-label={t("settings.design.fontSize")} onChange={(value) => updateSetting("fontSize", value)} /></div>
                        <output>{settings.fontSize}<span>px</span></output>
                    </div>}>
                    <div className={styles.writingPreview}>
                        <span className={styles.previewCaption}>{t("settings.design.preview")}</span>
                        <p style={{ fontSize: `${settings.fontSize}px` }}>{t("settings.design.sample")}</p>
                    </div>
                </SettingsRow>
                <SettingsRow icon={<Speaker size={20} />} title={t("settings.soundEffect.title")} description={t("settings.soundEffect.description")}
                    control={<SettingsSelect label={t("settings.soundEffect.title")} options={[
                        { value: "None", label: t("settings.soundEffect.none") }, { value: "ChillWood", label: t("settings.soundEffect.chillWood") },
                        { value: "Raindrop", label: t("settings.soundEffect.raindrop") }, { value: "TypeWriter", label: t("settings.soundEffect.typeWriter") },
                    ]} value={settings.sound_effect || "None"} onChange={(value) => updateSetting("sound_effect", value)} />} />
                <SettingsRow icon={<Stack size={20} />} title={t("settings.tabs.title")} description={t("settings.tabs.description")}
                    control={<SettingsToggle label={t("settings.tabs.title")} isOn={settings.SavingTab === "On"} onToggle={() => {
                        const nextValue = settings.SavingTab === "On" ? "Off" : "On";
                        updateSetting("SavingTab", nextValue);
                        addToast(t(nextValue === "On" ? "settings.tabs.enabled" : "settings.tabs.disabled"), "info");
                    }} />} />
            </SettingsListView>

            <SettingsListView title={t("settings.design.languageSearch")}>
                <SettingsRow icon={<Languages size={20} />} title={t("settings.language.title")} description={t("settings.language.description")}
                    control={<SettingsSelect label={t("settings.language.title")} options={[{ value: "ja", label: t("settings.language.japanese") }, { value: "en", label: "English" }]}
                        value={settings.language} onChange={(value) => updateSetting("language", value)} />} />
                <SettingsRow icon={<Search size={20} />} title={t("settings.searchEngine.title")} description={t("settings.searchEngine.description")}
                    control={<SettingsSelect label={t("settings.searchEngine.title")} options={["Google", "Bing", "DuckDuckGo", "Yahoo"].map((value) => ({ value, label: value }))}
                        value={settings.SearchingEngine || "Google"} onChange={(value) => updateSetting("SearchingEngine", value)} />} />
            </SettingsListView>
            <BackgroundDialog isBackgroundDialogOpen={isBackgroundDialogOpen} setIsBackgroundDialogOpen={setIsBackgroundDialogOpen}
                settings={settings} selectedBgImage={selectedBgImage} setSelectedBgImage={setSelectedBgImage}
                wholeImageList={wholeImageList} updateSetting={updateSetting} currentTheme={currentTheme}
                solidColors={BACKGROUND_PALETTE_COLORS} onAddImageClick={handleAddBackgroundImage} />
        </div>
    );
}

