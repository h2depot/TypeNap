import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownWideNarrow, ArrowUpWideNarrow, EllipsisVertical, PageSearch, Plus } from '../../../assets/IconList';
import { TN_Button, TN_Dialog, TN_Dropdown, TN_IconButton, TN_ListItem, TN_ListView, TN_Menu, TN_TextField } from '../../TNDesignSystem';
import { useTemplateStore } from '../../../store/templateStore';
import TemplateDefinitionDialog from '../../Templates/TemplateDefinitionDialog';
import { newDefinition, SHARED_SCOPES } from '../../Templates/templateModel';
import templateStyles from '../../Templates/templates.module.css';
import styles from './TemplateView.module.css';

export default function TemplateView() {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [ascending, setAscending] = useState(true);
    const [scope, setScope] = useState('all');
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [history, setHistory] = useState(null);
    const [historyTarget, setHistoryTarget] = useState(null);
    const [selectedBackup, setSelectedBackup] = useState('');
    const { templates, refresh, save, remove, backups, restore, loading, error: loadError } = useTemplateStore();
    const backup = history?.find(item => `${item.id}/${item.revision}` === selectedBackup);
    useEffect(() => { void refresh().catch(() => {}); }, [refresh]);
    const visible = templates.filter(item => (scope === 'all' || item.scope === scope) && item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
        .sort((a, b) => (ascending ? 1 : -1) * (sortBy === 'name' ? a.name.localeCompare(b.name) : (sortBy === 'updated' ? a.updatedAt - b.updatedAt : a.createdAt - b.createdAt)));
    const perform = async action => {
        if (busy) return;
        setBusy(true); setError('');
        try { await action(); } catch (error) { setError(String(error)); }
        finally { setBusy(false); }
    };
    const openHistory = (definition = null) => perform(async () => {
        await refresh();
        const entries = await backups();
        setHistory(definition ? entries.filter(item => item.id === definition.id) : entries);
        setHistoryTarget(definition);
        setSelectedBackup('');
    });

    return (
        <div className={styles.container}>
            <div className={styles.controls}>
                <div className={styles.search}>
                    <TN_TextField
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder={t('templateLibrary.searchPlaceholder')}
                        aria-label={t('templateLibrary.searchPlaceholder')}
                        icon={<PageSearch size={18} />}
                        borderRadius="10px"
                    />
                </div>
                <div className={styles.rightControls}>
                    <TN_Dropdown value={scope} onChange={setScope} aria-label={t('templates.scope')} options={[{ value: 'all', label: t('templates.allScopes') }, ...SHARED_SCOPES.map(value => ({ value, label: value }))]} />
                    <TN_Dropdown
                        value={sortBy}
                        onChange={setSortBy}
                        aria-label={t('library.sort.placeholder')}
                        options={[
                            { value: 'name', label: t('templateLibrary.sortName') },
                            { value: 'updated', label: t('library.sort.updated') },
                            { value: 'created', label: t('library.sort.created') },
                        ]}
                    />
                    <TN_IconButton
                        icon={ascending ? <ArrowUpWideNarrow size={20} /> : <ArrowDownWideNarrow size={20} />}
                        onClick={() => setAscending(value => !value)}
                        variant="secondary"
                        aria-label={t(ascending ? 'library.sort.ascending' : 'library.sort.descending')}
                    />
                </div>
            </div>
            <div className={styles.actionRow}>
                <TN_Button variant="proceed" borderRadius="10px" onClick={() => setEditing(newDefinition(scope === 'all' ? 'character' : scope))}><Plus size={18} aria-hidden="true" />{t('templateLibrary.create')}</TN_Button>
            </div>
            {(loadError || error) && <p role="alert">{loadError || error} {loadError && <button type="button" onClick={() => { void refresh().catch(() => {}); }}>{t('templates.refresh')}</button>}</p>}
            {!loading && visible.length === 0 && <p className={templateStyles.muted}>{t('templates.empty')}</p>}
            <TN_ListView maxWidth="100%">
            {visible.map(definition => <TN_ListItem key={definition.id}
                title={definition.name}
                description={`${definition.scope} · v${definition.revision} · ${t('templates.fieldCount', { count: definition.fields.length })}`}
                disabled={busy}
                onClick={() => setEditing(definition)}
                tabIndex={busy ? -1 : 0}
                onKeyDown={event => {
                    if (!busy && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault(); setEditing(definition);
                    }
                }}
                control={<TN_Menu
                    trigger={<button type="button" className={styles.rowMenuButton} disabled={busy} aria-label={t('templates.actions', { name: definition.name })}><EllipsisVertical size={20} /></button>}
                    items={[
                        { label: t('templates.edit'), onClick: () => setEditing(definition) },
                        { label: t('story.actions.restoreBackup'), onClick: () => openHistory(definition) },
                        { label: t('common.delete'), isDanger: true, onClick: () => setDeleting(definition) },
                    ]}
                />}
            />)}
            </TN_ListView>
            {editing && <TemplateDefinitionDialog key={editing.id} definition={editing} existing={templates.some(item => item.id === editing.id)} onClose={() => setEditing(null)} onSave={save} />}
            <TN_Dialog isOpen={history !== null} onClose={() => { if (!busy) setHistory(null); }} title={historyTarget ? `${historyTarget.name} · ${t('story.actions.restoreBackup')}` : t('templateLibrary.backups')}>
                <p>{t('templateLibrary.restoreHint')}</p>
                {history?.length ? <TN_Dropdown aria-label={t('templateLibrary.backups')} value={selectedBackup} onChange={setSelectedBackup} width="100%" placeholder={t('templates.choose')}
                    options={history.map(item => ({ value: `${item.id}/${item.revision}`, label: `${item.name} · ${item.scope} · v${item.revision} · ${new Date(item.updatedAt * 1000).toLocaleString()}` }))} /> : <p>{t('templateLibrary.noBackups')}</p>}
                {backup && <ul>{backup.fields.map(field => <li key={field.id}>{field.label} · {field.type}</li>)}</ul>}
                {error && <p role="alert">{error}</p>}
                <div className={templateStyles.actions}>
                    <TN_Button variant="secondary" disabled={busy} onClick={() => setHistory(null)}>{t('common.cancel')}</TN_Button>
                    <TN_Button variant="proceed" disabled={busy || !backup} onClick={() => perform(async () => {
                        await restore(backup, templates.find(item => item.id === backup.id)?.revision ?? null);
                        setHistory(null);
                    })}>{t('templateLibrary.restore')}</TN_Button>
                </div>
            </TN_Dialog>
            <TN_Dialog isOpen={Boolean(deleting)} onClose={() => { if (!busy) setDeleting(null); }} title={t('common.deleteConfirmation')}>
                <p>{t('templates.deleteMessage', { name: deleting?.name })}</p>
                <div className={templateStyles.actions}><TN_Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>{t('common.cancel')}</TN_Button><TN_Button variant="danger" disabled={busy} onClick={() => perform(async () => { await remove(deleting.id); setDeleting(null); })}>{t('common.delete')}</TN_Button></div>
                {error && <p role="alert">{error}</p>}
            </TN_Dialog>
        </div>
    );
}
