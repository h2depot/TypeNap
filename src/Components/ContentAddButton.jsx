import { Plus } from '../assets/IconList';
import styles from './ContentAddButton.module.css';

export default function ContentAddButton({ children, onClick, iconOnly = false, className = '' }) {
    return (
        <button type="button" className={`${styles.button} ${iconOnly ? styles.iconOnly : ''} ${className}`} onClick={onClick}
            aria-label={iconOnly ? children : undefined} title={iconOnly ? children : undefined}>
            <Plus size={18} aria-hidden="true" />
            {!iconOnly && <span>{children}</span>}
        </button>
    );
}
