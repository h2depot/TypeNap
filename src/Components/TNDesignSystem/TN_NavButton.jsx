import React from 'react';
import styles from './TN_NavButton.module.css';

export default function TN_NavButton({
  icon,
  selected = false,
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) {
  const sizedIcon = React.isValidElement(icon)
    ? React.cloneElement(icon, { size: icon.props.size ?? 24 })
    : icon;

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${styles.button} ${className}`}
      data-selected={selected}
      aria-current={selected ? 'page' : undefined}
      {...props}
    >
      <span className={styles.surface}>{sizedIcon}</span>
    </button>
  );
}
