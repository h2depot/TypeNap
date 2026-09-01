import React from "react";
import { GhostButton, GhostCheckBox, GhostDialog } from "../../GhostDesignSystem";
import { useTranslation } from "react-i18next";

export default function DataDeleteDialog({
    isDataDeleteDialogOpen,
    setIsDataDeleteDialogOpen,
    isDeleting,
    setIsDeleting,
    isRestoreLoading,
    deletedFiles,
    getStoryRestoreItems,
    selectedDeleteStoryKeys,
    restoreStoryKey,
    toggleDeleteItems,
    restoreItemFromEntry,
    restoreItemKey,
    isDeleteItemSelected,
    toggleDeleteItem,
    selectedDeleteItems,
    executeCompleteDeletion,
    fetchDeletedFiles,
    setDeletedFiles,
    setSelectedDeleteItems,
    setSelectedDeleteStoryKeys,
    addToast,
    currentTheme,
}) {
    const { t, i18n } = useTranslation();
    return (
        <GhostDialog
            isOpen={isDataDeleteDialogOpen}
            onClose={() => {
                if (!isDeleting) {
                    setIsDataDeleteDialogOpen(false);
                }
            }}
            title={t("settings.deletedFiles.deleteTitle")}
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
                <p style={{ margin: 0, fontWeight: 500, lineHeight: 1.5, color: "#ef4444" }}>
                    {t("settings.deletedFiles.deleteWarning")}
                </p>

                {isRestoreLoading ? (
                    <div>{t("settings.deletedFiles.loading")}</div>
                ) : deletedFiles.length === 0 ? (
                    <div>{t("settings.deletedFiles.noneToDelete")}</div>
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
                                            checked={selectedDeleteStoryKeys.includes(restoreStoryKey(story))}
                                            onChange={() => toggleDeleteItems(story, storyRestoreItems)}
                                            disabled={isDeleting || storyRestoreItems.length === 0}
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
                                                    checked={isDeleteItemSelected(item)}
                                                    onChange={() => toggleDeleteItem(item)}
                                                    disabled={isDeleting}
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
                            disabled={isDeleting}
                            onClick={() => setIsDataDeleteDialogOpen(false)}
                        >
                            {t("common.cancel")}
                        </GhostButton>
                        <GhostButton
                            variant="danger"
                            borderRadius="6px"
                            disabled={selectedDeleteItems.length === 0 || isDeleting}
                            onClick={async () => {
                                setIsDeleting(true);
                                try {
                                    const success = await executeCompleteDeletion(selectedDeleteItems);
                                    const nextDeletedFiles = await fetchDeletedFiles();
                                    setDeletedFiles(nextDeletedFiles);
                                    setSelectedDeleteItems([]);
                                    setSelectedDeleteStoryKeys([]);
                                    if (success) {
                                        addToast(t("settings.deletedFiles.deleted"), "success");
                                        setIsDataDeleteDialogOpen(false);
                                    } else {
                                        addToast(t("settings.deletedFiles.deletePartial"), "error");
                                    }
                                } catch (error) {
                                    console.error(error);
                                } finally {
                                    setIsDeleting(false);
                                }
                            }}
                        >
                            {isDeleting ? t("common.deleting") : t("common.delete")}
                        </GhostButton>
                    </div>
                )}
            </div>
        </GhostDialog>
    );
}
