import { lazy, Suspense, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFileStore } from '../../../store/fileStore';
import { useStoryStore } from '../../../store/storyStore';
import TabStoryNav from './tab_story_nav';
import TabStoryContents from './tab_story_contents';
import TabStoryOverview from './tab_story_overview';
import FlowViewDialog from './FlowViewDialog';
import { duplicateFlowView } from '../../FlowDesignSystem/flowViewState.js';
import { addFlowView, flowViewDataKey, flowViewNameError, loadFlowViews, removeFlowView, renameFlowView, reorderFlowViews, saveFlowViews } from '../../FlowDesignSystem/flowViewState.js';
import { useToastStore } from '../../../store/toastStore';
import styles from './tab_story.module.css';

const FlowDesignSystem = lazy(() => import('../../FlowDesignSystem/main.jsx'));
const viewStorage = {
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: key => window.localStorage.removeItem(key),
};

export default function Tab_Story({ story_name, isActive = true }) {
    const { t } = useTranslation();
    const { storyList, getStoryInfo } = useFileStore();
    const { workspaces, initWorkspace, updateStoryInfo } = useStoryStore();
    const workspace = workspaces[story_name];
    const [view, setView] = useState('contents');
    const [flowViews, setFlowViews] = useState(() => loadFlowViews(viewStorage, story_name));
    const [flowDialog, setFlowDialog] = useState(null);
    const [openedFlowViews, setOpenedFlowViews] = useState([]);
    const openFlowView = nextView => {
        setOpenedFlowViews(current => current.includes(nextView) ? current : [...current, nextView]);
        setView(nextView);
    };
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isTitleDialogOpen, setIsTitleDialogOpen] = useState(false);
    const reorderViews = (activeId, overId) => {
        const next = reorderFlowViews(flowViews, activeId, overId);
        if (next === flowViews) return;
        if (!saveFlowViews(viewStorage, story_name, next)) {
            useToastStore.getState().addToast(t('story.views.saveFailed'), 'error');
            return;
        }
        setFlowViews(next);
    };
    const addFlowViewDialog = type => {
        const base = type === 'graph' ? 'GraphMap' : 'Tabular';
        let name = base;
        let suffix = 2;
        while (flowViewNameError(flowViews, name, type)) name = `${base} ${suffix++}`;
        setFlowDialog({ mode: 'create', type, name });
    };
    const confirmFlowView = dialog => {
        const created = dialog.mode === 'create' ? { id: `${dialog.type}-${crypto.randomUUID()}`, type: dialog.type, name: dialog.name } : null;
        const next = created ? addFlowView(flowViews, created)
            : dialog.mode === 'rename' ? renameFlowView(flowViews, dialog.id, dialog.name) : removeFlowView(flowViews, dialog.id);
        if (next === flowViews || !saveFlowViews(viewStorage, story_name, next)) {
            useToastStore.getState().addToast(t('story.views.saveFailed'), 'error');
            return;
        }
        setFlowViews(next);
        setFlowDialog(null);
        if (created) openFlowView(created.id);
        if (dialog.mode === 'delete') {
            setOpenedFlowViews(current => current.filter(id => id !== dialog.id));
            if (view === dialog.id) setView('contents');
            try { window.localStorage.removeItem(flowViewDataKey(story_name, dialog)); }
            catch (error) { console.warn('Failed to remove saved view data', error); }
        }
    };
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
            flowViews={flowViews} onAddView={addFlowViewDialog}
            onReorderViews={reorderViews}
            onViewAction={(mode, entry) => {
                if (mode !== 'duplicate') { setFlowDialog({ ...entry, mode }); return; }
                try {
                    const result = duplicateFlowView(viewStorage, story_name, flowViews, entry.id);
                    setFlowViews(result.views);
                    openFlowView(result.copy.id);
                } catch {
                    useToastStore.getState().addToast(t('story.views.saveFailed'), 'error');
                }
            }}
            onAddContent={() => { setView('contents'); setIsAddDialogOpen(true); }}
            onOverview={() => setView('overview')} onContents={() => setView('contents')}
            onFlowView={openFlowView} />
        <div className={styles.contentPane} hidden={view !== 'overview'}>
            <TabStoryOverview story_name={story_name} workspace={workspace}
                isTitleDialogOpen={isTitleDialogOpen} onCloseTitleDialog={() => setIsTitleDialogOpen(false)} />
        </div>
        <div className={styles.contentPane} hidden={view !== 'contents'}>
            <TabStoryContents story_name={story_name} workspace={workspace}
                isAddDialogOpen={isAddDialogOpen} setIsAddDialogOpen={setIsAddDialogOpen} />
        </div>
        {openedFlowViews.length > 0 && <Suspense fallback={<div className={styles.contentPane} hidden={!openedFlowViews.includes(view)} role="status">{t('common.loading')}</div>}>
            <FlowDesignSystem key={story_name} view={view} mountedViews={openedFlowViews}
                storyName={story_name} flowViews={flowViews} isActive={isActive && !flowDialog} hidden={!openedFlowViews.includes(view)} />
        </Suspense>}
        {flowDialog && isActive && <FlowViewDialog key={`${flowDialog.mode}:${flowDialog.id ?? flowDialog.type}`}
            dialog={flowDialog} views={flowViews} onClose={() => setFlowDialog(null)} onConfirm={confirmFlowView} />}
    </div>;
}
