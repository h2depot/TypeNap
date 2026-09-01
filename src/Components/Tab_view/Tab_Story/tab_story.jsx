import React, { useState, useEffect, useCallback } from "react";
import { Trash2, EllipsisVertical, FileText, Plus, PencilLine } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./tab_story.module.css";
import { useTabStore } from "../../../store/tabStore";
import { useFileStore } from "../../../store/fileStore";
import { useStoryStore } from "../../../store/storyStore";
import { useTxtStore } from "../../../store/txtStore";
import { useToastStore } from "../../../store/toastStore";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useBgImageStore } from "../../../store/bgImageStore";
import {
    GhostDialog,
    GhostButton,
    GhostMenu,
    SpiritListView,
    SpiritListItem,
    GhostIconButton,
    GhostTextField,
    SpiritCard,
    GhostBookCard_Preview,
    GhostDropdown,
    GhostSlider,
    GhostTooltip
} from "../../GhostDesignSystem";
import { SOLID_PALETTE_COLORS } from "../../../constants/colors";
import { useTranslation } from "react-i18next";

const formatTimestampToDateTime = (timestamp) => {
    if (!timestamp) return "---";
    return new Date(timestamp * 1000).toLocaleString([], {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export default function Tab_Story({ story_name }) {
    const { t } = useTranslation();
    const { addTab, renameWorkTabs, removeWorkTabs, renameStoryTabs } = useTabStore();
    const { storyList, getStoryInfo, deleteTxt, createTxt, updateTxtName, renameStory, updateStorySynopsis } = useFileStore();
    const { workspaces, initWorkspace, updateStoryInfo, renameStoryWorkspace, markSynopsisSaved } = useStoryStore();
    const { fetchImageList, addUserImage, wholeImageList } = useBgImageStore();

    const workspace = workspaces[story_name];

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newFileName, setNewFileName] = useState("");

    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [editedTitle, setEditedTitle] = useState(story_name);

    const [isFileRenameDialogOpen, setIsFileRenameDialogOpen] = useState(false);
    const [renameTargetFile, setRenameTargetFile] = useState("");
    const [editFileName, setEditFileName] = useState("");

    const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
    const [restoreTargetFile, setRestoreTargetFile] = useState("");
    const [backupHistory, setBackupHistory] = useState([]);
    const [restoreGenerationIndex, setRestoreGenerationIndex] = useState(0);
    const [restoreSliderValue, setRestoreSliderValue] = useState(0);

    const [isCoverDialogOpen, setIsCoverDialogOpen] = useState(false);
    const [editedCoverColor, setEditedCoverColor] = useState("");

    const [synopsis, setSynopsis] = useState(workspace?.synopsis || "");

    useEffect(() => {
        setSynopsis(workspace?.synopsis || "");
    }, [workspace?.synopsis, story_name]);

    const saveSynopsis = useCallback(async () => {
        if (!workspace || synopsis === workspace.synopsis) return;

        try {
            const storyInfo = await updateStorySynopsis(story_name, synopsis);
            markSynopsisSaved(story_name, storyInfo);
        } catch (error) {
            console.error("Failed to save synopsis:", error);
        }
    }, [markSynopsisSaved, story_name, synopsis, updateStorySynopsis, workspace]);

    useEffect(() => {
        const handleSaveStorySynopsis = (event) => {
            if (event.detail?.storyName !== story_name) return;
            saveSynopsis();
        };

        window.addEventListener('save-story-synopsis', handleSaveStorySynopsis);

        return () => {
            window.removeEventListener('save-story-synopsis', handleSaveStorySynopsis);
        };
    }, [saveSynopsis, story_name]);

    useEffect(() => {
        setEditedTitle(story_name);

        const handleOpenAddDialog = () => setIsAddDialogOpen(true);
        window.addEventListener('open-add-episode-dialog', handleOpenAddDialog);

        return () => {
            window.removeEventListener('open-add-episode-dialog', handleOpenAddDialog);
        };
    }, [story_name]);

    const handleTitleClick = () => {
        setEditedTitle(story_name);
        setIsRenameDialogOpen(true);
    };

    const handleSaveTitle = async (e) => {
        if (e) e.preventDefault();

        const newStoryName = editedTitle.trim();
        if (!newStoryName || newStoryName === story_name) {
            setIsRenameDialogOpen(false);
            setEditedTitle(story_name);
            return;
        }

        try {
            await renameStory(story_name, newStoryName);
            renameStoryTabs(story_name, newStoryName);
            useTxtStore.getState().renameStoryInWorkspaces(story_name, newStoryName);
            renameStoryWorkspace(story_name, newStoryName);
            setEditedTitle(newStoryName);
            setIsRenameDialogOpen(false);
        } catch (error) {
            console.error("Story name update failed", error);
        }
    };

    const handleSaveCover = async (e) => {
        if (e) e.preventDefault();
        try {
            const storyInfo = await useFileStore.getState().updateStoryCover(story_name, editedCoverColor);
            updateStoryInfo(story_name, storyInfo);
            setIsCoverDialogOpen(false);
        } catch (err) {
            console.error("Cover update failed", err);
        }
    };

    useEffect(() => {
        fetchImageList();
    }, [fetchImageList]);

    const handleAddImageClick = async (e) => {
        if (e) e.preventDefault();
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
        }
    };

    useEffect(() => {
        if (!workspace) {
            initWorkspace(story_name, []);

            getStoryInfo(story_name).then((storyInfo) => {
                updateStoryInfo(story_name, storyInfo);
            }).catch((err) => {
                console.error(t("story.files.fetchFailed"), err);
            });
        }
    }, [story_name, workspace, initWorkspace, getStoryInfo, updateStoryInfo]);

    useEffect(() => {
        const storyInfo = storyList.find((story) => story.story_name === story_name);
        if (!storyInfo) return;

        if (!useStoryStore.getState().workspaces[story_name]) {
            initWorkspace(
                story_name,
                storyInfo.chapters ?? storyInfo.files ?? [],
                storyInfo.char_cnt ?? 0,
                storyInfo
            );
        }
        updateStoryInfo(story_name, storyInfo);
    }, [storyList, story_name, initWorkspace, updateStoryInfo]);

    if (!workspace) return <div style={{ padding: 20 }}>{t("common.loading")}</div>;

    const files = workspace.filesList;
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

    const titleColor = "var(--ghost-text)";

    return (
        <div style={{ display: 'flex', flexDirection: 'row', height: '100%', width: '100%', padding: '10px', gap: '20px', boxSizing: 'border-box', overflow: 'hidden' }}>

            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>
                <SpiritCard style={{ marginLeft: 0, height: '100%', width: '330px', maxWidth: '330px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
                    <GhostBookCard_Preview 
                        title={story_name} 
                        coverColor={workspace?.cover} 
                        onClick={() => {
                            setEditedCoverColor(workspace?.cover || "#232b69");
                            setIsCoverDialogOpen(true);
                        }} 
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', marginTop: '12px', width: '100%', flexGrow: 1, minHeight: 0 }}>
                        <button
                            onClick={handleTitleClick}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                background: 'transparent',
                                border: 'none',
                                color: 'inherit',
                                cursor: 'pointer',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                transition: 'background-color 0.2s ease',
                                flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--ghost-hover-bg)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <span style={{ fontSize: '22px', fontWeight: 'bold' }}>
                                {story_name}
                            </span>
                            <PencilLine size={18} style={{ opacity: 0.5 }} />
                        </button>
                        <span style={{ fontSize: '13px', opacity: 0.8, flexShrink: 0 }}>{t("story.summary.totalCharacters", { count: workspace.charCnt })}</span>
                        <span style={{ fontSize: '13px', opacity: 0.8, flexShrink: 0 }}>{t("story.summary.lastUpdated", { date: formatTimestampToDateTime(workspace.lastUpdate ?? workspace.last_update) })}</span>
                        <span style={{ fontSize: '16px', opacity: 0.8, fontWeight: 'bold', alignSelf: 'flex-start', textAlign: 'left', marginTop: '20px', flexShrink: 0 }}>{t("story.summary.synopsis")}</span>
                        <div className={styles.memoWrapper} style={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                            <div className={styles.memoContainer} style={{ flexGrow: 1, height: '100%' }}>
                                <textarea
                                    className={styles.memoTextarea}
                                    placeholder={t("story.summary.synopsisPlaceholder")}
                                    value={synopsis}
                                    onChange={(e) => setSynopsis(e.target.value)}
                                    onBlur={saveSynopsis}
                                    spellCheck={false}
                                />
                            </div>
                        </div>
                    </div>
                </SpiritCard>
            </div>

            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: 800, color: titleColor, flexShrink: 0 }}>Recent Opened</h3>
                <div style={{ flexGrow: 1, overflowY: 'auto', padding: '6px 12px 6px 6px', boxSizing: 'border-box' }}>
                    <SpiritListView maxWidth="100%">
                        {files.map((fileTitle) => (
                            <SpiritListItem
                                key={fileTitle}
                                icon={<FileText size={20} />}
                                title={fileTitle}
                                description={t("story.files.description")}
                                onClick={() => addTab('work', fileTitle, { story_name: story_name, title: fileTitle })}
                                control={
                                    <GhostMenu
                                        trigger={
                                            <button
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--ghost-subtext)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '8px',
                                                    borderRadius: '50%',
                                                    transition: 'background-color 0.2s ease',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'var(--ghost-hover-bg)';
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
                    </SpiritListView>

                    {files.length === 0 && (
                        <p style={{ opacity: 0.5, textAlign: 'center', marginTop: '40px', color: titleColor }}>{t("story.files.empty")}</p>
                    )}
                </div>
            </div>

            <GhostDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => {
                    setIsDeleteDialogOpen(false);
                    setDeleteTarget(null);
                }}
                title={t("common.deleteConfirmation")}
            >
                <p style={{ marginTop: 0, color: 'var(--ghost-text)' }}>
                    {t("story.files.deleteMessage", { name: deleteTarget })}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', gap: '12px' }}>
                    <GhostButton
                        variant="secondary"
                        onClick={() => {
                            setIsDeleteDialogOpen(false);
                            setDeleteTarget(null);
                        }}
                    >
                        {t("common.cancel")}
                    </GhostButton>
                    <GhostButton
                        variant="primary"
                        onClick={handleDelete}
                    >
                        {t("common.delete")}
                    </GhostButton>
                </div>
            </GhostDialog>

            <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 100 }}>
                <GhostIconButton
                    icon={<Plus />}
                    onClick={() => setIsAddDialogOpen(true)}
                    variant="primary"
                    size="extra_large"
                />
            </div>

            <GhostDialog
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
                            fontWeight: 600,
                            color: 'var(--ghost-text)',
                            opacity: 0.8
                        }}>
                            {t("story.files.nameLabel")}
                        </label>
                        <GhostTextField
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            placeholder={t("story.files.namePlaceholder")}
                            autoFocus
                        />
                        {newFileNameExists && (
                            <div style={{ color: "#d9534f", fontSize: "13px", fontWeight: 600 }}>
                                {t("story.files.duplicateName")}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <GhostButton
                            onClick={(e) => {
                                e.preventDefault();
                                setIsAddDialogOpen(false);
                                setNewFileName("");
                            }}
                            variant="secondary"
                        >
                            {t("common.cancel")}
                        </GhostButton>
                        <GhostButton
                            onClick={handleCreateTxt}
                            variant="primary"
                            disabled={newFileName.trim() === "" || newFileNameExists}
                        >
                            {t("common.create")}
                        </GhostButton>
                    </div>
                </form>
            </GhostDialog>

            <GhostDialog
                isOpen={isRenameDialogOpen}
                onClose={() => {
                    setIsRenameDialogOpen(false);
                    setEditedTitle(story_name);
                }}
                title={t("library.rename.title")}
            >
                <form
                    onSubmit={handleSaveTitle}
                    style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--ghost-text)',
                            opacity: 0.8
                        }}>
                            {t("library.rename.label")}
                        </label>
                        <GhostTextField
                            value={editedTitle}
                            onChange={(e) => setEditedTitle(e.target.value)}
                            placeholder={t("library.rename.placeholder")}
                            autoFocus
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <GhostButton
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                setIsRenameDialogOpen(false);
                                setEditedTitle(story_name);
                            }}
                            variant="secondary"
                        >
                            {t("common.cancel")}
                        </GhostButton>
                        <GhostButton
                            type="submit"
                            variant="primary"
                            disabled={editedTitle.trim() === ""}
                        >
                            {t("common.change")}
                        </GhostButton>
                    </div>
                </form>
            </GhostDialog>

            <GhostDialog
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
                            fontWeight: 600,
                            color: 'var(--ghost-text)',
                            opacity: 0.8
                        }}>
                            {t("story.files.renameLabel")}
                        </label>
                        <GhostTextField
                            value={editFileName}
                            onChange={(e) => setEditFileName(e.target.value)}
                            placeholder={t("story.files.renamePlaceholder")}
                            autoFocus
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <GhostButton
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
                        </GhostButton>
                        <GhostButton
                            type="submit"
                            variant="primary"
                            disabled={editFileName.trim() === ""}
                        >
                            {t("common.change")}
                        </GhostButton>
                    </div>
                </form>
            </GhostDialog>

            <GhostDialog
                isOpen={isCoverDialogOpen}
                onClose={() => setIsCoverDialogOpen(false)}
                title={t("story.cover.changeTitle")}
            >
                <form onSubmit={handleSaveCover} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--ghost-text)',
                            opacity: 0.8
                        }}>
                            {t("story.cover.color")}
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {SOLID_PALETTE_COLORS.map((color) => {
                                const isSelected = editedCoverColor === color;
                                return (
                                    <div
                                        key={color}
                                        onClick={() => setEditedCoverColor(color)}
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
                                            border: "1px solid var(--ghost-border-light)",
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
                                                        background: "var(--ghost-gradient, linear-gradient(135deg, #a777e3, #6e8efb))",
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
                            fontWeight: 600,
                            color: 'var(--ghost-text)',
                            opacity: 0.8
                        }}>
                            {t("story.cover.chooseImage")}
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {wholeImageList.map((image) => {
                                const isSelected = editedCoverColor === image.path;
                                return (
                                    <div
                                        key={image.path}
                                        onClick={() => setEditedCoverColor(image.path)}
                                        style={{
                                            position: "relative",
                                            width: "80px",
                                            height: "70px",
                                            display: "flex",
                                            flexDirection: "column",
                                            cursor: "pointer",
                                            borderRadius: "8px",
                                            overflow: "hidden",
                                            background: "var(--ghost-hover-bg)"
                                        }}>
                                        <AnimatePresence>
                                            {isSelected && (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.25, ease: "easeOut" }}
                                                    style={{
                                                        position: 'absolute',
                                                        inset: 0,
                                                        borderRadius: '8px',
                                                        padding: '2px',
                                                        background: 'var(--ghost-gradient, linear-gradient(135deg, #a777e3, #6e8efb))',
                                                        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                                                        WebkitMaskComposite: 'xor',
                                                        maskComposite: 'exclude',
                                                        pointerEvents: 'none',
                                                        zIndex: 10
                                                    }}
                                                />
                                            )}
                                        </AnimatePresence>
                                        {image.path && (
                                            <>
                                                <img
                                                    src={convertFileSrc(image.path)}
                                                    alt={image.name}
                                                    style={{ width: "100%", height: "100%", objectFit: "cover", minHeight: 0 }}
                                                />
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                            <GhostTooltip content={t("image.addNew")} position="bottom">
                                <GhostIconButton
                                    variant="primary"
                                    size="medium"
                                    borderRadius="8px"
                                    icon={<Plus size={18} />}
                                    onClick={handleAddImageClick}
                                    type="button"
                                />
                            </GhostTooltip>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <GhostButton
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                setIsCoverDialogOpen(false);
                            }}
                            variant="secondary"
                        >
                            {t("common.cancel")}
                        </GhostButton>
                        <GhostButton
                            type="submit"
                            variant="primary"
                        >
                            {t("common.change")}
                        </GhostButton>
                    </div>
                </form>
            </GhostDialog>

            <GhostDialog
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
                            <span style={{ fontSize: '14px', opacity: 0.8, color: 'var(--ghost-text)' }}>
                                {t("story.restore.generationLabel")}
                            </span>
                            <GhostDropdown
                                options={generationOptions}
                                value={selectedGeneration?.generationIndex ?? restoreGenerationIndex}
                                onChange={handleRestoreGenerationChange}
                                placeholder={t("story.restore.generationPlaceholder")}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '14px', opacity: 0.8, color: 'var(--ghost-text)' }}>
                                {t("story.restore.generation", { current: selectedGenerationPosition + 1, total: selectedGenerationEntries.length })}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--ghost-text)' }}>
                                {selectedHistory?.timestamp === 0
                                    ? t("story.restore.unknownDate")
                                    : new Date(selectedHistory.timestamp * 1000).toLocaleString()}
                            </span>
                        </div>
                        {selectedGenerationEntries.length > 1 && (
                            <div style={{ marginTop: '24px', marginBottom: '24px' }}>
                                <GhostSlider
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
                            background: 'var(--ghost-hover-bg)',
                            borderRadius: '8px',
                            border: '1px solid var(--ghost-border-light)',
                            minHeight: '200px',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            fontSize: '14px',
                            lineHeight: 1.6,
                            color: 'var(--ghost-text)'
                        }}>
                            {selectedHistory?.content || <span style={{ opacity: 0.5 }}>{t("story.restore.noContent")}</span>}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                            <GhostButton
                                variant="secondary"
                                onClick={() => {
                                    setIsRestoreDialogOpen(false);
                                    setRestoreTargetFile("");
                                    setBackupHistory([]);
                                    setRestoreGenerationIndex(0);
                                }}
                            >
                                {t("common.cancel")}
                            </GhostButton>
                            <GhostButton
                                variant="primary"
                                onClick={handleRestoreConfirm}
                            >
                                {t("story.restore.submit")}
                            </GhostButton>
                        </div>
                    </div>
                )}
            </GhostDialog>
        </div>
    );
}
