import React, { useState } from "react";
import { EllipsisVertical, Page, PageSearch, Plus, ArrowUpWideNarrow, ArrowDownWideNarrow } from '../../../assets/IconList';
import styles from "./tab_story.module.css";
import { useTabStore } from "../../../store/tabStore";
import { useFileStore } from "../../../store/fileStore";
import { useStoryStore } from "../../../store/storyStore";
import { useTxtStore } from "../../../store/txtStore";
import { useToastStore } from "../../../store/toastStore";
import { invoke } from "@tauri-apps/api/core";
import {
    TN_Dialog,
    TN_Button,
    TN_Menu,
    TN_ListView,
    TN_ListItem,
    TN_TextField,
    TN_Dropdown,
    TN_IconButton,
    TN_Slider,
} from "../../TNDesignSystem";
import { useTranslation } from "react-i18next";

export default function Tab_StoryContents({ story_name, workspace, isAddDialogOpen, setIsAddDialogOpen }) {
    const { t } = useTranslation();
    const { addTab, renameWorkTabs, removeWorkTabs } = useTabStore();
    const { getStoryInfo, deleteTxt, createTxt, updateTxtName } = useFileStore();
    const { updateStoryInfo } = useStoryStore();

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [newFileName, setNewFileName] = useState("");

    const [isFileRenameDialogOpen, setIsFileRenameDialogOpen] = useState(false);
    const [renameTargetFile, setRenameTargetFile] = useState("");
    const [editFileName, setEditFileName] = useState("");

    const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
    const [restoreTargetFile, setRestoreTargetFile] = useState("");
    const [backupHistory, setBackupHistory] = useState([]);
    const [restoreGenerationIndex, setRestoreGenerationIndex] = useState(0);
    const [restoreSliderValue, setRestoreSliderValue] = useState(0);

    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("title");
    const [isAscending, setIsAscending] = useState(true);
    const sortOptions = [
        { value: "title", label: t("story.files.sort.title") },
        { value: "order", label: t("story.files.sort.order") },
    ];
    const files = workspace.filesList;
    const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
    const visibleFiles = files
        .map((title, index) => ({ title, index }))
        .filter(({ title }) => title.toLocaleLowerCase().includes(normalizedSearchQuery))
        .sort((a, b) => {
            const comparison = sortBy === "order"
                ? a.index - b.index
                : a.title.localeCompare(b.title);
            return isAscending ? comparison : -comparison;
        });
    const normalizedNewFileName = newFileName.trim().toLocaleLowerCase();
    const newFileNameExists = normalizedNewFileName !== "" && files.some((fileName) => (
        fileName.trim().toLocaleLowerCase() === normalizedNewFileName
    ));

    const handleDelete = async () => {
        if (!deleteTarget) return;

        const title = deleteTarget;

        try {
            await deleteTxt({ story_name, title });
            removeWorkTabs(story_name, title);
            useTxtStore.getState().removeWorkspace(`${story_name}/${title}`);
            setIsDeleteDialogOpen(false);
            setDeleteTarget(null);
            const storyInfo = await getStoryInfo(story_name);
            updateStoryInfo(story_name, storyInfo);
        } catch (error) {
            console.error("Deletion failed", error);
        }
    };

    const handleCreateTxt = async (e) => {
        if (e) e.preventDefault();
        if (newFileName.trim() === "" || newFileNameExists) return;
        try {
            await createTxt({ story_name, title: newFileName });
            setIsAddDialogOpen(false);
            const addedFileName = newFileName;
            setNewFileName("");

            const storyInfo = await getStoryInfo(story_name);
            updateStoryInfo(story_name, storyInfo);

            addTab('work', addedFileName, { story_name: story_name, title: addedFileName });
        } catch (error) {
            console.error("Text creation failed", error);
        }
    };

    const handleUpdateTxtName = async (oldFileName, newFileName) => {
        const nextFileName = newFileName.trim();
        if (!nextFileName || oldFileName === nextFileName) {
            setIsFileRenameDialogOpen(false);
            setRenameTargetFile("");
            setEditFileName("");
            return;
        }

        try {
            await updateTxtName({ story_name, title: oldFileName }, nextFileName);

 
            useTxtStore.getState().renameWorkspaceKey(story_name, oldFileName, nextFileName);
            renameWorkTabs(story_name, oldFileName, nextFileName);


            const storyInfo = await getStoryInfo(story_name);
            updateStoryInfo(story_name, storyInfo);
            setIsFileRenameDialogOpen(false);
            setRenameTargetFile("");
            setEditFileName("");
        } catch (error) {
            console.error("Text name update failed", error);
        }
    }

    const handleOpenRestoreDialog = async (fileTitle) => {
        try {
            const history = await invoke("get_backup_history", {
                storyName: story_name,
                fileName: fileTitle
            });
            if (!history || history.length === 0) {
                useToastStore.getState().addToast(t("story.restore.noHistory"), "error");
                return;
            }
            setBackupHistory(history);
            const latestHistoryIndex = history.length - 1;
            setRestoreGenerationIndex(history[latestHistoryIndex]?.generationIndex ?? 0);
            setRestoreSliderValue(latestHistoryIndex);
            setRestoreTargetFile(fileTitle);
            setIsRestoreDialogOpen(true);
        } catch (error) {
            console.error("Failed to fetch backup history", error);
            useToastStore.getState().addToast(t("story.restore.historyFailed", { error: String(error) }), "error");
        }
    };

    const handleRestoreConfirm = async () => {
        if (!restoreTargetFile || backupHistory.length === 0) return;

        const selectedHistory = backupHistory[restoreSliderValue];
        if (!selectedHistory) return;

        try {
            await invoke("increment_backup", {
                storyName: story_name,
                fileName: restoreTargetFile,
                _content: "",
                content: ""
            });

            await invoke("save_document_content", {
                txtInfo: { story_name, title: restoreTargetFile },
                content: selectedHistory.content
            });

            const workspaceId = `${story_name}/${restoreTargetFile}`;
            if (useTxtStore.getState().workspaces[workspaceId]) {
                await useTxtStore.getState().loadContent(workspaceId, story_name, restoreTargetFile);
            }

            useToastStore.getState().addToast(t("story.restore.success", { name: restoreTargetFile }), "success");
            setIsRestoreDialogOpen(false);
            setRestoreTargetFile("");
            setBackupHistory([]);
            setRestoreGenerationIndex(0);
        } catch (error) {
            console.error("Failed to restore backup", error);
            useToastStore.getState().addToast(t("story.restore.failed"), "error");
        }
    };

    const backupGenerations = backupHistory.reduce((generations, item, historyIndex) => {
        const generationIndex = item.generationIndex ?? 0;
        let generation = generations.find((entry) => entry.generationIndex === generationIndex);
        if (!generation) {
            generation = {
                generationIndex,
                entries: []
            };
            generations.push(generation);
        }
        generation.entries.push({ historyIndex, item });
        return generations;
    }, []);

    const selectedGeneration = backupGenerations.find(
        (generation) => generation.generationIndex === restoreGenerationIndex
    ) ?? backupGenerations[backupGenerations.length - 1];
    const selectedGenerationEntries = selectedGeneration?.entries ?? [];
    const selectedGenerationPosition = Math.max(
        0,
        selectedGenerationEntries.findIndex((entry) => entry.historyIndex === restoreSliderValue)
    );
    const selectedHistory = backupHistory[restoreSliderValue];
    const generationOptions = backupGenerations.map((generation) => ({
        value: generation.generationIndex,
        label: t("story.restore.generationOption", { current: generation.generationIndex + 1, total: backupGenerations.length })
    }));

    const handleRestoreGenerationChange = (generationIndex) => {
        const nextGenerationIndex = Number(generationIndex);
        const nextGeneration = backupGenerations.find(
            (generation) => generation.generationIndex === nextGenerationIndex
        );
        setRestoreGenerationIndex(nextGenerationIndex);
        if (nextGeneration?.entries.length) {
            setRestoreSliderValue(nextGeneration.entries[nextGeneration.entries.length - 1].historyIndex);
        }
    };

    return (
        <>
            <div className={styles.mainContent}>
                <header className={styles.contentsHeader}>
                    <h3 className={styles.contentTitle}>{t("story.overview.contents")}</h3>
                    <TN_Button variant="proceed" onClick={() => setIsAddDialogOpen(true)} borderRadius="10px">
                        <Plus size={18} />{t("story.files.createTitle")}
                    </TN_Button>
                </header>
                <div className={styles.contentsControls}>
                    <div className={styles.contentsSearchField}>
                        <TN_TextField
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t("story.files.searchPlaceholder")}
                            aria-label={t("story.files.searchPlaceholder")}
                            icon={<PageSearch size={18} />}
                            borderRadius="10px"
                        />
                    </div>
                    <div className={styles.contentsSortControls}>
                        <TN_Dropdown
                            options={sortOptions}
                            value={sortBy}
                            onChange={setSortBy}
                            placeholder={t("library.sort.placeholder")}
                        />
                        <TN_IconButton
                            icon={isAscending ? <ArrowUpWideNarrow size={20} /> : <ArrowDownWideNarrow size={20} />}
                            onClick={() => setIsAscending((ascending) => !ascending)}
                            variant="secondary"
                            title={t(isAscending ? "library.sort.ascending" : "library.sort.descending")}
                            aria-label={t(isAscending ? "library.sort.ascending" : "library.sort.descending")}
                        />
                    </div>
                </div>
                <div className={styles.contentsResultCount} role="status">
                    {t("story.files.resultCount", { count: visibleFiles.length, total: files.length })}
                </div>
                <div className={styles.listScrollArea}>
                    <TN_ListView maxWidth="100%">
                        {visibleFiles.map(({ title: fileTitle }) => (
                            <TN_ListItem
                                key={fileTitle}
                                icon={<Page size={20} />}
                                title={fileTitle}
                                description={t("story.files.description")}
                                onClick={() => addTab('work', fileTitle, { story_name: story_name, title: fileTitle })}
                                control={
                                    <TN_Menu
                                        trigger={
                                            <button
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--tn-subtext)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '8px',
                                                    borderRadius: '50%',
                                                    transition: 'background-color 0.2s ease',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'var(--tn-hover-bg)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                }}
                                            >
                                                <EllipsisVertical size={18} />
                                            </button>
                                        }
                                        items={[
                                            {
                                                label: t("story.actions.restoreBackup"),
                                                onClick: () => handleOpenRestoreDialog(fileTitle)
                                            },
                                            {
                                                label: t("common.rename"),
                                                onClick: () => {
                                                    setRenameTargetFile(fileTitle);
                                                    setEditFileName(fileTitle);
                                                    setIsFileRenameDialogOpen(true);
                                                }
                                            },
                                            {
                                                label: t("common.delete"),
                                                isDanger: true,
                                                onClick: () => {
                                                    setDeleteTarget(fileTitle);
                                                    setIsDeleteDialogOpen(true);
                                                }
                                            }
                                        ]}
                                    />
                                }
                            />
                        ))}
                    </TN_ListView>

                    {visibleFiles.length === 0 && (
                        <div className={styles.contentsEmptyState}>
                            <PageSearch size={32} />
                            <p>{t(normalizedSearchQuery ? "story.files.noResults" : "story.files.empty")}</p>
                            {normalizedSearchQuery && (
                                <TN_Button variant="secondary" onClick={() => setSearchQuery("")}>
                                    {t("common.clearInput")}
                                </TN_Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <TN_Dialog
                isOpen={isDeleteDialogOpen}
                onClose={() => {
                    setIsDeleteDialogOpen(false);
                    setDeleteTarget(null);
                }}
                title={t("common.deleteConfirmation")}
            >
                <p style={{ marginTop: 0, color: 'var(--tn-text)' }}>
                    {t("story.files.deleteMessage", { name: deleteTarget })}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', gap: '12px' }}>
                    <TN_Button
                        variant="secondary"
                        onClick={() => {
                            setIsDeleteDialogOpen(false);
                            setDeleteTarget(null);
                        }}
                    >
                        {t("common.cancel")}
                    </TN_Button>
                    <TN_Button
                        variant="proceed"
                        onClick={handleDelete}
                    >
                        {t("common.delete")}
                    </TN_Button>
                </div>
            </TN_Dialog>

            <TN_Dialog
                isOpen={isAddDialogOpen}
                onClose={() => {
                    setIsAddDialogOpen(false);
                    setNewFileName("");
                }}
                title={t("story.files.createTitle")}
            >
                <form onSubmit={handleCreateTxt} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{
                            fontSize: '14px',
                            fontWeight: 'var(--font-weight-ui)',
                            color: 'var(--tn-text)',
                            opacity: 0.8
                        }}>
                            {t("story.files.nameLabel")}
                        </label>
                        <TN_TextField
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            placeholder={t("story.files.namePlaceholder")}
                            autoFocus
                        />
                        {newFileNameExists && (
                            <div style={{ color: "#d9534f", fontSize: "13px", fontWeight: 'var(--font-weight-ui)' }}>
                                {t("story.files.duplicateName")}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <TN_Button
                            onClick={(e) => {
                                e.preventDefault();
                                setIsAddDialogOpen(false);
                                setNewFileName("");
                            }}
                            variant="secondary"
                        >
                            {t("common.cancel")}
                        </TN_Button>
                        <TN_Button
                            onClick={handleCreateTxt}
                            variant="proceed"
                            disabled={newFileName.trim() === "" || newFileNameExists}
                        >
                            {t("common.create")}
                        </TN_Button>
                    </div>
                </form>
            </TN_Dialog>

            <TN_Dialog
                isOpen={isFileRenameDialogOpen}
                onClose={() => {
                    setIsFileRenameDialogOpen(false);
                    setRenameTargetFile("");
                    setEditFileName("");
                }}
                title={t("story.files.renameTitle")}
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleUpdateTxtName(renameTargetFile, editFileName);
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{
                            fontSize: '14px',
                            fontWeight: 'var(--font-weight-ui)',
                            color: 'var(--tn-text)',
                            opacity: 0.8
                        }}>
                            {t("story.files.renameLabel")}
                        </label>
                        <TN_TextField
                            value={editFileName}
                            onChange={(e) => setEditFileName(e.target.value)}
                            placeholder={t("story.files.renamePlaceholder")}
                            autoFocus
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <TN_Button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                setIsFileRenameDialogOpen(false);
                                setRenameTargetFile("");
                                setEditFileName("");
                            }}
                            variant="secondary"
                        >
                            {t("common.cancel")}
                        </TN_Button>
                        <TN_Button
                            type="submit"
                            variant="proceed"
                            disabled={editFileName.trim() === ""}
                        >
                            {t("common.change")}
                        </TN_Button>
                    </div>
                </form>
            </TN_Dialog>

            <TN_Dialog
                isOpen={isRestoreDialogOpen}
                onClose={() => {
                    setIsRestoreDialogOpen(false);
                    setRestoreTargetFile("");
                    setBackupHistory([]);
                    setRestoreGenerationIndex(0);
                }}
                title={t("story.restore.title", { name: restoreTargetFile })}
                maxWidth="600px"
            >
                {backupHistory.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '14px', opacity: 0.8, color: 'var(--tn-text)' }}>
                                {t("story.restore.generationLabel")}
                            </span>
                            <TN_Dropdown
                                options={generationOptions}
                                value={selectedGeneration?.generationIndex ?? restoreGenerationIndex}
                                onChange={handleRestoreGenerationChange}
                                placeholder={t("story.restore.generationPlaceholder")}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '14px', opacity: 0.8, color: 'var(--tn-text)' }}>
                                {t("story.restore.generation", { current: selectedGenerationPosition + 1, total: selectedGenerationEntries.length })}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: 'var(--font-weight-ui)', color: 'var(--tn-text)' }}>
                                {selectedHistory?.timestamp === 0
                                    ? t("story.restore.unknownDate")
                                    : new Date(selectedHistory.timestamp * 1000).toLocaleString()}
                            </span>
                        </div>
                        {selectedGenerationEntries.length > 1 && (
                            <div style={{ marginTop: '24px', marginBottom: '24px' }}>
                                <TN_Slider
                                    key={selectedGeneration?.generationIndex ?? restoreGenerationIndex}
                                    min={0}
                                    max={selectedGenerationEntries.length - 1}
                                    defaultValue={selectedGenerationPosition}
                                    onChange={(val) => {
                                        const nextEntry = selectedGenerationEntries[val];
                                        if (nextEntry) {
                                            setRestoreSliderValue(nextEntry.historyIndex);
                                        }
                                    }}
                                />
                            </div>
                        )}
                        <div style={{
                            padding: '12px',
                            background: 'var(--tn-hover-bg)',
                            borderRadius: '8px',
                            border: '1px solid var(--tn-border-light)',
                            minHeight: '200px',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            fontSize: '14px',
                            lineHeight: 1.6,
                            color: 'var(--tn-text)'
                        }}>
                            {selectedHistory?.content || <span style={{ opacity: 0.5 }}>{t("story.restore.noContent")}</span>}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                            <TN_Button
                                variant="secondary"
                                onClick={() => {
                                    setIsRestoreDialogOpen(false);
                                    setRestoreTargetFile("");
                                    setBackupHistory([]);
                                    setRestoreGenerationIndex(0);
                                }}
                            >
                                {t("common.cancel")}
                            </TN_Button>
                            <TN_Button
                                variant="proceed"
                                onClick={handleRestoreConfirm}
                            >
                                {t("story.restore.submit")}
                            </TN_Button>
                        </div>
                    </div>
                )}
            </TN_Dialog>
        </>
    );
}
