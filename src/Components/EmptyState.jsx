import { PageSearch } from '../assets/IconList';
import { TN_Button } from './TNDesignSystem';
import styles from './EmptyState.module.css';

export default function EmptyState({ message, actionLabel, onAction, icon = <PageSearch size={32} aria-hidden="true" />, className = '' }) {
    return <div className={`${styles.container} ${className}`}>
        {icon}
        <p role="status">{message}</p>
        {onAction && <TN_Button variant="secondary" onClick={onAction}>{actionLabel}</TN_Button>}
    </div>;
}
