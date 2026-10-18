import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BookClose_TN, ContentsView, PanelClose, PanelOpen } from '../../../assets/IconList';
import { useTranslation } from 'react-i18next';
import { TN_BookCard_Preview } from '../../TNDesignSystem';
import ContentAddButton from '../../ContentAddButton';
import styles from './tab_story.module.css';

export default function TabStoryNav({ story_name, workspace, view, onOverview, onContents, onAddContent }) {
    const { t } = useTranslation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const reduceMotion = useReducedMotion();
    const contentId = useId();
    const toggleLabel = t(isCollapsed ? 'story.overview.expandNavigation' : 'story.overview.collapseNavigation');
    return <motion.nav className={styles.sidebar} aria-label={t('story.overview.navigation')}
        initial={false}
        animate={{ width: isCollapsed ? 48 : 270, paddingLeft: isCollapsed ? 8 : 10, paddingRight: isCollapsed ? 7 : 10 }}
        transition={{ type: 'tween', duration: reduceMotion ? 0.16 : 0.36, ease: [0.25, 0.1, 0.25, 1] }}>
        <div className={styles.sidebarHeader}>
            <button type="button" className={styles.sidebarToggle}
                onClick={() => setIsCollapsed(collapsed => !collapsed)}
                aria-label={toggleLabel} title={toggleLabel}
                aria-expanded={!isCollapsed} aria-controls={contentId}>
                {isCollapsed ? <PanelOpen size={18} aria-hidden="true" /> : <PanelClose size={18} aria-hidden="true" />}
            </button>
        </div>
        {isCollapsed && <div className={styles.sidebarCollapsedActions}>
            <button type="button" className={`${styles.sidebarToggle} ${styles.overviewIconButton}`}
                onClick={onOverview} aria-label={t('story.overview.title')}
                title={t('story.overview.title')} aria-pressed={view === 'overview'}>
                <BookClose_TN size={18} aria-hidden="true" />
            </button>
            <button type="button" className={`${styles.sidebarToggle} ${styles.overviewIconButton}`}
                onClick={onContents} aria-label={t('story.overview.contents')}
                title={t('story.overview.contents')} aria-pressed={view === 'contents'}>
                <ContentsView size={18} aria-hidden="true" />
            </button>
            <ContentAddButton iconOnly onClick={onAddContent}>
                {t('story.files.createTitle')}
            </ContentAddButton>
        </div>}
        <motion.div id={contentId} className={styles.sidebarBody}
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
            <ContentAddButton className={styles.sidebarAddButton} onClick={onAddContent}>
                {t('story.files.createTitle')}
            </ContentAddButton>
            <button type="button" className={styles.contentsNavButton} onClick={onContents} aria-pressed={view === 'contents'}>
                <ContentsView size={20} aria-hidden="true" />
                {t('story.overview.contents')}
            </button>
        </div>
        </motion.div>
    </motion.nav>;
}
