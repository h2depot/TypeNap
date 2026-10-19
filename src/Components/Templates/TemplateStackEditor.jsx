import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EllipsisVertical, Plus, Trash2, X } from '../../assets/IconList';
import { TN_Button, TN_Dialog, TN_Dropdown, TN_Menu } from '../TNDesignSystem';
import { MultilineField, PropertySection, StringList } from '../JSONBox/PropertyEditor';
import { useTemplateStore } from '../../store/templateStore';
import TemplateDefinitionDialog from './TemplateDefinitionDialog';
import { EDITABLE_FIELD_TYPES, newDefinition, newField, makeEntry, moveEntry, updateEntry, editEntry, hasTemplateUpdate } from './templateModel';
import styles from '../JSONBox/jsonbox.module.css';
import { TemplateSortContext, SortableTemplate } from './TemplateSorting';

export function TemplateFieldInput({ field, value, onChange, deletionLocked }) {
    const { t } = useTranslation();
    const label = `${field.label}の値`;
    if (field.type === 'StringList') return <StringList name={field.label} values={value ?? []} deletionLocked={deletionLocked} onChange={onChange} />;
    // Existing files can still contain the earlier field types.
    if (field.type === 'Boolean') return <TN_Dropdown aria-label={label} scale={0.8} width="180px" value={value === undefined || value === null ? '' : String(value)} onChange={value => onChange(value === '' ? null : value === 'true')}
        options={[{ value: '', label: t('templates.unset') }, { value: 'true', label: t('templates.yes') }, { value: 'false', label: t('templates.no') }]} />;
    if (field.type === 'Select') return <TN_Dropdown aria-label={label} scale={0.8} width="180px" value={value ?? ''} onChange={onChange}
        options={[{ value: '', label: t('templates.unset') }, ...field.options.map(value => ({ value, label: value }))]} />;
    if (field.type === 'Number') return <input className={styles['property-input']} aria-label={label} type="number" step="any" placeholder="未設定" value={value ?? ''} onChange={event => {
        const number = event.target.valueAsNumber;
        if (event.target.value === '') onChange(null);
        else if (Number.isFinite(number)) onChange(number);
    }} />;
    return <MultilineField aria-label={label} placeholder="未設定" value={value ?? ''} onChange={event => onChange(event.target.value)} />;
}

export function PrivateFieldName({ field, fields, onRename }) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState(field.label);
    const [error, setError] = useState('');
    useEffect(() => { setDraft(field.label); setError(''); }, [field.label]);
    const commit = () => {
        const label = draft.trim();
        if (!label || fields.some(item => item.id !== field.id && item.label === label)) {
            setDraft(field.label);
            setError(t(!label ? 'templates.fieldNameRequired' : 'templates.duplicateFieldName'));
            return;
        }
        setDraft(label); setError('');
        if (label !== field.label) onRename(label);
    };
    return <>
        <MultilineField aria-label={t('templates.renameField', { name: field.label })} maxLength={200} value={draft} aria-invalid={Boolean(error)}
            onChange={event => { setDraft(event.target.value); setError(''); }} onBlur={commit}
            onKeyDown={event => {
                if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') commit();
                if (event.key === 'Escape') { event.preventDefault(); setDraft(field.label); setError(''); }
            }} />
        {error && <small role="alert" className={styles.fieldError}>{error}</small>}
    </>;
}

