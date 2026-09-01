import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Computer, History, Images, Keyboard, Languages, Lock, Moon, Save, Scale, Sun, Trash2, Type, Wallpaper, Wrench } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppSettings } from "../../../store/saving/appSettings";
import { useFileStore } from "../../../store/fileStore";
import { useToastStore } from "../../../store/toastStore";
import {
    GhostIconButton,
    GhostRadioButton,
    GhostSlider,
    GhostDropdown,
    GhostToggle,
    SpiritListItem,
    SpiritListView,
} from "../../GhostDesignSystem";
import { useBgImageStore } from "../../../store/bgImageStore";
import BackgroundDialog from "./background_dialog";
import BgDeleteDialog from "./bg_delete_dialog";
import DataDeleteDialog from "./data_delete_dialog";
import RestoreDialog from "./restore_dialog";
import ScanDialog from "./scan_dialog";
import ShortcutDialog from "./shortcut_dialog";
import LicenseDialog from "./license_dialog";
import { SOLID_PALETTE_COLORS } from "../../../constants/colors";
import { useTranslation } from "react-i18next";

const restoreItemKey = (item) => [
    item.directoryName ?? "",
    item.backupKind ?? "",
    item.fileName ?? "",
].join("\u001f");

const restoreItemFromEntry = (story, entry) => ({
    directoryName: story.directoryName,
    backupKind: entry.backupKind,
    fileName: entry.fileName ?? null,
});

const restoreStoryKey = (story) => story.directoryName ?? "";

const getStoryRestoreItems = (story) => {
    const storyEntry = story.entries.find((entry) => entry.backupKind === "story");
    if (storyEntry) {
        return [restoreItemFromEntry(story, storyEntry)];
    }

    return story.entries.map((entry) => restoreItemFromEntry(story, entry));
};

