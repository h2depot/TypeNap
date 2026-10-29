import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { open } from '@tauri-apps/plugin-dialog';
import { EyeOff_TN } from '../../../assets/IconList';
import { useTranslation } from 'react-i18next';
import { useFileStore } from '../../../store/fileStore';
import { useStoryStore } from '../../../store/storyStore';
import { useTabStore } from '../../../store/tabStore';
import { useTxtStore } from '../../../store/txtStore';
import { useImageStore } from '../../../store/imageStore';
import { normalizeImagePath } from '../../../utils/imagePaths.js';
import { SOLID_PALETTE_COLORS } from '../../../Constants/colors';
import { TN_BookCard_Preview, TN_Button, TN_Dialog, TN_TextField, TN_IconButton, TN_Tooltip } from '../../TNDesignSystem';
import styles from './tab_story.module.css';
import paletteStyles from '../../Dialog/ColorPalette.module.css';
import SynopsisEditor from './SynopsisEditor';
import ImageCollectionPicker from '../../Dialog/ImageCollectionPicker';

export default function TabStoryOverview({ story_name, workspace, isTitleDialogOpen, onCloseTitleDialog }) {
    const { t } = useTranslation();
    const { renameStory, storyList = [] } = useFileStore();
    const { updateStoryInfo, renameStoryWorkspace, waitForSynopsisSave } = useStoryStore();
    const { renameStoryTabs } = useTabStore();
    const { fetchImageList, addUserImage, wholeImageList } = useImageStore();
    const [editedTitle, setEditedTitle] = useState(story_name);
    const normalizedRename = editedTitle.trim().toLowerCase();
    const renameNameExists = normalizedRename !== '' && storyList.some(story => (
        story.story_name !== story_name && story.story_name.trim().toLowerCase() === normalizedRename
    ));
    const [savingTitle, setSavingTitle] = useState(false);
    const [savingColor, setSavingColor] = useState(false);
    useEffect(() => setEditedTitle(story_name), [story_name, isTitleDialogOpen]);
    const [isCoverDialogOpen, setIsCoverDialogOpen] = useState(false);
    const [coverDraft, setEditedCoverColor] = useState("");
    const editedCoverColor = normalizeImagePath(coverDraft);

    const handleSaveTitle = async (e) => {
        if (e) e.preventDefault();
        if (savingTitle || renameNameExists) return;

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
                const image = await addUserImage(selected);
                setEditedCoverColor(image.path);
                await fetchImageList();
            }
        } catch (error) {
            console.error("Failed to select or add image", error);
            throw error;
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
                <div className={paletteStyles.palette}>
                    {SOLID_PALETTE_COLORS.map(color =>
                        <button key={color} type="button" className={paletteStyles.swatch} style={{ backgroundColor: color }}
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
                aria-invalid={renameNameExists} aria-describedby={renameNameExists ? 'story-overview-title-error' : undefined}
                disabled={savingTitle} onChange={e => setEditedTitle(e.target.value)} />
            {renameNameExists && <div id="story-overview-title-error" role="alert" style={{ color: '#d9534f', fontSize: '13px' }}>{t('story.create.duplicateName')}</div>}
            <TN_Button type="submit" disabled={savingTitle || renameNameExists || !editedTitle.trim() || editedTitle.trim() === story_name}>
                {t('common.change')}
            </TN_Button>
        </form>
        {createPortal(
            <TN_Dialog isOpen={isTitleDialogOpen} onClose={() => { if (!savingTitle) onCloseTitleDialog(); }}
                title={t('library.rename.title')}>
                <form onSubmit={handleSaveTitle} className={styles.overviewFields}>
                    <label htmlFor="story-title-dialog-input">{t('library.rename.label')}</label>
                    <TN_TextField id="story-title-dialog-input" autoFocus value={editedTitle}
                        aria-invalid={renameNameExists} aria-describedby={renameNameExists ? 'story-title-dialog-error' : undefined}
                        disabled={savingTitle} onChange={e => setEditedTitle(e.target.value)} />
                    {renameNameExists && <div id="story-title-dialog-error" role="alert" style={{ color: '#d9534f', fontSize: '13px' }}>{t('story.create.duplicateName')}</div>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
                        <TN_Button variant="secondary" disabled={savingTitle} onClick={onCloseTitleDialog}>{t('common.cancel')}</TN_Button>
                        <TN_Button variant="proceed" type="submit" disabled={savingTitle || renameNameExists || !editedTitle.trim() || editedTitle.trim() === story_name}>{t('common.change')}</TN_Button>
                    </div>
                </form>
            </TN_Dialog>, document.body
        )}
        <SynopsisEditor storyName={story_name} />
            <TN_Dialog
                isOpen={isCoverDialogOpen}
                onClose={() => setIsCoverDialogOpen(false)}
                title={t("story.cover.changeTitle")}
                maxWidth="860px"
            >
                <form onSubmit={handleSaveCover} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className={styles.overviewFields}>
                        <span>{t('background.chooseColor')}</span>
                        <div className={paletteStyles.palette}>
                            {SOLID_PALETTE_COLORS.map((color, index) => (
                                <button key={color} type="button" className={paletteStyles.swatch}
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
                        {isCoverDialogOpen && <ImageCollectionPicker images={wholeImageList} selectedPath={editedCoverColor}
                            onSelect={setEditedCoverColor} onImport={handleAddImageClick} />}

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