export function TemplateSection({ entry, menuItems, onChange, deletionLocked }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(true);
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [type, setType] = useState('String');
    const definition = entry.definition;
    const privateScope = definition.scope === 'private';
    const trimmed = name.trim();
    const duplicate = definition.fields.some(field => field.label === trimmed);
    const changeFields = fields => onChange(editEntry(entry, { ...definition, fields }));
    return <PropertySection title={definition.name} count={definition.fields.length} expanded={expanded} onToggle={() => setExpanded(open => !open)}
        actions={menuItems.length > 0 && <TN_Menu trigger={<button type="button" className={styles['quiet-action']} aria-label={t('templates.actions', { name: definition.name })}><EllipsisVertical size={16} /></button>} items={menuItems} />}>
        {definition.fields.map(field => <div className={styles.property} key={field.id}>
            <div className={styles['property-label']}><PrivateFieldName field={field} fields={definition.fields} onRename={label => changeFields(definition.fields.map(item => item.id === field.id ? { ...item, label } : item))} /></div>
            <div className={styles['property-value']}><TemplateFieldInput field={field} value={entry.values[field.id]} deletionLocked={deletionLocked}
                onChange={value => onChange({ ...entry, values: { ...entry.values, [field.id]: value } })} /></div>
            {privateScope && !deletionLocked && <button type="button" className={`${styles['quiet-action']} ${styles.fieldDelete}`} aria-label={t('templates.deleteField', { name: field.label })} onClick={() => {
                if (!deletionLocked) changeFields(definition.fields.filter(item => item.id !== field.id));
            }}><Trash2 size={15} /></button>}
        </div>)}
        <div className={styles.inlineFieldArea}>
            {creating ? <form className={styles.inlineFieldForm} onSubmit={event => {
                event.preventDefault();
                if (!trimmed || duplicate || definition.fields.length >= 200) return;
                changeFields([...definition.fields, { ...newField(), label: trimmed, type }]);
                setName(''); setCreating(false);
            }}>
                <MultilineField autoFocus aria-label={t('templates.newFieldName')} placeholder={t('templates.fieldName')} maxLength={200} value={name} aria-invalid={duplicate} onChange={event => setName(event.target.value)} onKeyDown={event => {
                    if (event.nativeEvent.isComposing || event.keyCode === 229 || event.key !== 'Enter') return;
                    event.preventDefault(); event.currentTarget.form?.requestSubmit();
                }} />
                <TN_Dropdown aria-label={t('templates.fieldType')} scale={0.8} width="180px" value={type} onChange={setType} options={EDITABLE_FIELD_TYPES.map(value => ({ value, label: t(`templates.types.${value}`) }))} />
                <button type="submit" className={styles['list-add']} disabled={!trimmed || duplicate || definition.fields.length >= 200}><Plus size={14} />{t('templates.add')}</button>
                <button type="button" className={styles['quiet-action']} aria-label={t('common.cancel')} onClick={() => { setCreating(false); setName(''); }}><X size={14} /></button>
                {duplicate && <small role="alert" className={styles.fieldError}>{t('templates.duplicateFieldName')}</small>}
            </form> : <button type="button" className={styles['list-add']} disabled={definition.fields.length >= 200} onClick={() => setCreating(true)}><Plus size={14} />{t('templates.addField')}</button>}
        </div>
        {Object.keys(entry.retiredValues ?? {}).length > 0 && <p className={styles['list-empty']}>{t('templates.retiredHint')}</p>}
    </PropertySection>;
}

