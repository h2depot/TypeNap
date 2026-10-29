import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Page, User, Map, Entity } from '../assets/IconList';
import TN_Tooltip from './TNDesignSystem/TN_Tooltip';
import styles from './ContentTypeFilter.module.css';

const contentOptions = [
    { value: 'all' },
    { value: 'txt', Icon: Page },
    { value: 'character', Icon: User },
    { value: 'world', Icon: Map },
    { value: 'entity', Icon: Entity },
];

export default function ContentTypeFilter({ value, onChange, types, 'aria-label': ariaLabel, allLabel }) {
    const { t } = useTranslation();
    const options = contentOptions.filter(option => option.value === 'all' || !types || types.includes(option.value));
    const buttons = useRef([]);
    const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));

    const handleKeyDown = event => {
        let next;
        if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (selectedIndex + 1) % options.length;
        if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (selectedIndex + options.length - 1) % options.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = options.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        onChange(options[next].value);
        buttons.current[next]?.focus();
    };

    return <div data-tn-ui className={styles.switcher} role="radiogroup"
        aria-label={ariaLabel ?? t('story.files.filter.label')} onKeyDown={handleKeyDown}
        style={{ '--filter-index': selectedIndex, '--filter-count': options.length }}>
        <span className={styles.indicator} aria-hidden="true" />
        {options.map(({ value: optionValue, Icon }, index) => {
            const selected = index === selectedIndex;
            const label = optionValue === 'all' && allLabel ? allLabel : t(`story.files.filter.${optionValue}`);
            return <TN_Tooltip key={optionValue} content={label} position="bottom" subtle>
                <button ref={element => { buttons.current[index] = element; }}
                    type="button" role="radio" aria-label={label} aria-checked={selected}
                    tabIndex={selected ? 0 : -1} className={styles.option}
                    onClick={() => onChange(optionValue)}>
                    {Icon ? <Icon size={20} aria-hidden="true" /> : <span className={styles.all}>All</span>}
                </button>
            </TN_Tooltip>;
        })}
    </div>;
}
