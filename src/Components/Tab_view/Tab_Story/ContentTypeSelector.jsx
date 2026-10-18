import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Page, User, Map, Entity, Check } from '../../../assets/IconList';
import styles from './ContentTypeSelector.module.css';

const types = [
    { value: 'txt', label: 'Text', icon: Page },
    { value: 'character', label: 'Character', icon: User },
    { value: 'world', label: 'World', icon: Map },
    { value: 'entity', label: 'Entity', icon: Entity },
];

export default function ContentTypeSelector({ value, onChange }) {
    const { t } = useTranslation();
    const buttons = useRef([]);
    const selectedIndex = Math.max(0, types.findIndex(type => type.value === value));

    const handleKeyDown = (event) => {
        let next;
        if (['ArrowDown', 'ArrowRight'].includes(event.key)) next = (selectedIndex + 1) % types.length;
        if (['ArrowUp', 'ArrowLeft'].includes(event.key)) next = (selectedIndex + types.length - 1) % types.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = types.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        onChange(types[next].value);
        buttons.current[next]?.focus();
    };

    return <div className={styles.section}>
        <div className={styles.label}>{t('story.contentTypes.label')}</div>
        <div className={styles.selector} role="radiogroup" aria-label={t('story.contentTypes.label')} onKeyDown={handleKeyDown}>
        {types.map((type, index) => {
            const selected = index === selectedIndex;
            const Icon = type.icon;
            return <button key={type.value} ref={element => { buttons.current[index] = element; }}
                type="button" role="radio" aria-checked={selected} tabIndex={selected ? 0 : -1}
                className={`${styles.option} ${selected ? styles.selected : ''}`}
                onClick={() => onChange(type.value)}>
                <span className={styles.heading}>
                    <span className={styles.icon}><Icon size={24} aria-hidden="true" /></span>
                    <span className={styles.title}>{type.label}</span>
                    <span className={styles.indicator} aria-hidden="true"><Check size={12} /></span>
                </span>
                <span className={styles.description}>{t(`story.contentTypes.${type.value}`)}</span>
            </button>;
        })}
        </div>
    </div>;
}
