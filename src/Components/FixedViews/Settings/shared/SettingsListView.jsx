import { useId } from 'react';
import { RightGraterThan } from '../../../../assets/IconList';
import TN_Dropdown from '../../../TNDesignSystem/TN_Dropdown';
import TN_Toggle from '../../../TNDesignSystem/TN_Toggle';
import styles from '../SettingsView.module.css';

export function SettingsListView({ title, description, children, tone }) {
    const id = useId();
    return (
        <section className={styles.group} aria-labelledby={id} data-tone={tone}>
            <header className={styles.groupHeader}>
                <h2 id={id}>{title}</h2>
                {description && <p>{description}</p>}
            </header>
            <div className={styles.groupBody}>{children}</div>
        </section>
    );
}

export function SettingsRow({ icon, title, description, control, children, onClick, disabled = false, tone }) {
    const id = useId();
    const content = <><span className={styles.rowIcon} aria-hidden="true">{icon}</span><span className={styles.rowText}><span id={`${id}-title`} className={styles.rowTitle}>{title}</span>{description && <span id={`${id}-description`} className={styles.rowDescription}>{description}</span>}</span></>;
    return (
        <div className={styles.row} data-disabled={disabled || undefined} data-tone={tone}>
            {onClick && !control ? (
                <button type="button" className={styles.rowAction} onClick={onClick} disabled={disabled}>
                    {content}<RightGraterThan size={18} className={styles.chevron} aria-hidden="true" />
                </button>
            ) : (
                <div className={styles.rowMain}>
                    <div className={styles.rowInfo}>{content}</div>
                    {control && <div className={styles.rowControl}>
                        <fieldset disabled={disabled} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined}>{control}</fieldset>
                    </div>}
                </div>
            )}
            {children && <div className={styles.rowExtra}>{children}</div>}
        </div>
    );
}

export function SettingsSelect({ options, value, onChange, label }) {
    return <TN_Dropdown options={options} value={value} onChange={onChange} aria-label={label} scale={0.85} width="180px" />;
}

export function SettingsToggle({ isOn, onToggle, label }) {
    return <div className={styles.toggleWrapper}><TN_Toggle isOn={isOn} onToggle={onToggle} aria-label={label} scale={0.55} /></div>;
}
