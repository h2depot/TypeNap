import { useId, useRef, useState } from 'react';
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { motion, useReducedMotion } from 'framer-motion';
import { BookClose_TN, ContentsView, NodeGraph, RoadMap, Tabular, PanelClose, PanelOpen, Plus, EllipsisVertical } from '../../../assets/IconList';
import { useTranslation } from 'react-i18next';
import { TN_BookCard_Preview, TN_Button, TN_Menu, TN_IconButton } from '../../TNDesignSystem';
import { defaultFlowViews } from '../../FlowDesignSystem/flowViewState.js';
import styles from './tab_story.module.css';

const viewIcons = { graph: NodeGraph, tabular: Tabular };

export function FlowViewSortContext({ views, onReorder, children }) {
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    return <DndContext sensors={sensors} collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={({ active, over }) => {
            if (over && active.id !== over.id) onReorder?.(active.id, over.id);
        }}>
        <SortableContext items={views.map(entry => entry.id)} strategy={verticalListSortingStrategy}>
            {children}
        </SortableContext>
    </DndContext>;
}

export function FlowViewNavItem({ entry, selected, collapsed = false, disabled = false, onOpen, onAction }) {
    const { t } = useTranslation();
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id, disabled });
    const suppressClick = useRef(false);
    if (isDragging) suppressClick.current = true;
    const start = (event, listener) => {
        if (!isDragging) suppressClick.current = false;
        listener?.(event);
    };
    const Icon = viewIcons[entry.type];
    return <div ref={setNodeRef} className={styles.flowViewNavRow} data-collapsed={collapsed} data-dragging={isDragging || undefined}
        style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 1 : undefined }}>
        <button type="button" ref={setActivatorNodeRef} {...attributes}
            className={`${collapsed ? `${styles.sidebarToggle} ${styles.overviewIconButton}` : styles.contentsNavButton} ${styles.flowViewDragButton}`}
            onMouseDown={event => start(event, listeners?.onMouseDown)}
            onTouchStart={event => start(event, listeners?.onTouchStart)}
            onKeyDown={event => start(event, listeners?.onKeyDown)}
            onClick={event => {
                if (suppressClick.current) {
                    event?.preventDefault();
                    suppressClick.current = false;
                    return;
                }
                onOpen(entry.id);
            }} aria-label={entry.name} title={entry.name} aria-pressed={selected}>
            <Icon size={collapsed ? 18 : 20} aria-hidden="true" />
            {!collapsed && <span className={styles.flowViewNavName}>{entry.name}</span>}
        </button>
        {!collapsed && <TN_Menu trigger={<TN_IconButton icon={<EllipsisVertical size={16} aria-hidden="true" />}
            variant="ghost" subtle size="small" borderRadius="8px" className={styles.flowViewMenuButton}
            style={{ width: '28px', height: '28px', boxShadow: 'none' }}
            aria-label={t('story.views.actions', { name: entry.name })} />}
            items={[
                { label: t('story.views.rename'), onClick: () => onAction('rename', entry) },
                { label: t('common.duplicate'), onClick: () => onAction('duplicate', entry) },
                { label: t('common.delete'), isDanger: true, onClick: () => onAction('delete', entry) },
            ]} />}
    </div>;
}

function AddFlowViewButton({ onAdd }) {
    const { t } = useTranslation();
    return <TN_Menu trigger={<TN_IconButton icon={<Plus size={16} aria-hidden="true" />} variant="ghost" subtle
        size="small" borderRadius="8px" style={{ width: '28px', height: '28px', boxShadow: 'none' }}
        aria-label={t('story.views.add')} title={t('story.views.add')} />}
        items={[
            { label: t('story.views.addGraph'), onClick: () => onAdd('graph') },
            { label: t('story.views.addTabular'), onClick: () => onAdd('tabular') },
        ]} />;
}

