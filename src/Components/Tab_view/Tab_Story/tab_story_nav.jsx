import { useTranslation } from 'react-i18next';
import { TN_BookCard_Preview } from '../../TNDesignSystem';
import styles from './tab_story.module.css';

export default function TabStoryNav({ story_name, workspace, view, onOverview, onContents }) {
    const { t } = useTranslation();
    return <nav className={styles.sidebar} aria-label={t('story.overview.navigation')}>
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
            <button type="button" className={styles.contentsNavButton} onClick={onContents} aria-pressed={view === 'contents'}>{t('story.overview.contents')}</button>
        </div>
    </nav>;
}