export default function Tab_Settings() {
    const { t } = useTranslation();
    const settings = useAppSettings((state) => state.settings);
    const updateSetting = useAppSettings((state) => state.updateSetting);
    const scan = useFileStore((state) => state.scan);
    const deleteNonTxtFiles = useFileStore((state) => state.deleteNonTxtFiles);
    const fetchDeletedFiles = useFileStore((state) => state.fetchDeletedFiles);
    const restoreDeletedFiles = useFileStore((state) => state.restoreDeletedFiles);
    const executeCompleteDeletion = useFileStore((state) => state.executeCompleteDeletion);
    const addToast = useToastStore((state) => state.addToast);
    const addUserImage = useBgImageStore((state) => state.addUserImage);
    const deleteUserImage = useBgImageStore((state) => state.deleteUserImage);
    const fetchImageList = useBgImageStore((state) => state.fetchImageList);
    const wholeImageList = useBgImageStore((state) => state.wholeImageList);

    const [isShortcutDialogOpen, setIsShortcutDialogOpen] = useState(false);
    const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);
    const [isScanDialogOpen, setIsScanDialogOpen] = useState(false);
    const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
    const [scanList, setScanList] = useState([]);
    const [deleteList, setDeleteList] = useState([]);
    const [deletedFiles, setDeletedFiles] = useState([]);
    const [selectedRestoreItems, setSelectedRestoreItems] = useState([]);
    const [selectedRestoreStoryKeys, setSelectedRestoreStoryKeys] = useState([]);
    const [isRestoreLoading, setIsRestoreLoading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isDataDeletionLocked, setIsDataDeletionLocked] = useState(true);
    const [isDataDeleteDialogOpen, setIsDataDeleteDialogOpen] = useState(false);
    const [isBackgroundDialogOpen, setIsBackgroundDialogOpen] = useState(false);
    const [isBgDeleteDialogOpen, setIsBgDeleteDialogOpen] = useState(false);
    const [selectedDeleteItems, setSelectedDeleteItems] = useState([]);
    const [selectedDeleteStoryKeys, setSelectedDeleteStoryKeys] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedBgImage, setSelectedBgImage] = useState(settings.bgimage?.path || "");

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

    const userImageCount = useMemo(
        () => wholeImageList.filter((image) => image.kind === "user").length,
        [wholeImageList]
    );

    useEffect(() => {
        if (isBackgroundDialogOpen || isBgDeleteDialogOpen) {
            fetchImageList();
        }
    }, [isBackgroundDialogOpen, isBgDeleteDialogOpen, fetchImageList]);

    useEffect(() => {
        let cancelled = false;

        const loadDeletedFiles = async () => {
            if (!isRestoreDialogOpen && !isDataDeleteDialogOpen) {
                setSelectedRestoreItems([]);
                setSelectedRestoreStoryKeys([]);
                setSelectedDeleteItems([]);
                setSelectedDeleteStoryKeys([]);
                return;
            }

            setIsRestoreLoading(true);
            try {
                const files = await fetchDeletedFiles();
                if (!cancelled) {
                    setDeletedFiles(files);
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (!cancelled) {
                    setIsRestoreLoading(false);
                }
            }
        };

        loadDeletedFiles();
        return () => {
            cancelled = true;
        };
    }, [isRestoreDialogOpen, isDataDeleteDialogOpen, fetchDeletedFiles]);

    const isRestoreItemSelected = (item) => {
        const itemKey = restoreItemKey(item);
        return selectedRestoreItems.some((selected) => restoreItemKey(selected) === itemKey);
    };

    const toggleRestoreItem = (item) => {
        const itemKey = restoreItemKey(item);
        const storyKey = item.directoryName ?? "";

        setSelectedRestoreStoryKeys((prev) => prev.filter((key) => key !== storyKey));
        setSelectedRestoreItems((prev) => {
            if (prev.some((selected) => restoreItemKey(selected) === itemKey)) {
                return prev.filter((selected) => restoreItemKey(selected) !== itemKey);
            }
            return [...prev, item];
        });
    };

    const toggleRestoreItems = (story, items) => {
        if (items.length === 0) {
            return;
        }

        const storyKey = restoreStoryKey(story);
        setSelectedRestoreItems((prev) => {
            const itemKeys = new Set(items.map(restoreItemKey));
            const storySelected = selectedRestoreStoryKeys.includes(storyKey);

            if (storySelected) {
                return prev.filter((selected) => !itemKeys.has(restoreItemKey(selected)));
            }

            const next = [...prev];
            for (const item of items) {
                if (!next.some((selected) => restoreItemKey(selected) === restoreItemKey(item))) {
                    next.push(item);
                }
            }
            return next;
        });
        setSelectedRestoreStoryKeys((prev) => (
            prev.includes(storyKey)
                ? prev.filter((key) => key !== storyKey)
                : [...prev, storyKey]
        ));
    };

    const isDeleteItemSelected = (item) => {
        const itemKey = restoreItemKey(item);
        return selectedDeleteItems.some((selected) => restoreItemKey(selected) === itemKey);
    };

    const toggleDeleteItem = (item) => {
        const itemKey = restoreItemKey(item);
        const storyKey = item.directoryName ?? "";

        setSelectedDeleteStoryKeys((prev) => prev.filter((key) => key !== storyKey));
        setSelectedDeleteItems((prev) => {
            if (prev.some((selected) => restoreItemKey(selected) === itemKey)) {
                return prev.filter((selected) => restoreItemKey(selected) !== itemKey);
            }
            return [...prev, item];
        });
    };

    const toggleDeleteItems = (story, items) => {
        if (items.length === 0) {
            return;
        }

        const storyKey = restoreStoryKey(story);
        setSelectedDeleteItems((prev) => {
            const itemKeys = new Set(items.map(restoreItemKey));
            const storySelected = selectedDeleteStoryKeys.includes(storyKey);

            if (storySelected) {
                return prev.filter((selected) => !itemKeys.has(restoreItemKey(selected)));
            }

            const next = [...prev];
            for (const item of items) {
                if (!next.some((selected) => restoreItemKey(selected) === restoreItemKey(item))) {
                    next.push(item);
                }
            }
            return next;
        });
        setSelectedDeleteStoryKeys((prev) => (
            prev.includes(storyKey)
                ? prev.filter((key) => key !== storyKey)
                : [...prev, storyKey]
        ));
    };

    const setThemeMode = (nextTheme) => {
        updateSetting("theme", nextTheme);
        const themeLabelKey = {
            "System Theme": "settings.theme.names.system",
            "Light Theme": "settings.theme.names.light",
            "Dark Theme": "settings.theme.names.dark",
        }[nextTheme];
        addToast(t("settings.theme.changed", { theme: t(themeLabelKey) }), "info");
    };

    const handleAddBackgroundImage = useCallback(async () => {
        const file = await open({
            multiple: false,
            directory: false,
            filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg"] }],
        });

        if (!file) {
            return;
        }

        await addUserImage(file);
        const imageList = await fetchImageList();
        const fileName = file.split(/[\\/]/).pop();
        const addedImage = imageList.find((image) => image.kind === "user" && image.name === fileName);
        setSelectedBgImage(addedImage?.path || file);
    }, [addUserImage, fetchImageList]);

    return (
        <div style={{ padding: "24px", paddingBottom: "48px" }}>
            <h1 style={{
                fontSize: "24px",
                fontWeight: 700,
                marginBottom: "24px",
                color: "var(--ghost-text)",
            }}>
                {t("settings.title")}
            </h1>

            <SpiritListView maxWidth="100%">
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
                    icon = {<Languages size={20} />}
                    title={t("settings.language.title")}
                    description={t("settings.language.description")}
                    control = {
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

            <h1 style={{
                fontSize: "24px",
                fontWeight: 700,
                marginTop: "48px",
                marginBottom: "24px",
                color: "var(--ghost-text)",
            }}>
                {t("settings.environment.title")}
            </h1>

            <SpiritListView maxWidth="100%">
                <SpiritListItem
                    icon={<Wrench size={20} />}
                    title={t("settings.scan.title")}
                    description={t("settings.scan.description")}
                    control={
                        <GhostIconButton
                            icon={<Wrench size={20} />}
                            onClick={async () => {
                                const scanListResult = await scan();
                                if (scanListResult.length === 0) {
                                    addToast(t("settings.scan.noneFound"), "success");
                                } else {
                                    setScanList(scanListResult);
                                    setDeleteList(scanListResult);
                                    setIsScanDialogOpen(true);
                                }
                            }}
                        />
                    }
                />

                <SpiritListItem
                    icon={<Images size={20} />}
                    title={t("settings.images.title")}
                    description={t("settings.images.count", { count: userImageCount })}
                    onClick={() => setIsBgDeleteDialogOpen(true)}
                />

                <SpiritListItem
                    icon={<History size={20} />}
                    title={t("settings.restore.title")}
                    description={t("settings.restore.description")}
                    onClick={() => setIsRestoreDialogOpen(true)}
                />

                <SpiritListItem
                    icon={<Lock size={20} />}
                    title={t("settings.deleteLock.title")}
                    description={t("settings.deleteLock.description")}
                    onClick={() => setIsDataDeletionLocked((prev) => !prev)}
                    control={
                        <GhostToggle
                            isOn={isDataDeletionLocked}
                            onToggle={() => setIsDataDeletionLocked((prev) => !prev)}
                            scale={0.7}
                        />
                    }
                />

                <SpiritListItem
                    style={{ marginLeft: "24px" }}
                    icon={<Trash2 size={20} />}
                    title={t("settings.delete.title")}
                    description={t("settings.delete.description")}
                    disabled={isDataDeletionLocked}
                    onClick={() => {
                        if (!isDataDeletionLocked) {
                            setIsDataDeleteDialogOpen(true);
                        }
                    }}
                />
            </SpiritListView>

            <h1 style={{
                fontSize: "24px",
                fontWeight: 700,
                marginTop: "48px",
                marginBottom: "24px",
                color: "var(--ghost-text)",
            }}>
                {t("settings.help.title")}
            </h1>

            <SpiritListView maxWidth="100%">
                <SpiritListItem
                    icon={<Keyboard size={20} />}
                    title={t("settings.shortcuts.title")}
                    description={t("settings.shortcuts.description")}
                    onClick={() => setIsShortcutDialogOpen(true)}
                />

                <SpiritListItem
                    icon={<Scale size={20} />}
                    title={t("settings.licenses.title")}
                    description={t("settings.licenses.description")}
                    onClick={() => setIsLicenseDialogOpen(true)}
                />
            </SpiritListView>

            <ShortcutDialog
                isOpen={isShortcutDialogOpen}
                onClose={() => setIsShortcutDialogOpen(false)}
            />

            <LicenseDialog
                isOpen={isLicenseDialogOpen}
                onClose={() => setIsLicenseDialogOpen(false)}
            />

            <ScanDialog
                isScanDialogOpen={isScanDialogOpen}
                setIsScanDialogOpen={setIsScanDialogOpen}
                scanList={scanList}
                setScanList={setScanList}
                deleteList={deleteList}
                setDeleteList={setDeleteList}
                deleteNonTxtFiles={deleteNonTxtFiles}
                addToast={addToast}
            />

            <RestoreDialog
                isRestoreDialogOpen={isRestoreDialogOpen}
                setIsRestoreDialogOpen={setIsRestoreDialogOpen}
                isRestoring={isRestoring}
                setIsRestoring={setIsRestoring}
                isRestoreLoading={isRestoreLoading}
                deletedFiles={deletedFiles}
                getStoryRestoreItems={getStoryRestoreItems}
                selectedRestoreStoryKeys={selectedRestoreStoryKeys}
                restoreStoryKey={restoreStoryKey}
                toggleRestoreItems={toggleRestoreItems}
                restoreItemFromEntry={restoreItemFromEntry}
                restoreItemKey={restoreItemKey}
                isRestoreItemSelected={isRestoreItemSelected}
                toggleRestoreItem={toggleRestoreItem}
                selectedRestoreItems={selectedRestoreItems}
                restoreDeletedFiles={restoreDeletedFiles}
                fetchDeletedFiles={fetchDeletedFiles}
                setDeletedFiles={setDeletedFiles}
                setSelectedRestoreItems={setSelectedRestoreItems}
                setSelectedRestoreStoryKeys={setSelectedRestoreStoryKeys}
                addToast={addToast}
                currentTheme={currentTheme}
            />

            <DataDeleteDialog
                isDataDeleteDialogOpen={isDataDeleteDialogOpen}
                setIsDataDeleteDialogOpen={setIsDataDeleteDialogOpen}
                isDeleting={isDeleting}
                setIsDeleting={setIsDeleting}
                isRestoreLoading={isRestoreLoading}
                deletedFiles={deletedFiles}
                getStoryRestoreItems={getStoryRestoreItems}
                selectedDeleteStoryKeys={selectedDeleteStoryKeys}
                restoreStoryKey={restoreStoryKey}
                toggleDeleteItems={toggleDeleteItems}
                restoreItemFromEntry={restoreItemFromEntry}
                restoreItemKey={restoreItemKey}
                isDeleteItemSelected={isDeleteItemSelected}
                toggleDeleteItem={toggleDeleteItem}
                selectedDeleteItems={selectedDeleteItems}
                executeCompleteDeletion={executeCompleteDeletion}
                fetchDeletedFiles={fetchDeletedFiles}
                setDeletedFiles={setDeletedFiles}
                setSelectedDeleteItems={setSelectedDeleteItems}
                setSelectedDeleteStoryKeys={setSelectedDeleteStoryKeys}
                addToast={addToast}
                currentTheme={currentTheme}
            />

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

            <BgDeleteDialog
                isBgDeleteDialogOpen={isBgDeleteDialogOpen}
                setIsBgDeleteDialogOpen={setIsBgDeleteDialogOpen}
                wholeImageList={wholeImageList}
                deleteUserImage={deleteUserImage}
                fetchImageList={fetchImageList}
                settings={settings}
                updateSetting={updateSetting}
                selectedBgImage={selectedBgImage}
                setSelectedBgImage={setSelectedBgImage}
                addToast={addToast}
                currentTheme={currentTheme}
                onAddImageClick={handleAddBackgroundImage}
            />
        </div>
    );
}
