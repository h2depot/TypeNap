import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TN_Button, TN_Dropdown } from '../TNDesignSystem';
import { X } from '../../assets/IconList';
import { useTemplateStore } from '../../store/templateStore';
import { TemplateSortContext } from './TemplateSorting';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './templates.module.css';

const selectedId = id => id;

export function TemplatePickerRow({ id, index, name, selected, onChange, disabled }) {
    const { t } = useTranslation();
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
    const suppressClick = useRef(false);
    if (isDragging) suppressClick.current = true;
    const start = (event, listener) => {
        if (disabled || event.target.closest('button, input, textarea, select, a, [contenteditable="true"], [role="button"]')) return;
        suppressClick.current = false;
        listener?.(event);
    };
    return <div {...attributes} role="group" ref={node => { setNodeRef(node); setActivatorNodeRef(node); }}
        tabIndex={disabled ? -1 : 0} aria-label={t('templates.reorder', { name })}
        className={styles.stackRow} data-dragging={isDragging || undefined}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        onMouseDown={event => start(event, listeners?.onMouseDown)}
        onTouchStart={event => start(event, listeners?.onTouchStart)}
        onKeyDown={event => { if (!disabled && event.target === event.currentTarget) listeners?.onKeyDown?.(event); }}
        onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
        <span className={styles.stackNumber}>{String(index + 1).padStart(2, '0')}</span>
        <span className={styles.stackName}>{name}</span>
        <button type="button" className={styles.stackRemoveButton} disabled={disabled}
            aria-label={`${t('templates.remove')}: ${name}`}
            onClick={() => onChange(selected.filter(item => item !== id))}>
            <X size={16} aria-hidden="true" />
        </button>
    </div>;
}

export default function TemplateStackPicker({ contentType, selected, onChange, disabled = false }) {
    const { t } = useTranslation();
    const { templates, refresh, loading, error } = useTemplateStore();
    useEffect(() => { void refresh().catch(() => {}); }, [refresh]);
    const available = templates.filter(item => item.scope === contentType && !selected.includes(item.id));
    return <div className={styles.picker}>
        <strong>{t('templates.stack')}</strong>
        <p className={styles.muted}>{t('templates.stackHint')}</p>
        {selected.length > 1 && <p className={styles.muted}>{t('templates.dragHint')}</p>}
        <TemplateSortContext stack={selected} getId={selectedId} onChange={onChange} disabled={disabled}>
            <div className={styles.stackList}>
                {selected.map((id, index) => <TemplatePickerRow key={id} id={id} index={index}
                    name={templates.find(item => item.id === id)?.name ?? t('templates.missing')}
                    selected={selected} onChange={onChange} disabled={disabled} />)}
            </div>
        </TemplateSortContext>
        <div className={styles.pickerAdd}>
            <div className={styles.pickerSelect}>
                <TN_Dropdown width="100%" aria-label={t('templates.choose')} value="" onChange={value => {
                    if (disabled || selected.length >= 100 || !available.some(item => item.id === value)) return;
                    onChange([...selected, value]);
                }} placeholder={t(loading ? 'common.loading' : 'templates.choose')} options={available.map(item => ({ value: item.id, label: item.name }))} />
            </div>
        </div>
        {error && <div role="alert">{error} <TN_Button variant="secondary" onClick={() => { void refresh().catch(() => {}); }}>{t('templates.refresh')}</TN_Button></div>}
    </div>;
}
