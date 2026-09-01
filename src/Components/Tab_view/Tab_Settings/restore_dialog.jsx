import React from "react";
import { GhostButton, GhostCheckBox, GhostDialog } from "../../GhostDesignSystem";
import { useTranslation } from "react-i18next";

export default function RestoreDialog({
    isRestoreDialogOpen,
    setIsRestoreDialogOpen,
    isRestoring,
    setIsRestoring,
    isRestoreLoading,
    deletedFiles,
    getStoryRestoreItems,
    selectedRestoreStoryKeys,
    restoreStoryKey,
    toggleRestoreItems,
    restoreItemFromEntry,
    restoreItemKey,
    isRestoreItemSelected,
    toggleRestoreItem,
    selectedRestoreItems,
    restoreDeletedFiles,
    fetchDeletedFiles,
    setDeletedFiles,
    setSelectedRestoreItems,
    setSelectedRestoreStoryKeys,
    addToast,
    currentTheme,
}) {
    const { t, i18n } = useTranslation();
    return (
        <GhostDialog
            isOpen={isRestoreDialogOpen}
            onClose={() => {
                if (!isRestoring) {
                    setIsRestoreDialogOpen(false);
                }
            }}
            title={t("settings.deletedFiles.restoreTitle")}
        >
            <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                maxHeight: "60vh",
                overflowY: "auto",
                padding: "16px",
                color: "var(--ghost-text)",
            }}>
                {isRestoreLoading ? (
                    <div>{t("settings.deletedFiles.loading")}</div>
                ) : deletedFiles.length === 0 ? (
                    <div>{t("settings.deletedFiles.noneToRestore")}</div>
                ) : (
                    <div style={{ fontFamily: "monospace", fontSize: "14px", lineHeight: 1.5 }}>
                        <div style={{ fontWeight: "bold", marginBottom: "8px" }}>Project</div>
                        {deletedFiles.map((story, storyIndex) => {
                            const isLastStory = storyIndex === deletedFiles.length - 1;
                            const storyPrefix = isLastStory ? "└─ " : "├─ ";
                            const childPrefix = isLastStory ? "   " : "│  ";
                            const txtEntries = story.entries.filter((entry) => entry.backupKind !== "story");
                            const storyRestoreItems = getStoryRestoreItems(story);

                            return (
                                <div key={story.directoryName}>
                                    <div style={{ display: "flex", alignItems: "center", marginTop: "4px" }}>
                                        <span style={{ whiteSpace: "pre", color: currentTheme === "light" ? "#a0aabf" : "#6b7280" }}>
                                            {storyPrefix}
                                        </span>
                                        <GhostCheckBox
                                            checked={selectedRestoreStoryKeys.includes(restoreStoryKey(story))}
                                            onChange={() => toggleRestoreItems(story, storyRestoreItems)}
                                            disabled={isRestoring || storyRestoreItems.length === 0}
                                        />
                                        <span style={{ fontWeight: 600, marginLeft: "8px", wordBreak: "break-word" }}>
                                            {story.storyName}
                                        </span>
                                        <span style={{ fontSize: "12px", opacity: 0.7, marginLeft: "8px" }}>
                                            ({new Date(story.updatedAt * 1000).toLocaleString(i18n.language)})
                                        </span>
                                    </div>

                                    {txtEntries.map((entry, entryIndex) => {
                                        const item = restoreItemFromEntry(story, entry);
                                        const isLastEntry = entryIndex === txtEntries.length - 1;
                                        const entryPrefix = isLastEntry ? "└─ " : "├─ ";

                                        return (
                                            <div key={restoreItemKey(item)} style={{
                                                display: "flex",
                                                alignItems: "center",
                                                marginTop: "4px",
                                            }}>
                                                <span style={{ whiteSpace: "pre", color: currentTheme === "light" ? "#a0aabf" : "#6b7280" }}>
                                                    {childPrefix}{entryPrefix}
                                                </span>
                                                <GhostCheckBox
                                                    checked={isRestoreItemSelected(item)}
                                                    onChange={() => toggleRestoreItem(item)}
                                                    disabled={isRestoring}
                                                />
                                                <span style={{ marginLeft: "8px", wordBreak: "break-word" }}>
                                                    {entry.fileName}.txt
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                )}

                {deletedFiles.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
                        <GhostButton
                            variant="secondary"
                            borderRadius="6px"
                            disabled={isRestoring}
                            onClick={() => setIsRestoreDialogOpen(false)}
                        >
                            {t("common.cancel")}
                        </GhostButton>
                        <GhostButton
                            variant="primary"
                            borderRadius="6px"
                            disabled={selectedRestoreItems.length === 0 || isRestoring}
                            onClick={async () => {
                                setIsRestoring(true);
                                try {
                                    const success = await restoreDeletedFiles(selectedRestoreItems);
                                    const nextDeletedFiles = await fetchDeletedFiles();
                                    setDeletedFiles(nextDeletedFiles);
                                    setSelectedRestoreItems([]);
                                    setSelectedRestoreStoryKeys([]);
                                    if (success) {
                                        addToast(t("settings.deletedFiles.restored"), "success");
                                        setIsRestoreDialogOpen(false);
                                    } else {
                                        addToast(t("settings.deletedFiles.restorePartial"), "error");
                                    }
                                } catch (error) {
                                    console.error(error);
                                } finally {
                                    setIsRestoring(false);
                                }
                            }}
                        >
                            {isRestoring ? t("common.restoring") : t("story.restore.submit")}
                        </GhostButton>
                    </div>
                )}
            </div>
        </GhostDialog>
    );
}
