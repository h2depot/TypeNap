import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFileStore } from '../../../store/fileStore';
import { useStoryStore } from '../../../store/storyStore';
import TabStoryNav from './tab_story_nav';
import TabStoryContents from './tab_story_contents';
import TabStoryOverview from './tab_story_overview';
import styles from './tab_story.module.css';

export default function Tab_Story({ story_name }) {
    const { t } = useTranslation();
    const { storyList, getStoryInfo } = useFileStore();
    const { workspaces, initWorkspace, updateStoryInfo } = useStoryStore();
    const workspace = workspaces[story_name];
    const [view, setView] = useState('contents');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isTitleDialogOpen, setIsTitleDialogOpen] = useState(false);
    useEffect(() => {
        const add = () => { setView('contents'); setIsAddDialogOpen(true); };
        window.addEventListener('open-add-episode-dialog', add);
        return () => window.removeEventListener('open-add-episode-dialog', add);
    }, []);
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


    if (!workspace) return <div>{t('common.loading')}</div>;
    return <div className={styles.container}>
        <TabStoryNav story_name={story_name} workspace={workspace} view={view}
            onOverview={() => setView('overview')} onContents={() => setView('contents')} />
        <div className={styles.contentPane} hidden={view !== 'overview'}>
            <TabStoryOverview story_name={story_name} workspace={workspace}
                isTitleDialogOpen={isTitleDialogOpen} onCloseTitleDialog={() => setIsTitleDialogOpen(false)} />
        </div>
        <div className={styles.contentPane} hidden={view !== 'contents'}>
            <TabStoryContents story_name={story_name} workspace={workspace}
                isAddDialogOpen={isAddDialogOpen} setIsAddDialogOpen={setIsAddDialogOpen} />
        </div>
    </div>;
}
