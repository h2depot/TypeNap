import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { EyeOff_TN, Plus } from '../../../assets/IconList';
import { useTranslation } from 'react-i18next';
import { useFileStore } from '../../../store/fileStore';
import { useStoryStore } from '../../../store/storyStore';
import { useTabStore } from '../../../store/tabStore';
import { useTxtStore } from '../../../store/txtStore';
import { useBgImageStore } from '../../../store/bgImageStore';
import { SOLID_PALETTE_COLORS } from '../../../Constants/colors';
import { TN_BookCard_Preview, TN_Button, TN_Dialog, TN_TextField, TN_IconButton, TN_Tooltip } from '../../TNDesignSystem';
import styles from './tab_story.module.css';
import SynopsisEditor from './SynopsisEditor';

export default function TabStoryOverview({ story_name, workspace, isTitleDialogOpen, onCloseTitleDialog }) {
    const { t } = useTranslation();
    const { renameStory } = useFileStore();
    const { updateStoryInfo, renameStoryWorkspace, waitForSynopsisSave } = useStoryStore();
    const { renameStoryTabs } = useTabStore();
    const { fetchImageList, addUserImage, wholeImageList } = useBgImageStore();
    const [editedTitle, setEditedTitle] = useState(story_name);
    const [savingTitle, setSavingTitle] = useState(false);
    const [savingColor, setSavingColor] = useState(false);
    useEffect(() => setEditedTitle(story_name), [story_name, isTitleDialogOpen]);
    const [isCoverDialogOpen, setIsCoverDialogOpen] = useState(false);
    const [editedCoverColor, setEditedCoverColor] = useState("");

    const handleSaveTitle = async (e) => {
        if (e) e.preventDefault();
        if (savingTitle) return;

        const newStoryName = editedTitle.trim();
        if (!newStoryName || newStoryName === story_name) {
            setEditedTitle(story_name);
            return;
        }

        setSavingTitle(true);
        try {
            await waitForSynopsisSave(story_name);
            await renameStory(story_name, newStoryName);
            renameStoryTabs(story_name, newStoryName);
            useTxtStore.getState().renameStoryInWorkspaces(story_name, newStoryName);
            renameStoryWorkspace(story_name, newStoryName);
            setEditedTitle(newStoryName);
            onCloseTitleDialog();
        } catch (error) {
            console.error("Story name update failed", error);
        } finally {
            setSavingTitle(false);
        }
    };

    const handleSaveCover = async (e) => {
        if (e) e.preventDefault();
        try {
            await waitForSynopsisSave(story_name);
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

    const saveTextColor = async (color) => {
        setSavingColor(true);
        try {
            await waitForSynopsisSave(story_name);
            const info = await useFileStore.getState().updateStoryCover(story_name, workspace.cover, true, color);
            updateStoryInfo(story_name, info);
        } catch (error) { console.error('Text color update failed', error); }
        finally { setSavingColor(false); }
    };
    return <section className={`${styles.mainContent} ${styles.overview}`}>
        <h3 className={styles.contentTitle}>{t('story.overview.title')}</h3>
        <div className={styles.overviewCover}>
            <TN_BookCard_Preview title={story_name} coverColor={workspace.cover} textColor={workspace.coverTextColor}
                tooltip={t('story.cover.chooseImage')}
                onClick={() => { setEditedCoverColor(workspace.cover); setIsCoverDialogOpen(true); }} />
            <div className={styles.overviewFields}>
                <span>{t('story.overview.textColor')}</span>
                <div className={styles.palette}>
                    {SOLID_PALETTE_COLORS.map(color =>
                        <button key={color} type="button" className={styles.swatch} style={{ backgroundColor: color }}
                            aria-label={`${t('story.overview.textColor')} ${color}`} aria-pressed={workspace.coverTextColor === color}
                            disabled={savingColor} onClick={() => saveTextColor(color)} />)}
                    <TN_Tooltip content={t('story.overview.hideCoverText')}>
                        <TN_IconButton icon={<EyeOff_TN size={20} />} size="small"
                            className={styles.hideCoverText}
                            variant={workspace.coverTextColor === 'transparent' ? 'primary' : 'secondary'}
                            aria-label={t('story.overview.hideCoverText')}
                            aria-pressed={workspace.coverTextColor === 'transparent'}
                            disabled={savingColor} onClick={() => saveTextColor('transparent')} />
                    </TN_Tooltip>
                </div>
                <TN_Button variant="secondary" onClick={() => { setEditedCoverColor(workspace.cover); setIsCoverDialogOpen(true); }}>{t('story.cover.chooseImage')}</TN_Button>
            </div>
        </div>
        <form onSubmit={handleSaveTitle} className={styles.overviewFields}>
            <label htmlFor="story-overview-title">{t('library.rename.label')}</label>
            <TN_TextField id="story-overview-title" value={editedTitle}
                disabled={savingTitle} onChange={e => setEditedTitle(e.target.value)} />
            <TN_Button type="submit" disabled={savingTitle || !editedTitle.trim() || editedTitle.trim() === story_name}>
                {t('common.change')}
            </TN_Button>
        </form>
        {createPortal(
            <TN_Dialog isOpen={isTitleDialogOpen} onClose={() => { if (!savingTitle) onCloseTitleDialog(); }}
                title={t('library.rename.title')}>
                <form onSubmit={handleSaveTitle} className={styles.overviewFields}>
                    <label htmlFor="story-title-dialog-input">{t('library.rename.label')}</label>
                    <TN_TextField id="story-title-dialog-input" autoFocus value={editedTitle}
                        disabled={savingTitle} onChange={e => setEditedTitle(e.target.value)} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
                        <TN_Button variant="secondary" disabled={savingTitle} onClick={onCloseTitleDialog}>{t('common.cancel')}</TN_Button>
                        <TN_Button variant="proceed" type="submit" disabled={savingTitle || !editedTitle.trim() || editedTitle.trim() === story_name}>{t('common.change')}</TN_Button>
                    </div>
                </form>
            </TN_Dialog>, document.body
        )}
        <SynopsisEditor storyName={story_name} />
            <TN_Dialog
                isOpen={isCoverDialogOpen}
                onClose={() => setIsCoverDialogOpen(false)}
                title={t("story.cover.changeTitle")}
            >
                <form onSubmit={handleSaveCover} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className={styles.overviewFields}>
                        <span>{t('background.chooseColor')}</span>
                        <div className={styles.palette}>
                            {SOLID_PALETTE_COLORS.map((color, index) => (
                                <button key={color} type="button" className={styles.swatch}
                                    style={{ backgroundColor: color }}
                                    aria-label={`${t('background.chooseColor')} ${index + 1}`}
                                    aria-pressed={editedCoverColor === color}
                                    onClick={() => setEditedCoverColor(color)} />
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{
                            fontSize: '14px',
                            fontWeight: 'var(--font-weight-ui)',
                            color: 'var(--tn-text)',
                            opacity: 0.8
                        }}>
                            {t("background.chooseImage")}
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
                                            background: "var(--tn-hover-bg)"
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
                                                        background: 'var(--tn-gradient, linear-gradient(135deg, #a777e3, #6e8efb))',
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
                            <TN_Tooltip content={t("image.addNew")} position="bottom">
                                <TN_IconButton
                                    variant="primary"
                                    size="medium"
                                    borderRadius="8px"
                                    icon={<Plus size={18} />}
                                    onClick={handleAddImageClick}
                                    type="button"
                                />
                            </TN_Tooltip>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <TN_Button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                setIsCoverDialogOpen(false);
                            }}
                            variant="secondary"
                        >
                            {t("common.cancel")}
                        </TN_Button>
                        <TN_Button
                            type="submit"
                            variant="proceed"
                        >
                            {t("common.change")}
                        </TN_Button>
                    </div>
                </form>
            </TN_Dialog>

    </section>;
}