export default function TemplateStackEditor({ stack, contentType, onChange, deletionLocked, onSectionRef }) {
    const { t } = useTranslation();
    const { templates, refresh, error } = useTemplateStore();
    const [adding, setAdding] = useState(null);
    const [editing, setEditing] = useState(null);
    const [insertion, setInsertion] = useState(null);
    const [removing, setRemoving] = useState(null);
    useEffect(() => { void refresh().catch(() => {}); }, [refresh]);
    const available = templates.filter(item => item.scope === contentType && !stack.some(entry => entry.definition.id === item.id));
    const replace = (id, entry) => onChange(stack.map(item => item.definition.id === id ? entry : item));
    const insert = (definition, position) => {
        if (stack.length >= 100) throw new Error(t('templates.limitReached'));
        const next = [...stack];
        next.splice(position.index, 0, makeEntry(definition));
        onChange(next);
    };
    const boundary = (index, key) => {
        const position = { index, key };
        const active = adding?.key === key;
        return <div className={styles.insertZone} key={key} data-open={active || undefined}>
            <div className={styles.insertLine} role="group" aria-label={t('templates.insertHere')}>
                <button type="button" disabled={stack.length >= 100} onClick={() => { setAdding(active ? null : position); }} aria-expanded={active}><Plus size={12} />{t('templates.insertShared')}</button>
                <button type="button" disabled={stack.length >= 100} onClick={() => { setAdding(null); setInsertion(position); setEditing(newDefinition('private')); }}><Plus size={12} />{t('templates.insertPrivate')}</button>
            </div>
            {active && <div className={styles.insertPicker}>
                <TN_Dropdown aria-label={t('templates.choose')} value="" onChange={id => {
                    const definition = available.find(item => item.id === id);
                    if (!definition || stack.length >= 100) return;
                    insert(definition, position);
                    setAdding(null);
                }} placeholder={t('templates.choose')} scale={0.8} width="240px" options={available.map(item => ({ value: item.id, label: item.name }))} />
                <button type="button" className={styles['quiet-action']} aria-label={t('common.cancel')} onClick={() => setAdding(null)}><X size={16} /></button>
                {!available.length && <span className={styles['list-empty']}>{t('templates.noAvailable')}</span>}
            </div>}
        </div>;
    };
    return <TemplateSortContext stack={stack} onChange={onChange}><div className={styles.notebookSections}>
        {stack.map((entry, index) => {
            const definition = entry.definition;
            const latest = definition.scope !== 'private' && templates.find(item => item.id === definition.id);
            const menuItems = [
                ...(index > 0 ? [{ label: t('templates.moveUp'), onClick: () => onChange(moveEntry(stack, index, -1)) }] : []),
                ...(index < stack.length - 1 ? [{ label: t('templates.moveDown'), onClick: () => onChange(moveEntry(stack, index, 1)) }] : []),
                { label: t('templates.edit'), onClick: () => setEditing(definition) },
                ...(hasTemplateUpdate(entry, latest) ? [{ label: t('templates.update', { revision: latest.revision }), onClick: () => replace(definition.id, updateEntry(entry, latest)) }] : []),
                ...(!deletionLocked ? [{ label: t('templates.remove'), isDanger: true, onClick: () => setRemoving(definition.id) }] : []),
            ];
            return <Fragment key={definition.id}>
                {boundary(index, definition.id)}
                <SortableTemplate id={definition.id} name={definition.name} onSectionRef={onSectionRef}>
                    <TemplateSection entry={entry} menuItems={menuItems} deletionLocked={deletionLocked} onChange={next => replace(definition.id, next)} />
                </SortableTemplate></Fragment>;
        })}
        {boundary(stack.length, "end")}
        <TN_Dialog isOpen={Boolean(removing) && !deletionLocked && stack.some(entry => entry.definition.id === removing)} onClose={() => setRemoving(null)} title={t('common.deleteConfirmation')}>
            <p>{t('templates.removeConfirm', { name: stack.find(entry => entry.definition.id === removing)?.definition.name })}</p>
            <div className={styles.definitionFooter}>
                <TN_Button variant="secondary" onClick={() => setRemoving(null)}>{t('common.cancel')}</TN_Button>
                <TN_Button variant="danger" disabled={deletionLocked} onClick={() => {
                    if (deletionLocked || !stack.some(entry => entry.definition.id === removing)) return;
                    onChange(stack.filter(entry => entry.definition.id !== removing)); setRemoving(null);
                }}>{t('common.delete')}</TN_Button>
            </div>
        </TN_Dialog>
        {error && <p role="alert">{error} <button type="button" className={styles['list-add']} onClick={() => { void refresh().catch(() => {}); }}>{t('templates.refresh')}</button></p>}
        {editing && <TemplateDefinitionDialog key={editing.id} definition={editing} existing={stack.some(entry => entry.definition.id === editing.id)} deletionLocked={deletionLocked || editing.scope !== 'private'} onClose={() => { setEditing(null); setInsertion(null); }} onSave={async definition => {
            const previous = stack.find(entry => entry.definition.id === definition.id);
            if (previous) replace(definition.id, editEntry(previous, definition));
            else insert(definition, insertion);
        }} />}
    </div></TemplateSortContext>;
}
