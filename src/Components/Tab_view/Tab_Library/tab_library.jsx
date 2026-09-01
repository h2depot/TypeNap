import React, { useState, useEffect } from "react";
import { useTabStore } from "../../../store/tabStore";
import { useFileStore } from "../../../store/fileStore";
import { useStoryStore } from "../../../store/storyStore";
import { useTxtStore } from "../../../store/txtStore";
import { Search, ArrowUpNarrowWide, ArrowDownNarrowWide, Funnel, Pencil } from "lucide-react";
import styles from "./tab_library.module.css";
import AddTabContent from "../../Dialog/AddTabContent";
import {
    GhostDialog,
    GhostButton,
    GhostBookCard,
    GhostTextField,
    GhostDropdown,
    GhostIconButton
} from "../../GhostDesignSystem";
import { useTranslation } from "react-i18next";

export default function Tab_Library() {
    const { t, i18n } = useTranslation();
    const { addTab, renameStoryTabs, removeStoryTabs } = useTabStore();
    const { storyList, fetchStoryList, renameStory, deleteStory } = useFileStore();
    const { renameStoryWorkspace, removeWorkspace } = useStoryStore();

    const [openMenuId, setOpenMenuId] = useState(null);
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
    const [isFilterActive, setIsFilterActive] = useState(false);

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
            <div className={styles.sectionTitle}>{t("library.title")}</div>
            <div className={styles.controlsContainer}>
                <div className={styles.searchTextField}>
                    <GhostTextField
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("library.searchPlaceholder")}
                        icon={<Search size={18} />}
                        borderRadius="30px"
                    />
                </div>
                <div className={styles.rightControls}>
                    <GhostDropdown
                        options={sortOptions}
                        value={sortBy}
                        onChange={(val) => setSortBy(val)}
                        placeholder={t("library.sort.placeholder")}
                    />
                    <GhostIconButton
                        icon={isAscending ? <ArrowUpNarrowWide size={20} /> : <ArrowDownNarrowWide size={20} />}
                        onClick={() => setIsAscending(!isAscending)}
                        variant="secondary"
                        borderRadius="30px"
                        title={t(isAscending ? "library.sort.ascending" : "library.sort.descending")}
                    />
                    <GhostIconButton
                        icon={<Funnel size={20} />}
                        onClick={() => setIsFilterActive(!isFilterActive)}
                        variant={isFilterActive ? "primary" : "secondary"}
                        borderRadius="30px"
                        title={t("library.filter")}
                    />
                </div>
            </div>
            <div className={styles.storyGallery}>
                {visibleStories.map((story) => {
                    const storyName = story.story_name;
                    const key = `story-${storyName}`;

                    return (
                        <GhostBookCard
                            key={key}
                            title={storyName}
                            updated={formatUpdatedDate(story.last_update)}
                            coverColor={story.cover}
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
                            OnMoreClick={() => setOpenMenuId(key)}
                        />
                    );
                })}
                {visibleStories.length === 0 && (
                    <p style={{ opacity: 0.5, padding: "0 10px" }}>{t("library.empty")}</p>
                )}
            </div>

            <GhostDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => {
                    setIsDeleteDialogOpen(false);
                    setDeleteTargetStory(null);
                }}
                title={t("common.deleteConfirmation")}
            >
                <p style={{ marginTop: 0 }}>{t("library.deleteMessage", { name: deleteTargetStory })}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', gap: '12px' }}>
                    <GhostButton
                        variant="secondary"
                        onClick={() => setIsDeleteDialogOpen(false)}
                    >
                        {t("common.cancel")}
                    </GhostButton>
                    <GhostButton
                        variant="primary"
                        onClick={handleDeleteStory}
                    >
                        {t("common.delete")}
                    </GhostButton>
                </div>
            </GhostDialog>

            <div className={styles.floatingButtonContainer}>
                <GhostIconButton
                    icon={<Pencil />}
                    onClick={() => setIsAddDialogOpen(true)}
                    variant="primary"
                    size="extra_large"
                />
            </div>

            <GhostDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                title={t("library.addStory")}
            >
                <AddTabContent onComplete={() => setIsAddDialogOpen(false)} />
            </GhostDialog>

            <GhostDialog
                isOpen={isDetailsDialogOpen}
                onClose={() => {
                    setIsDetailsDialogOpen(false);
                    setDetailsTargetStory(null);
                }}
                title={t("library.details.title")}
            >
                {detailsTargetStory && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--ghost-text)', maxHeight: '400px', overflowY: 'auto', padding: '8px' }}>
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
                    <GhostButton
                        variant="primary"
                        onClick={() => {
                            setIsDetailsDialogOpen(false);
                            setDetailsTargetStory(null);
                        }}
                    >
                        {t("common.close")}
                    </GhostButton>
                </div>
            </GhostDialog>

            <GhostDialog
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
                            fontWeight: 600,
                            color: 'var(--ghost-text)',
                            opacity: 0.8
                        }}>
                            {t("library.rename.label")}
                        </label>
                        <GhostTextField
                            value={newStoryName}
                            onChange={(e) => setNewStoryName(e.target.value)}
                            placeholder={t("library.rename.placeholder")}
                            autoFocus
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <GhostButton
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                closeRenameDialog();
                            }}
                            variant="secondary"
                        >
                            {t("common.cancel")}
                        </GhostButton>
                        <GhostButton
                            type="submit"
                            variant="primary"
                            disabled={newStoryName.trim() === ""}
                        >
                            {t("common.change")}
                        </GhostButton>
                    </div>
                </form>
            </GhostDialog>
        </div>
    );
}
