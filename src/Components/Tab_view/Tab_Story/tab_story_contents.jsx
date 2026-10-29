import { contentId, contentsInfo } from '../../../store/contentsInfo.js';
import React, { useId, useState } from "react";
import { EllipsisVertical, Page, User, Map, Entity, PageSearch, ArrowUpWideNarrow, ArrowDownWideNarrow } from '../../../assets/IconList';
import styles from "./tab_story.module.css";
import { useTabStore } from "../../../store/tabStore";
import { useFileStore } from "../../../store/fileStore";
import { useStoryStore } from "../../../store/storyStore";
import { useTxtStore } from "../../../store/txtStore";
import { duplicateContent } from '../../../store/duplication.js';
import { useToastStore } from "../../../store/toastStore";
import { useStatsStore } from "../../../store/saving/stats";
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
import ContentTypeSelector from './ContentTypeSelector';
import ContentTypeFilter from '../../ContentTypeFilter';
import EmptyState from '../../EmptyState';
import BackupPreview from '../../JSONBox/BackupPreview';
import TemplateStackPicker from '../../Templates/TemplateStackPicker';

export default function Tab_StoryContents({ story_name, workspace, isAddDialogOpen, setIsAddDialogOpen }) {
    const { t } = useTranslation();
    const { addTab, renameWorkTabs, removeWorkTabs } = useTabStore();
    const { getStoryInfo, deleteTxt, createTxt } = useFileStore();
    const { updateStoryInfo } = useStoryStore();
    const { stats, isReady: statsReady, updateInitialTemplateStack } = useStatsStore();

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [newFileName, setNewFileName] = useState("");
    const [newContentType, setNewContentType] = useState('txt');
    const templateIds = stats.initial_template_stacks?.[newContentType] ?? [];
    const setTemplateIds = ids => {
        void updateInitialTemplateStack(newContentType, ids).catch(error => {
            console.error('Failed to save initial template stack', error);
            useToastStore.getState().addToast(t('notice.statsSaveFailed'), 'error');
        });
    };
    const [creatingContent, setCreatingContent] = useState(false);
    const newContentTypeLabel = { txt: 'Text', character: 'Character', world: 'World', entity: 'Entity' }[newContentType];

    const [isFileRenameDialogOpen, setIsFileRenameDialogOpen] = useState(false);
    const [renameTargetFile, setRenameTargetFile] = useState("");
    const [editFileName, setEditFileName] = useState("");
    const renameErrorId = useId();

    const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
    const [restoreTargetFile, setRestoreTargetFile] = useState("");
    const [backupHistory, setBackupHistory] = useState([]);
    const [restoreGenerationIndex, setRestoreGenerationIndex] = useState(0);
    const [restoreSliderValue, setRestoreSliderValue] = useState(0);

    const [searchQuery, setSearchQuery] = useState("");
    const [contentTypeFilter, setContentTypeFilter] = useState('all');
    const [sortBy, setSortBy] = useState("title");
    const [isAscending, setIsAscending] = useState(true);
    const sortOptions = [
        { value: "title", label: t("story.files.sort.title") },
        { value: "order", label: t("story.files.sort.order") },
    ];
    const files = (workspace.contentsList ?? []).filter((info) => ["txt", "character", "world", "entity"].includes(info.content_type));
    const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
    const hasActiveFilters = normalizedSearchQuery !== '' || contentTypeFilter !== 'all';
    const visibleFiles = files
        .map((info, index) => ({ ...info, title: info.name, index }))
        .filter(info => contentTypeFilter === 'all' || info.content_type === contentTypeFilter)
        .filter(({ title }) => title.toLocaleLowerCase().includes(normalizedSearchQuery))
        .sort((a, b) => {
            const comparison = sortBy === "order"
                ? a.index - b.index
                : a.title.localeCompare(b.title);
            return isAscending ? comparison : -comparison;
        });
    const normalizedNewFileName = newFileName.trim().toLocaleLowerCase();
    const newFileNameExists = normalizedNewFileName !== "" && files.some((info) => (
        info.name.trim().toLocaleLowerCase() === normalizedNewFileName
    ));
    const normalizedRename = editFileName.trim().toLowerCase();
    const renameNameExists = normalizedRename !== '' && files.some(info => (
        contentId(info) !== contentId(renameTargetFile) && info.name.trim().toLowerCase() === normalizedRename
    ));

    const handleDelete = async () => {
        if (!deleteTarget) return;

        const info = contentsInfo(deleteTarget);

        try {
            await deleteTxt(info);
            removeWorkTabs(info);
            useTxtStore.getState().removeWorkspace(contentId(info));
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
        if (creatingContent || !['txt', 'character', 'world', 'entity'].includes(newContentType) || newFileName.trim() === "" || newFileNameExists) return;
        setCreatingContent(true);
        try {
            const created = newContentType !== 'txt'
                ? await invoke("create_document_json", { input: { story_name, name: newFileName.trim(), content_type: newContentType }, templateIds })
                : await createTxt({ story_name, name: newFileName, content_type: "txt" });
            setIsAddDialogOpen(false);
            setNewFileName("");

            const storyInfo = await getStoryInfo(story_name);
            updateStoryInfo(story_name, storyInfo);

            addTab('work', created.name, { ...created, title: created.name });
        } catch (error) {
            console.error("Content creation failed", error);
            useToastStore.getState().addToast(String(error), "error");
        } finally {
            setCreatingContent(false);
        }
    };

    const handleUpdateTxtName = async (info, newFileName) => {
        if (renameNameExists) return;
        const oldFileName = info.name;
        const nextFileName = newFileName.trim();
        if (!nextFileName || oldFileName === nextFileName) {
            setIsFileRenameDialogOpen(false);
            setRenameTargetFile("");
            setEditFileName("");
            return;
        }

        try {
            const renamed = await useTxtStore.getState().renameContent(info, nextFileName);
            renameWorkTabs(renamed);


            const storyInfo = await getStoryInfo(story_name);
            updateStoryInfo(story_name, storyInfo);
            setIsFileRenameDialogOpen(false);
            setRenameTargetFile("");
            setEditFileName("");
        } catch (error) {
            console.error("Text name update failed", error);
        }
    }

    const handleOpenRestoreDialog = async (value) => {
        try {
            const info = contentsInfo(value);
            const history = await invoke("get_backup_history", {
                contentsInfo: info
            });
            if (!history || history.length === 0) {
                useToastStore.getState().addToast(t("story.restore.noHistory"), "error");
                return;
            }
            setBackupHistory(history);
            const latestHistoryIndex = history.length - 1;
            setRestoreGenerationIndex(history[latestHistoryIndex]?.generationIndex ?? 0);
            setRestoreSliderValue(latestHistoryIndex);
            setRestoreTargetFile(info);
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
                contentsInfo: restoreTargetFile,
            });

            await invoke(restoreTargetFile.content_type === "txt" ? "save_document_content" : "save_json_content", {
                contentsInfo: restoreTargetFile,
                content: restoreTargetFile.content_type === "txt" ? selectedHistory.content : JSON.parse(selectedHistory.content)
            });

            const workspaceId = contentId(restoreTargetFile);
            if (useTxtStore.getState().workspaces[workspaceId]) {
                await useTxtStore.getState().loadContent(restoreTargetFile);
            }

            useToastStore.getState().addToast(t("story.restore.success", { name: restoreTargetFile.name }), "success");
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
                    <ContentTypeFilter value={contentTypeFilter} onChange={setContentTypeFilter} />
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
                            aria-label={t(isAscending ? "library.sort.ascending" : "library.sort.descending")}
                        />
                    </div>
                </div>
                {hasActiveFilters && <div className={styles.contentsResultRow}>
                    <div className={styles.contentsResultCount} role="status">
                        {t("story.files.resultCount", { count: visibleFiles.length, total: files.length })}
                    </div>
                </div>}
                <div className={styles.listScrollArea}>
                    {visibleFiles.length > 0 && <TN_ListView maxWidth="100%">
                        {visibleFiles.map((info) => (
                            <TN_ListItem
                                key={info.access_id}
                                icon={React.createElement({ txt: Page, character: User, world: Map, entity: Entity }[info.content_type], { size: 20 })}
                                title={info.name}
                                description={{ txt: "Text", character: "Character", world: "World", entity: "Entity" }[info.content_type]}
                                onClick={() => addTab('work', info.name, { story_name: info.story_name, name: info.name, access_id: info.access_id, content_type: info.content_type, title: info.name })}
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
                                                onClick: () => handleOpenRestoreDialog(info)
                                            },
                                            {
                                                label: t("common.rename"),
                                                onClick: () => {
                                                    setRenameTargetFile(info);
                                                    setEditFileName(info.name);
                                                    setIsFileRenameDialogOpen(true);
                                                }
                                            },
                                            {
                                                label: t("common.duplicate"),
                                                onClick: () => duplicateContent(info).catch(error => {
                                                    console.error('Content duplication failed', error);
                                                })
                                            },
                                            {
                                                label: t("common.delete"),
                                                isDanger: true,
                                                onClick: () => {
                                                    setDeleteTarget(info);
                                                    setIsDeleteDialogOpen(true);
                                                }
                                            }
                                        ]}
                                    />
                                }
                            />
                        ))}
                    </TN_ListView>}

                    {visibleFiles.length === 0 && <EmptyState
                        message={t(hasActiveFilters ? 'story.files.noResults' : 'story.files.empty')}
                        actionLabel={t('story.files.clearFilters')}
                        onAction={hasActiveFilters ? () => { setSearchQuery(''); setContentTypeFilter('all'); } : undefined}
                    />}
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
                    {t("story.files.deleteMessage", { name: deleteTarget?.name })}
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
                        variant="danger"
                        onClick={handleDelete}
                    >
                        {t("common.delete")}
                    </TN_Button>
                </div>
            </TN_Dialog>

            <TN_Dialog
                isOpen={isAddDialogOpen}
                onClose={() => {
                    if (creatingContent) return;
                    setIsAddDialogOpen(false);
                    setNewFileName("");
                }}
                title={t("story.files.createTitle")}
                maxWidth="680px"
                bodyStyle={{ padding: '24px clamp(20px, 4vw, 32px) 32px' }}
                footer={<div className={styles.createDialogActions}>
                    <TN_Button variant="secondary" disabled={creatingContent} onClick={() => {
                        setIsAddDialogOpen(false);
                        setNewFileName("");
                    }}>{t("common.cancel")}</TN_Button>
                    <TN_Button type="submit" form="new-content-form" variant="proceed"
                        disabled={creatingContent || !['txt', 'character', 'world', 'entity'].includes(newContentType) || newFileName.trim() === "" || newFileNameExists}>
                        {t(creatingContent ? "common.loading" : "common.create")}
                    </TN_Button>
                </div>}
            >
                <form id="new-content-form" onSubmit={handleCreateTxt} className={styles.createDialogForm}>
                    <ContentTypeSelector value={newContentType} onChange={value => { if (!creatingContent) setNewContentType(value); }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label htmlFor="new-content-name" style={{
                            fontSize: '14px',
                            fontWeight: 'var(--font-weight-ui)',
                            color: 'var(--tn-text)',
                            opacity: 0.8
                        }}>
                            {t('story.contentTypes.nameLabel', { type: newContentTypeLabel })}
                        </label>
                        <TN_TextField
                            id="new-content-name"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            placeholder={t('story.contentTypes.namePlaceholder', { type: newContentTypeLabel })}
                            autoFocus
                        />
                        {newFileNameExists && (
                            <div style={{ color: "#d9534f", fontSize: "13px", fontWeight: 'var(--font-weight-ui)' }}>
                                {t("story.files.duplicateName")}
                            </div>
                        )}
                    </div>

                    {isAddDialogOpen && newContentType !== 'txt' && <TemplateStackPicker contentType={newContentType} selected={templateIds} onChange={setTemplateIds} disabled={creatingContent || !statsReady} />}
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
                            aria-invalid={renameNameExists}
                            aria-describedby={renameNameExists ? renameErrorId : undefined}
                            autoFocus
                        />
                        {renameNameExists && <div id={renameErrorId} role="alert" style={{ color: '#d9534f', fontSize: '13px' }}>
                            {t('story.files.duplicateName')}
                        </div>}
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
                            disabled={editFileName.trim() === "" || renameNameExists}
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
                title={t("story.restore.title", { name: restoreTargetFile.name })}
                maxWidth="600px"
                bodyStyle={{
                    height: 'min(680px, calc(100dvh - 180px))',
                    maxHeight: 'none',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                }}
            >
                {backupHistory.length > 0 && (
                    <div className={styles.restoreLayout}>
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
                            flex: '1 1 0',
                            minHeight: 0,
                            overflowY: 'auto',
                            whiteSpace: restoreTargetFile.content_type === 'txt' ? 'pre-wrap' : 'normal',
                            overflowWrap: 'anywhere',
                            fontSize: '14px',
                            lineHeight: 1.6,
                            color: 'var(--tn-text)'
                        }}>
                            {selectedHistory?.content
                                ? restoreTargetFile.content_type === 'txt'
                                    ? selectedHistory.content
                                    : <BackupPreview content={selectedHistory.content} title={restoreTargetFile.name} />
                                : <span style={{ opacity: 0.5 }}>{t("story.restore.noContent")}</span>}
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
