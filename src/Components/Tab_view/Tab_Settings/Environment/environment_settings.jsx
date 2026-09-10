import React, { useEffect, useMemo, useState } from "react";
import { History, Images, Lock, Trash2, Wrench } from "lucide-react";
import { GhostIconButton, GhostToggle, SpiritListItem, SpiritListView } from "../../../GhostDesignSystem";
import { useFileStore } from "../../../../store/fileStore";
import BgDeleteDialog from "./bg_delete_dialog";
import DataDeleteDialog from "./data_delete_dialog";
import RestoreDialog from "./restore_dialog";
import ScanDialog from "./scan_dialog";
import { useTranslation } from "react-i18next";
import { useAppSettings } from "../../../../store/saving/appSettings";
import { useToastStore } from "../../../../store/toastStore";
import { useBackgroundSettings } from "../shared/useBackgroundSettings";
import styles from "../tab_settings.module.css";

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


export default function EnvironmentSettings() {
    const { t } = useTranslation();
    const settings = useAppSettings((state) => state.settings);
    const updateSetting = useAppSettings((state) => state.updateSetting);
    const addToast = useToastStore((state) => state.addToast);
    const { selectedBgImage, setSelectedBgImage, wholeImageList, fetchImageList, deleteUserImage, handleAddBackgroundImage } = useBackgroundSettings(settings.bgimage?.path);
    const scan = useFileStore((state) => state.scan);
    const deleteNonTxtFiles = useFileStore((state) => state.deleteNonTxtFiles);
    const fetchDeletedFiles = useFileStore((state) => state.fetchDeletedFiles);
    const restoreDeletedFiles = useFileStore((state) => state.restoreDeletedFiles);
    const executeCompleteDeletion = useFileStore((state) => state.executeCompleteDeletion);
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
    const [isBgDeleteDialogOpen, setIsBgDeleteDialogOpen] = useState(false);
    const [selectedDeleteItems, setSelectedDeleteItems] = useState([]);
    const [selectedDeleteStoryKeys, setSelectedDeleteStoryKeys] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);

    const isSystem = settings.theme === "System Theme";
    const isDark = settings.theme === "Dark Theme";
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const currentTheme = isSystem ? systemTheme : (isDark ? "dark" : "light");
    const userImageCount = useMemo(
        () => wholeImageList.filter((image) => image.kind === "user").length,
        [wholeImageList]
    );


    useEffect(() => {
        fetchImageList().catch(console.error);
    }, [isBgDeleteDialogOpen, fetchImageList]);

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


    return (
        <>
            <SpiritListView maxWidth="100%" className={styles.settingsList}>
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
        </>
    );
}
