import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from '../../assets/IconList';
import { useTabStore } from '../../store/tabStore';
import { useFileStore } from '../../store/fileStore';
import { getBookCoverStyle } from '../TNDesignSystem/bookCoverStyle';
import TN_Dialog from '../TNDesignSystem/TN_Dialog';
import AddTabContent from '../Dialog/AddTabContent';
import styles from './TabLauncher.module.css';
import workspaceStyles from './workspace.module.css';

export default function TabLauncher({ contextAnchor = null, onDismiss }) {
    const { t } = useTranslation();
    const [view, setView] = useState(contextAnchor ? 'picker' : null);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const triggerRef = useRef(null);
    const panelRef = useRef(null);
    const inputRef = useRef(null);
    const storyList = useFileStore((state) => state.storyList);
    const fetchStoryList = useFileStore((state) => state.fetchStoryList);
    const { appMode, tabsList, addTab, setTabLauncherOpen } = useTabStore();

    useEffect(() => {
        if (contextAnchor) return;
        const open = (event) => { setQuery(''); setView(event.detail?.view === 'create' ? 'create' : 'picker'); };
        const dismiss = () => setView(null);
        window.addEventListener('open-tab-launcher', open);
        window.addEventListener('close-dialogs', dismiss);
        return () => {
            window.removeEventListener('open-tab-launcher', open);
            window.removeEventListener('close-dialogs', dismiss);
        };
    }, [contextAnchor]);

    useEffect(() => {
        setTabLauncherOpen(view !== null);
        return () => setTabLauncherOpen(false);
    }, [view, setTabLauncherOpen]);

    useEffect(() => {
        if (view !== 'picker') return;
        let cancelled = false;
        setLoading(true);
        setFailed(false);
        fetchStoryList().catch(() => {
            if (!cancelled) setFailed(true);
        }).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => { cancelled = true; };
    }, [view, fetchStoryList]);

    const close = () => {
        setView(null);
        if (contextAnchor) onDismiss?.();
        else triggerRef.current?.focus();
    };

    useLayoutEffect(() => {
        if (view !== 'picker') return;
        const position = () => {
            const anchor = (contextAnchor || triggerRef.current)?.getBoundingClientRect();
            const panel = panelRef.current;
            if (!anchor || !panel) return;
            panel.style.maxHeight = `${window.innerHeight - 16}px`;
            if (contextAnchor) {
                const menu = contextAnchor.closest('#nomal-context-menu').getBoundingClientRect();
                const left = menu.right + panel.offsetWidth <= window.innerWidth - 8
                    ? menu.right : menu.left - panel.offsetWidth;
                panel.style.left = `${Math.max(8, Math.min(left, window.innerWidth - panel.offsetWidth - 8))}px`;
                panel.style.top = `${Math.max(8, Math.min(anchor.top, window.innerHeight - panel.offsetHeight - 8))}px`;
            } else {
                panel.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - panel.offsetWidth - 8))}px`;
                panel.style.top = `${anchor.bottom + 8}px`;
                panel.style.maxHeight = `${Math.max(0, window.innerHeight - anchor.bottom - 16)}px`;
            }
        };
        position();
        window.addEventListener('resize', position);
        return () => window.removeEventListener('resize', position);
    }, [view, contextAnchor, loading, failed, storyList, query]);

    useLayoutEffect(() => {
        if (view !== 'picker') return;
        if (!contextAnchor) inputRef.current?.focus();
        const outside = (event) => {
            if (contextAnchor?.closest('#nomal-context-menu')?.contains(event.target)) return;
            if (!panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setView(null);
        };
        const escape = (event) => {
            if (event.key === 'Escape' && !event.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                close();
            }
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('focusin', outside);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('focusin', outside);
            document.removeEventListener('keydown', escape);
        };
    }, [view, contextAnchor]);

    const normalizedQuery = query.trim().toLocaleLowerCase();
    const stories = storyList.filter((story) => story.story_name.toLocaleLowerCase().includes(normalizedQuery))
        .sort((a, b) => (b.last_update ?? 0) - (a.last_update ?? 0)
            || a.story_name.localeCompare(b.story_name));
    const visibleStories = normalizedQuery ? stories : stories.slice(0, 3);
    const openStory = (name) => {
        addTab('story', name, { story_name: name });
        close();
    };

    return <>
        {!contextAnchor && <button ref={triggerRef} type="button" className={workspaceStyles.add_btn}
            style={{ display: appMode === 'workspace' ? undefined : 'none' }}
            title={t('tabLauncher.title')} aria-label={t('tabLauncher.title')}
            aria-expanded={view === 'picker'} aria-haspopup="dialog"
            aria-controls={view === 'picker' ? 'tab-launcher' : undefined}
            onClick={() => { setQuery(''); setView(view === 'picker' ? null : 'picker'); }}>
            <Plus size={18} />
        </button>}
        {view === 'picker' && createPortal(
            <div ref={panelRef} id="tab-launcher" role="dialog" aria-label={t('tabLauncher.title')}
                className={`${styles.panel} ${contextAnchor ? styles.contextPanel : ''}`} onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
                    const elements = [...panelRef.current.querySelectorAll('button, input')];
                    const index = elements.indexOf(document.activeElement);
                    event.preventDefault();
                    elements[(index + (event.key === 'ArrowDown' ? 1 : -1) + elements.length) % elements.length]?.focus();
                }}>
                <button type="button" className={styles.action} onClick={() => { addTab('search', 'Search'); close(); }}>
                    <Search size={18} /><span>{t('tabLauncher.search')}</span>
                </button>
                <div className={styles.divider} />
                <div className={styles.searchField}>
                    <Search size={16} aria-hidden="true" />
                    <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('tabLauncher.placeholder')} aria-label={t('tabLauncher.placeholder')}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.nativeEvent.isComposing && visibleStories.length) {
                                event.preventDefault();
                                openStory(visibleStories[0].story_name);
                            }
                        }} />
                </div>
                <div className={styles.caption}>{t(normalizedQuery ? 'tabLauncher.results' : 'tabLauncher.recent')}</div>
                <div className={styles.stories} aria-busy={loading}>
                    {visibleStories.map((story) => {
                        const isOpen = tabsList.some((tab) => tab.type === 'story' && tab.props.story_name === story.story_name);
                        return <button type="button" key={story.story_name} className={styles.action} title={story.story_name}
                            onClick={() => openStory(story.story_name)}>
                            <span className={styles.cover} style={getBookCoverStyle(story.cover)} aria-hidden="true" />
                            <span className={styles.storyName}>{story.story_name}</span>
                            {isOpen && <span className={styles.badge}>{t('tabLauncher.open')}</span>}
                        </button>;
                    })}
                    {(failed || !visibleStories.length) && <p className={styles.empty} role="status">
                        {t(failed ? 'tabLauncher.failed' : loading ? 'tabLauncher.loading' : normalizedQuery ? 'library.noResults' : 'library.empty')}
                    </p>}
                </div>
                <div className={styles.divider} />
                <button type="button" className={styles.action} onClick={() => {
                    if (contextAnchor) {
                        window.dispatchEvent(new CustomEvent('open-tab-launcher', { detail: { view: 'create' } }));
                        close();
                    } else setView('create');
                }}>
                    <Plus size={18} /><span>{t('tabLauncher.create')}</span>
                </button>
            </div>, contextAnchor?.closest('#nomal-context-menu') || document.body)}
        <TN_Dialog isOpen={view === 'create'} onClose={close} title={t('library.addStory')}>
            <AddTabContent onComplete={close} />
        </TN_Dialog>
    </>;
}