export default function TabStoryNav({ story_name, workspace, view, onOverview, onContents, onAddContent, onFlowView,
    flowViews = defaultFlowViews, onAddView, onViewAction, onReorderViews }) {
    const { t } = useTranslation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [viewsExpanded, setViewsExpanded] = useState(true);
    const reduceMotion = useReducedMotion();
    const contentId = useId();
    const viewsId = useId();
    const toggleLabel = t(isCollapsed ? 'story.overview.expandNavigation' : 'story.overview.collapseNavigation');
    return <motion.nav className={styles.sidebar} data-collapsed={isCollapsed} aria-label={t('story.overview.navigation')}
        initial={false}
        animate={{ width: isCollapsed ? 48 : 270, paddingLeft: isCollapsed ? 8 : 10, paddingRight: isCollapsed ? 7 : 10 }}
        transition={{ type: 'tween', duration: reduceMotion ? 0.16 : 0.36, ease: [0.25, 0.1, 0.25, 1] }}>
        <div className={styles.sidebarHeader}>
            <button type="button" className={styles.sidebarToggle}
                onClick={() => setIsCollapsed(collapsed => !collapsed)}
                aria-label={toggleLabel}
                aria-expanded={!isCollapsed} aria-controls={contentId}>
                {isCollapsed ? <PanelOpen size={18} aria-hidden="true" /> : <PanelClose size={18} aria-hidden="true" />}
            </button>
        </div>
        {isCollapsed && <div className={styles.sidebarCollapsedActions}>
            <button type="button" className={`${styles.sidebarToggle} ${styles.overviewIconButton}`}
                onClick={onOverview} aria-label={t('story.overview.title')}
                 aria-pressed={view === 'overview'}>
                <BookClose_TN size={18} aria-hidden="true" />
            </button>
            <button type="button" className={`${styles.sidebarToggle} ${styles.overviewIconButton}`}
                onClick={() => onFlowView('roadmap')} aria-label="RoadMap" title="RoadMap"
                aria-pressed={view === 'roadmap'}>
                <RoadMap size={18} aria-hidden="true" />
            </button>
            <button type="button" className={`${styles.sidebarToggle} ${styles.overviewIconButton}`}
                onClick={onContents} aria-label={t('story.overview.contents')}
                 aria-pressed={view === 'contents'}>
                <ContentsView size={18} aria-hidden="true" />
            </button>
            {flowViews.length > 0 && <>
            <hr className={styles.sidebarNavDivider} />
            <FlowViewSortContext views={flowViews} onReorder={onReorderViews}>
            <div className={styles.flowViewCollapsedList}>
                {flowViews.map(entry => <FlowViewNavItem key={entry.id} entry={entry} collapsed selected={view === entry.id}
                    onOpen={onFlowView} onAction={onViewAction} />)}
            </div>
            </FlowViewSortContext>
            </>}
        </div>}
        <motion.div id={contentId} className={styles.sidebarBody} hidden={isCollapsed}
            aria-hidden={isCollapsed} inert={isCollapsed}
            initial={false}
            animate={{ opacity: isCollapsed ? 0 : 1, x: isCollapsed && !reduceMotion ? -12 : 0, visibility: 'visible' }}
            transition={{ type: 'tween', duration: 0.16, ease: [0.25, 0.1, 0.25, 1], delay: isCollapsed || reduceMotion ? 0 : 0.1 }}
            transitionEnd={{ visibility: isCollapsed ? 'hidden' : 'visible' }}>
        <div className={styles.sidebarSummary}>
            <TN_BookCard_Preview title={story_name} coverColor={workspace.cover}
                tooltip={t('story.overview.title')} compact showTitle
                textColor={workspace.coverTextColor} onClick={onOverview} />
        </div>
        <div className={styles.sidebarContent}>
            <div className={styles.sidebarDetails}>
                <span className={styles.metaText}>{t('story.summary.totalCharacters', { count: workspace.charCnt })}</span>
                <span className={styles.metaText}>{t('story.summary.lastUpdated', { date: workspace.lastUpdate ? new Date(workspace.lastUpdate * 1000).toLocaleString() : '---' })}</span>
            </div>
            <TN_Button variant="proceed" borderRadius="10px" className={styles.sidebarAddButton} onClick={onAddContent}>
                <Plus size={18} aria-hidden="true" />
                {t('story.files.createTitle')}
            </TN_Button>
            <button type="button" className={styles.contentsNavButton} onClick={() => onFlowView('roadmap')} aria-pressed={view === 'roadmap'}>
                <RoadMap size={20} aria-hidden="true" />
                RoadMap
            </button>
            <button type="button" className={styles.contentsNavButton} onClick={onContents} aria-pressed={view === 'contents'}>
                <ContentsView size={20} aria-hidden="true" />
                {t('story.overview.contents')}
            </button>
            <hr className={styles.sidebarNavDivider} />
            <div className={styles.flowViewSectionHeader}>
                <button type="button" className={styles.flowViewSectionToggle} aria-expanded={viewsExpanded}
                    aria-controls={`${viewsId}-expanded`} onClick={() => setViewsExpanded(expanded => !expanded)}>
                    <span className={styles.flowViewSectionTriangle} data-expanded={viewsExpanded} aria-hidden="true" />
                    {t('story.views.section')}
                </button>
                <AddFlowViewButton onAdd={onAddView} />
            </div>
            <FlowViewSortContext views={flowViews} onReorder={onReorderViews}>
            <div id={`${viewsId}-expanded`} className={styles.flowViewList} hidden={!viewsExpanded}>
                {flowViews.map(entry => <FlowViewNavItem key={entry.id} entry={entry} selected={view === entry.id}
                    disabled={isCollapsed || !viewsExpanded} onOpen={onFlowView} onAction={onViewAction} />)}
                {!flowViews.length && <p className={styles.flowViewEmpty}>{t('story.views.empty')}</p>}
            </div>
            </FlowViewSortContext>
        </div>
        </motion.div>
    </motion.nav>;
}
