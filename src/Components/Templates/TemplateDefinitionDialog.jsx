import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TN_Button, TN_Dialog } from '../TNDesignSystem';
import TN_Dropdown from '../TNDesignSystem/TN_Dropdown';
import { Plus, Trash2 } from '../../assets/IconList';
import { MultilineField } from '../JSONBox/PropertyEditor';
import { EDITABLE_FIELD_TYPES, SHARED_SCOPES, newField } from './templateModel';
import { TemplateSortContext, SortableTemplate } from './TemplateSorting';
import styles from '../JSONBox/jsonbox.module.css';

export default function TemplateDefinitionDialog({ definition, existing = false, deletionLocked = false, onClose, onSave }) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState(() => structuredClone(definition));
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const privateScope = draft.scope === 'private';
    const changeField = (index, patch) => setDraft(value => ({ ...value, fields: value.fields.map((field, i) => i === index ? { ...field, ...patch } : field) }));
    const valid = draft.name.trim() && draft.fields.length > 0 && draft.fields.every(field => field.label.trim()
        && (field.type !== 'Select' || (field.options.length && field.options.every(option => option.trim()) && new Set(field.options).size === field.options.length)));
    const save = async () => {
        if (!valid || busy) return;
        setBusy(true); setError('');
        try {
            await onSave({ ...draft, name: draft.name.trim(), fields: draft.fields.map(field => ({ ...field, label: field.label.trim() })) });
            onClose();
        } catch (error) { setError(String(error)); }
        finally { setBusy(false); }
    };
    return <TN_Dialog isOpen onClose={() => { if (!busy) onClose(); }} title={t(privateScope ? 'templates.privateTitle' : 'templates.editTitle')} maxWidth="760px">
        <div className={`${styles.workspace} ${styles.definitionEditor}`} onKeyDown={event => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); void save(); }
        }}>
            <section className={styles.definitionMetadata} aria-label={t('templates.basicInfo')}>
            <h3 className={styles.definitionHeading}>{t('templates.basicInfo')}</h3>
            <div className={styles.property}>
                <div className={styles['property-label']}><span className={styles['property-input']}>{t('templates.name')}</span></div>
                <div className={styles['property-value']}><MultilineField autoFocus aria-label={t('templates.name')} placeholder={t('templates.namePlaceholder')} value={draft.name} maxLength={200} onChange={event => setDraft({ ...draft, name: event.target.value })} /></div>
            </div>
            {!privateScope && <div className={styles.property}>
                <div className={styles['property-label']}><span className={styles['property-input']}>{t('templates.scope')}</span></div>
                <div className={styles['property-value']}>{existing ? <span className={styles['property-input']}>{draft.scope}</span> : <TN_Dropdown aria-label={t('templates.scope')} scale={0.8} width="180px" value={draft.scope} onChange={scope => setDraft({ ...draft, scope })} options={SHARED_SCOPES.map(value => ({ value, label: value }))} />}</div>
            </div>}
            {privateScope && <p className={styles['list-empty']}>{t('templates.privateHint')}</p>}
            </section>
            <section className={styles.definitionFields} aria-label={t('templates.fieldSettings')}>
            <div className={styles.definitionSectionHeader}>
                <h3 className={styles.definitionHeading}>{t('templates.fieldSettings')}</h3>
                <span className={styles.definitionCount}>{t('templates.fieldCount', { count: draft.fields.length })}</span>
            </div>
            <TemplateSortContext stack={draft.fields} getId={field => field.id} disabled={busy} onChange={fields => setDraft(value => ({ ...value, fields }))}>
            {draft.fields.map((field, index) => <SortableTemplate key={field.id} id={field.id} name={field.label} disabled={busy} className={styles.property}>
                <div className={styles['property-label']}><MultilineField aria-label={`${t('templates.fieldName')} ${index + 1}`} placeholder={t('templates.fieldName')} value={field.label} maxLength={200} onChange={event => changeField(index, { label: event.target.value })} /></div>
                <div className={styles['property-value']}>
                    <div className={styles.propertyTools}>
                        {EDITABLE_FIELD_TYPES.includes(field.type) && (deletionLocked && definition.fields.some(item => item.id === field.id)
                            ? <span className={styles['property-input']}>{t(`templates.types.${field.type}`)}</span>
                            : <TN_Dropdown aria-label={`${t('templates.fieldType')} ${index + 1}`} scale={0.8} width="180px" value={field.type} onChange={type => changeField(index, { id: crypto.randomUUID(), type })} options={EDITABLE_FIELD_TYPES.map(value => ({ value, label: t(`templates.types.${value}`) }))} />)}
                    </div>
                    {field.type === 'Select' && <label>{t('templates.options')}<textarea className={styles['property-input']} rows={3} value={field.options.join('\n')} onChange={event => changeField(index, { options: event.target.value.split('\n') })} /></label>}
                </div>
                <button type="button" className={`${styles['quiet-action']} ${styles['property-delete']}`} disabled={deletionLocked && definition.fields.some(item => item.id === field.id)} aria-label={`${field.label}: ${t('common.delete')}`} onClick={() => setDraft({ ...draft, fields: draft.fields.filter(item => item.id !== field.id) })}><Trash2 size={15} /></button>
            </SortableTemplate>)}
            </TemplateSortContext>
            <button type="button" className={`${styles['list-add']} ${styles['property-add']}`} disabled={draft.fields.length >= 200} onClick={() => setDraft({ ...draft, fields: [...draft.fields, newField()] })}><Plus size={18} />{t('templates.addField')}</button>
            </section>
            {error && <p role="alert">{error}</p>}
            <div className={styles.definitionFooter}><TN_Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</TN_Button><TN_Button variant="proceed" disabled={!valid || busy} onClick={save}>{t(busy ? 'jsonBox.saving' : 'editor.save')}</TN_Button></div>
        </div>
    </TN_Dialog>;
}
