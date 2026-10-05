import React, { useState, useEffect } from "react";
import { useTabStore } from "../../../store/tabStore";
import { useFileStore } from "../../../store/fileStore";
import { useStoryStore } from "../../../store/storyStore";
import { useTxtStore } from "../../../store/txtStore";
import { BookSearch_TN, ArrowUpWideNarrow, ArrowDownWideNarrow, Plus } from "../../../assets/IconList";
import styles from "./LibraryView.module.css";
import AddTabContent from "../../Dialog/AddTabContent";
import {
    TN_Dialog,
    TN_Button,
    TN_BookCard,
    TN_TextField,
    TN_Dropdown,
    TN_IconButton
} from "../../TNDesignSystem";
import { useTranslation } from "react-i18next";

export default function LibraryView() {
    const { t, i18n } = useTranslation();
    const { addTab, renameStoryTabs, removeStoryTabs } = useTabStore();
    const { storyList, fetchStoryList, renameStory, deleteStory } = useFileStore();
    const { renameStoryWorkspace, removeWorkspace } = useStoryStore();

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteTargetStory, setDeleteTargetStory] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [renameTargetStory, setRenameTargetStory] = useState("");
    const [newStoryName, setNewStoryName] = useState("");

    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [detailsTargetStory, setDetailsTargetStory] = useState(null);

    // Sort and filter states
    const [sortBy, setSortBy] = useState("title");
    const [isAscending, setIsAscending] = useState(true);

    const sortOptions = [
        { value: "title", label: t("library.sort.title") },
        { value: "date", label: t("library.sort.updated") },
        { value: "created", label: t("library.sort.created") }
    ];

    const formatUpdatedDate = (timestamp) => {
        if (!timestamp) return "";
        return new Date(timestamp * 1000).toLocaleDateString(i18n.language);
    };

    const visibleStories = storyList
        .filter((story) => story.story_name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            const comparison = (() => {
                if (sortBy === "date") return (a.last_update ?? 0) - (b.last_update ?? 0);
                if (sortBy === "created") return (a.created_at ?? 0) - (b.created_at ?? 0);
                return a.story_name.localeCompare(b.story_name);
            })();

            return isAscending ? comparison : -comparison;
        });

    useEffect(() => {
        fetchStoryList();

        const handleOpenAddDialog = () => setIsAddDialogOpen(true);
        window.addEventListener('open-add-story-dialog', handleOpenAddDialog);

        return () => {
            window.removeEventListener('open-add-story-dialog', handleOpenAddDialog);
        };
    }, [fetchStoryList]);

    const closeRenameDialog = () => {
        setIsRenameDialogOpen(false);
        setRenameTargetStory("");
        setNewStoryName("");
    };

    const handleDeleteStory = async () => {
        if (!deleteTargetStory) return;

        const storyName = deleteTargetStory;

        try {
            // Finish pending synopsis writes before deleting their destination.
            await useStoryStore.getState().waitForSynopsisSave(storyName);
            await deleteStory(storyName);
            removeStoryTabs(storyName);
            removeWorkspace(storyName);
            useTxtStore.getState().removeStoryWorkspaces(storyName);
            setIsDeleteDialogOpen(false);
            setDeleteTargetStory(null);
        } catch (error) {
            console.error("Deletion failed", error);
        }
    }

    const handleRenameStory = async (e) => {
        if (e) e.preventDefault();

        const nextStoryName = newStoryName.trim();
        if (!nextStoryName || nextStoryName === renameTargetStory) {
            closeRenameDialog();
            return;
        }

        try {
            await useStoryStore.getState().waitForSynopsisSave(renameTargetStory);
            await renameStory(renameTargetStory, nextStoryName);
            renameStoryTabs(renameTargetStory, nextStoryName);
            useTxtStore.getState().renameStoryInWorkspaces(renameTargetStory, nextStoryName);
            renameStoryWorkspace(renameTargetStory, nextStoryName);
            closeRenameDialog();
        } catch (error) {
            console.error("Story name update failed", error);
        }
    }

    return (
        <div className={styles.container}>
            <header className={styles.pageHeader}>
                <div>
                    <h1 className={styles.sectionTitle}>{t("library.title")}</h1>
                    <p className={styles.description}>{t("library.description")}</p>
                </div>
                <TN_Button variant="proceed" onClick={() => setIsAddDialogOpen(true)} borderRadius="10px">
                    <Plus size={18} />{t("library.addStory")}
                </TN_Button>
            </header>
            <div className={styles.controlsContainer}>
                <div className={styles.searchTextField}>
                    <TN_TextField
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("library.searchPlaceholder")}
                        icon={<BookSearch_TN size={18} />}
                        borderRadius="10px"
                    />
                </div>
                <div className={styles.rightControls}>
                    <TN_Dropdown
                        options={sortOptions}
                        value={sortBy}
                        onChange={(val) => setSortBy(val)}
                        placeholder={t("library.sort.placeholder")}
                    />
                    <TN_IconButton
                        icon={isAscending ? <ArrowUpWideNarrow size={20} /> : <ArrowDownWideNarrow size={20} />}
                        onClick={() => setIsAscending(!isAscending)}
                        variant="secondary"
                        title={t(isAscending ? "library.sort.ascending" : "library.sort.descending")}
                    />

                </div>
            </div>
            <div className={styles.resultCount} role="status">
                {t("library.resultCount", { count: visibleStories.length, total: storyList.length })}
            </div>
            <div className={styles.storyGallery}>
                {visibleStories.map((story) => {
                    const storyName = story.story_name;
                    const key = `story-${storyName}`;

                    return (
                        <TN_BookCard
                            key={key}
                            title={storyName}
                            updated={formatUpdatedDate(story.last_update)}
                            coverColor={story.cover}
                            textColor={story.cover_text_color}
                            OnClick={() => addTab('story', storyName, { story_name: storyName })}
                            menuItems={[
                                {
                                    label: t("library.actions.details"),
                                    onClick: () => {
                                        setDetailsTargetStory(story);
                                        setIsDetailsDialogOpen(true);
                                    }
                                },
                                {
                                    label: t("common.rename"),
                                    onClick: () => {
                                        setRenameTargetStory(storyName);
                                        setNewStoryName(storyName);
                                        setIsRenameDialogOpen(true);
                                    }
                                },
                                {
                                    label: t("common.delete"),
                                    onClick: () => {
                                        setDeleteTargetStory(storyName);
                                        setIsDeleteDialogOpen(true);
                                    },
                                    isDanger: true
                                }
                            ]}
                        />
                    );
                })}
                {visibleStories.length === 0 && (
                    <div className={styles.emptyState}>
                        <BookSearch_TN size={32} aria-hidden="true" />
                        <p>{t(searchQuery ? "library.noResults" : "library.empty")}</p>
                        {searchQuery && <TN_Button variant="secondary" onClick={() => setSearchQuery("")}>{t("common.clearInput")}</TN_Button>}
                    </div>
                )}
            </div>

            <TN_Dialog
                isOpen={isDeleteDialogOpen}
                onClose={() => {
                    setIsDeleteDialogOpen(false);
                    setDeleteTargetStory(null);
                }}
                title={t("common.deleteConfirmation")}
            >
                <p style={{ marginTop: 0 }}>{t("library.deleteMessage", { name: deleteTargetStory })}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', gap: '12px' }}>
                    <TN_Button
                        variant="secondary"
                        onClick={() => setIsDeleteDialogOpen(false)}
                    >
                        {t("common.cancel")}
                    </TN_Button>
                    <TN_Button
                        variant="proceed"
                        onClick={handleDeleteStory}
                    >
                        {t("common.delete")}
                    </TN_Button>
                </div>
            </TN_Dialog>

            <TN_Dialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                title={t("library.addStory")}
            >
                <AddTabContent onComplete={() => setIsAddDialogOpen(false)} />
            </TN_Dialog>

            <TN_Dialog
                isOpen={isDetailsDialogOpen}
                onClose={() => {
                    setIsDetailsDialogOpen(false);
                    setDetailsTargetStory(null);
                }}
                title={t("library.details.title")}
            >
                {detailsTargetStory && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--tn-text)', maxHeight: '400px', overflowY: 'auto', padding: '8px' }}>
                        {Object.entries(detailsTargetStory).map(([key, value]) => {
                            let displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

                            if (typeof value === 'number' && (key === 'created_at' || key === 'last_update' || key.includes('time') || key.includes('date'))) {
                                const date = new Date(value > 1e11 ? value : value * 1000);
                                displayValue = date.toLocaleString('ja-JP');
                            }

                            if (key === 'chapters') {
                                displayValue = t("common.chapterCount", { count: Array.isArray(value) ? value.length : (value ? 1 : 0) });
                            }

                            if (key === 'char_cnt') {
                                displayValue = t("common.characterCount", { count: value });
                            }

                            const keyLabels = {
                                story_name: t("library.details.storyName"),
                                created_at: t("library.details.createdAt"),
                                last_update: t("library.details.lastUpdated"),
                                synopsis: t("library.details.synopsis"),
                                chapters: t("library.details.chapters"),
                                char_cnt: t("library.details.totalCharacters"),
                            };
                            const label = keyLabels[key] || key;

                            return (
                                <div key={key}>
                                    <div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}>{label}</div>
                                    <div style={{ fontSize: '14px', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{displayValue}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                    <TN_Button
                        variant="primary"
                        onClick={() => {
                            setIsDetailsDialogOpen(false);
                            setDetailsTargetStory(null);
                        }}
                    >
                        {t("common.close")}
                    </TN_Button>
                </div>
            </TN_Dialog>

            <TN_Dialog
                isOpen={isRenameDialogOpen}
                onClose={closeRenameDialog}
                title={t("library.rename.title")}
            >
                <form
                    onSubmit={handleRenameStory}
                    style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{
                            fontSize: '14px',
                            fontWeight: 'var(--font-weight-ui)',
                            color: 'var(--tn-text)',
                            opacity: 0.8
                        }}>
                            {t("library.rename.label")}
                        </label>
                        <TN_TextField
                            value={newStoryName}
                            onChange={(e) => setNewStoryName(e.target.value)}
                            placeholder={t("library.rename.placeholder")}
                            autoFocus
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <TN_Button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                closeRenameDialog();
                            }}
                            variant="secondary"
                        >
                            {t("common.cancel")}
                        </TN_Button>
                        <TN_Button
                            type="submit"
                            variant="proceed"
                            disabled={newStoryName.trim() === ""}
                        >
                            {t("common.change")}
                        </TN_Button>
                    </div>
                </form>
            </TN_Dialog>
        </div>
    );
}
