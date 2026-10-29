import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useId, useRef } from 'react';
import { Save, User, Map as MapIcon, Entity, PanelOpen, PanelClose } from '../../assets/IconList';
import TN_Toggle from '../TNDesignSystem/TN_Toggle';
import { validProperties } from './propertyTypes.js';
import TemplateStackEditor from '../Templates/TemplateStackEditor';
import { TemplateSortContext, SortableTemplate } from '../Templates/TemplateSorting';
import { validStack, newDefinition, newField } from '../Templates/templateModel';
import base from '../TextBox/textbox.module.css';
import styles from './jsonbox.module.css';
import CharacterPhoto from '../../assets/CharacterPhoto.jsx';
import WorldPhoto from '../../assets/WorldPhoto.jsx';
import EntityPhoto from '../../assets/EntityPhoto.jsx';
import ObjectImagesDialog from '../Dialog/ObjectImagesDialog.jsx';
import { photoPaths, validImagePaths } from '../../utils/imagePaths.js';
// Match visual weight across portrait, landscape, and square-ish frames.
const PHOTO_AREA = 36000;
const PHOTO_ASPECT_RATIOS = { character: 311 / 489, world: 499 / 388, entity: 411 / 472 };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function readPage(value) {
    if (!object(value)) return null;
    const structured = Object.hasOwn(value, 'properties');
    if ((structured && !validProperties(value.properties)) || (value.summary !== undefined && typeof value.summary !== 'string') || (value.imagePaths !== undefined && !validImagePaths(value.imagePaths)) || (value.templateStack !== undefined && !validStack(value.templateStack))) return null;
    return { structured, properties: structured ? value.properties : Object.fromEntries(Object.entries(value).filter(([key, item]) => !['name', 'notes', 'summary', 'imagePaths', 'templateStack', 'originalAttributesIndex'].includes(key) && validProperties({ value: item }))), summary: value.summary || '', imagePaths: photoPaths(value.imagePaths), templateStack: value.templateStack ?? [] };
}
export default function JSONBox({ workspaceId, title, content, contentType, onChangeContent, onRename, isSaved, onSaveClick }) {
    const { t } = useTranslation();
    const ContentIcon = { character: User, world: MapIcon, entity: Entity }[contentType];
    const Photo = { character: CharacterPhoto, world: WorldPhoto, entity: EntityPhoto }[contentType];
    const photoAspectRatio = PHOTO_ASPECT_RATIOS[contentType] ?? 1;
    const photoWidth = Math.sqrt(PHOTO_AREA * photoAspectRatio);
    const photoHeight = photoWidth / photoAspectRatio;
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [renamingTitle, setRenamingTitle] = useState(false);
    const titlePending = useRef(false);
    const confirmedTitle = useRef(title);
    confirmedTitle.current = title;
    const [menuOpen, setMenuOpen] = useState(true);
    const [imagesDialogWorkspace, setImagesDialogWorkspace] = useState(null);
    const [lockState, setLockState] = useState({ workspaceId, locked: true });
    const deletionLocked = lockState.workspaceId !== workspaceId || lockState.locked;
    const menuId = useId();
    const legacyMigration = useRef(null);
    const templateSections = useRef(new Map());
    const navigate = ref => {
        ref.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
        ref.current?.focus({ preventScroll: true });
    };

    let parsed;
    try { parsed = JSON.parse(content); } catch { /* Unsupported files remain read-only. */ }
    const page = readPage(parsed);
    if (page && Object.keys(page.properties).length) {
        const signature = JSON.stringify([workspaceId, page.properties]);
        if (legacyMigration.current?.signature !== signature) {
            const entries = [];
            const properties = Object.entries(page.properties);
            for (let offset = 0; offset < properties.length; offset += 200) {
                const definition = newDefinition('private');
                definition.name = t('templates.legacyMemo') + (offset ? ` ${offset / 200 + 1}` : '');
                const values = {};
                definition.fields = properties.slice(offset, offset + 200).map(([label, value]) => {
                    const field = { ...newField(), label, type: Array.isArray(value) ? 'StringList' : 'String' };
                    values[field.id] = value;
                    return field;
                });
                entries.push({ definition, values });
            }
            legacyMigration.current = { signature, entries };
        }
        const index = Number.isInteger(parsed.originalAttributesIndex) ? Math.max(0, Math.min(page.templateStack.length, parsed.originalAttributesIndex)) : page.templateStack.length;
        page.templateStack = [...page.templateStack.slice(0, index), ...legacyMigration.current.entries, ...page.templateStack.slice(index)];
    }
    const needsMigration = page && (Object.hasOwn(parsed, 'properties') || Object.hasOwn(parsed, 'originalAttributesIndex') || Object.keys(page.properties).length > 0);
    const update = patch => {
        const next = { ...parsed, templateStack: page.templateStack, ...patch };
        delete next.properties;
        delete next.originalAttributesIndex;
        if (!page.structured) Object.keys(page.properties).forEach(key => { delete next[key]; });
        setError(''); onChangeContent(JSON.stringify(next, null, 2));
    };
    const save = async () => {
        if (!page || busy) return;
        setBusy(true); setError('');
        try { if (needsMigration) update({}); await onSaveClick(); } catch (e) { setError(String(e)); }
        finally { setBusy(false); }
    };
    return <div className={`${base.container} ${styles.workspace}`} onKeyDown={e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopPropagation(); void save(); }
    }}><div className={base.toolbar}><button type="button" className={styles.menuToggle} aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'} aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <PanelClose size={18} aria-hidden="true" /> : <PanelOpen size={18} aria-hidden="true" />}</button><div className={base.toolbarRight}><button type="button" className={`${base.saveStatus} ${isSaved ? base.saved : base.unsaved}`} disabled={!page || busy} onClick={save}><Save size={16} />{t(busy ? 'jsonBox.saving' : isSaved ? 'editor.saved' : 'editor.unsaved')}</button></div></div>
    <div className={styles.editorLayout} data-menu-open={menuOpen}>
    <div className={styles.menuShell} inert={!menuOpen} aria-hidden={!menuOpen}>
    <nav id={menuId} className={styles.sideMenu} aria-label="設定資料メニュー">
        <span className={styles.menuHeading}>この資料</span>
        {page && (() => {
            const sections = page.templateStack.map(({ definition }) => ({ id: definition.id, name: definition.name, count: definition.fields.length }));
            return <TemplateSortContext stack={page.templateStack} onChange={templateStack => update({ templateStack })}>{sections.map((section, index) => <SortableTemplate key={section.id} id={section.id} name={section.name} sidebar onNavigate={() => navigate({ current: templateSections.current.get(section.id) })}>
                <span className={styles.menuNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{section.name}<span className={styles.menuCount}>{section.count}</span>
            </SortableTemplate>)}</TemplateSortContext>;
        })()}
        <div className={styles.menuDivider} />
        <div className={styles.lockControl}><span className={styles.lockLabel}>削除ロック</span><TN_Toggle isOn={deletionLocked} onToggle={() => setLockState({ workspaceId, locked: !deletionLocked })} aria-label="属性とリスト項目の削除をロック" scale={0.55} /><small>{deletionLocked ? '削除を防いでいます' : '削除できます'}</small></div>
        <div className={styles.menuDivider} />
        <button type="button" className={styles.menuItem} disabled={!page || busy} onClick={save}><Save size={15} aria-hidden="true" />{t(busy ? 'jsonBox.saving' : 'editor.save', { defaultValue: '保存' })}</button>
    </nav></div>
    <div className={styles.body}><div className={`${base.contentWrapper} ${styles.documentFrame}`} data-locked={deletionLocked}><article className={styles.document}>
    <div className={styles.overviewRow}>
    <div className={styles.overviewFields}>
    <div className={styles.titleRow}>
    {ContentIcon && <ContentIcon size={32} className={styles.characterIcon} aria-hidden="true" />}
    <input key={`${workspaceId}/${title}`} className={styles.title} aria-label={t('editor.titlePlaceholder')} defaultValue={title} readOnly={renamingTitle} onBlur={async e => {
        if (titlePending.current) return;
        const input = e.currentTarget;
        const next = input.value.trim();
        if (!next || next === title) { input.value = title; return; }
        titlePending.current = true;
        setRenamingTitle(true);
        setError('');
        try {
            await onRename(next);
            input.value = next;
        } catch (error) {
            input.value = confirmedTitle.current;
            setError(error instanceof Error ? error.message : String(error));
        } finally {
            titlePending.current = false;
            setRenamingTitle(false);
        }
    }} onKeyDown={e => {
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { e.currentTarget.value = title; e.currentTarget.blur(); }
    }} />
    </div>
    {page && <section className={styles.summarySection}>
        <div className={styles['section-heading']}><h2>概要</h2></div>
        <textarea rows={1} className={styles.summary} aria-label="概要" placeholder="概要をひとこと…" value={page.summary} onChange={e => update({ summary: e.target.value })} />
    </section>}
    </div>
    {page && Photo && <div className={styles.photoRow} style={{ '--photo-width': `${photoWidth}px` }}><Photo key={workspaceId} name={title} imagePaths={page.imagePaths}
        height={photoHeight} width={photoWidth}
        onClick={() => setImagesDialogWorkspace(workspaceId)} ariaLabel={t('objectImages.open', { name: title })} /></div>}
    </div>
    {page ? <>
    <TemplateStackEditor key={workspaceId} stack={page.templateStack} contentType={contentType} deletionLocked={deletionLocked} onSectionRef={(id, node) => { if (node) templateSections.current.set(id, node); else templateSections.current.delete(id); }} onChange={templateStack => update({ templateStack })} /></> : <p role="alert">{t('jsonBox.unavailable')}</p>}
    {error && <div role="alert">{error}</div>}
    </article></div></div></div>
    {page && imagesDialogWorkspace === workspaceId && <ObjectImagesDialog key={workspaceId} name={title} imagePaths={page.imagePaths}
        onClose={() => setImagesDialogWorkspace(null)} onApply={async imagePaths => {
            if (!validImagePaths(imagePaths)) throw new Error(t('objectImages.limit', { max: 3 }));
            update({ imagePaths });
            await onSaveClick();
        }} />}
    </div>;
}



