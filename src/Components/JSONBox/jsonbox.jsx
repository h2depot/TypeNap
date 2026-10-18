import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useId, useRef } from 'react';
import { Save, User, Map, Entity, PanelOpen, PanelClose } from '../../assets/IconList';
import TN_Toggle from '../TNDesignSystem/TN_Toggle';
import PropertyEditor from './PropertyEditor.jsx';
import { validProperties } from './propertyTypes.js';
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
    if ((structured && !validProperties(value.properties)) || (value.summary !== undefined && typeof value.summary !== 'string') || (value.imagePaths !== undefined && !validImagePaths(value.imagePaths))) return null;
    return { structured, properties: structured ? value.properties : Object.fromEntries(Object.entries(value).filter(([key, item]) => !['name', 'notes', 'summary', 'imagePaths'].includes(key) && validProperties({ value: item }))), summary: value.summary || '', imagePaths: photoPaths(value.imagePaths) };
}
export default function JSONBox({ workspaceId, title, content, contentType, onChangeContent, onRename, isSaved, onSaveClick }) {
    const { t } = useTranslation();
    const ContentIcon = { character: User, world: Map, entity: Entity }[contentType];
    const Photo = { character: CharacterPhoto, world: WorldPhoto, entity: EntityPhoto }[contentType];
    const photoAspectRatio = PHOTO_ASPECT_RATIOS[contentType] ?? 1;
    const photoWidth = Math.sqrt(PHOTO_AREA * photoAspectRatio);
    const photoHeight = photoWidth / photoAspectRatio;
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [menuOpen, setMenuOpen] = useState(true);
    const [imagesDialogWorkspace, setImagesDialogWorkspace] = useState(null);
    const [lockState, setLockState] = useState({ workspaceId, locked: true });
    const deletionLocked = lockState.workspaceId !== workspaceId || lockState.locked;
    const menuId = useId();
    const propertiesRef = useRef(null);
    const navigate = ref => {
        ref.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
        ref.current?.focus({ preventScroll: true });
    };

    let parsed;
    try { parsed = JSON.parse(content); } catch { /* Unsupported files remain read-only. */ }
    const page = readPage(parsed);
    const update = patch => {
        let next = { ...parsed };
        if (page.structured) next = { ...next, ...patch };
        else {
            if (Object.hasOwn(patch, 'summary')) next.summary = patch.summary;
            if (Object.hasOwn(patch, 'imagePaths')) next.imagePaths = patch.imagePaths;
            if (patch.properties) {
                Object.keys(page.properties).forEach(key => { delete next[key]; });
                next = { ...next, ...patch.properties };
            }

        }
        setError(''); onChangeContent(JSON.stringify(next, null, 2));
    };
    const save = async () => {
        if (!page || busy) return;
        setBusy(true); setError('');
        try { await onSaveClick(); } catch (e) { setError(String(e)); }
        finally { setBusy(false); }
    };
    return <div className={`${base.container} ${styles.workspace}`} onKeyDown={e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopPropagation(); void save(); }
    }}><div className={base.toolbar}><button type="button" className={styles.menuToggle} aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'} aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <PanelClose size={18} aria-hidden="true" /> : <PanelOpen size={18} aria-hidden="true" />}</button><div className={base.toolbarRight}><button type="button" className={`${base.saveStatus} ${isSaved ? base.saved : base.unsaved}`} disabled={!page || busy} onClick={save}><Save size={16} />{t(busy ? 'jsonBox.saving' : isSaved ? 'editor.saved' : 'editor.unsaved')}</button></div></div>
    <div className={styles.editorLayout} data-menu-open={menuOpen}>
    <div className={styles.menuShell} inert={!menuOpen} aria-hidden={!menuOpen}>
    <nav id={menuId} className={styles.sideMenu} aria-label="設定資料メニュー">
        <span className={styles.menuHeading}>この資料</span>
        <button type="button" className={styles.menuItem} disabled={!page} onClick={() => navigate(propertiesRef)}><span className={styles.menuNumber} aria-hidden="true">01</span>オリジナル属性{page && <span className={styles.menuCount}>{Object.keys(page.properties).length}</span>}</button>
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
    <input key={`${workspaceId}/${title}`} className={styles.title} aria-label={t('editor.titlePlaceholder')} defaultValue={title} onBlur={async e => {
        const next = e.target.value.trim();
        if (!next) { e.target.value = title; return; }
        if (next !== title) { try { await onRename(next); } catch (e) { setError(String(e)); } }
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
    <div ref={propertiesRef} tabIndex={-1} className={styles.propertiesTarget} aria-label="オリジナル属性"><PropertyEditor key={workspaceId} deletionLocked={deletionLocked} properties={page.properties} reservedNames={page.structured ? [] : Object.keys(parsed).filter(key => !Object.hasOwn(page.properties, key)).concat(['properties', 'name', 'notes', 'summary', 'imagePaths'])} onChange={properties => update({ properties })} /></div></> : <p role="alert">{t('jsonBox.unavailable')}</p>}
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



