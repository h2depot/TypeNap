import { useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { RightArrow, Search } from '../../assets/IconList';
import TN_FloatingLayer from './TN_FloatingLayer';
import styles from './TN_DropdownMenu.module.css';

// Compact searchable menus, using TabLauncher's search and row dimensions.
export default function TN_DropdownMenuPanel({ items, search, title, emptyLabel, theme, owner, onSelect, onBack, panelRef, side = false }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const anchorRef = useRef(null);
  const submenuRef = useRef(null);
  const activeItem = items[activeIndex];
  const submenuId = useId();

  const open = (item, index, element, focus = false) => {
    if (item.disabled || !item.submenu) return;
    anchorRef.current = element;
    if (index !== activeIndex) item.submenu.onOpen?.();
    setActiveIndex(index);
    if (focus) requestAnimationFrame(() => submenuRef.current?.querySelector('input, [role="menuitem"]')?.focus());
  };

  return <>
    <motion.div data-tn-ui data-tn-dropdown-owner={owner} data-tn-popup-panel data-theme={theme} ref={panelRef}
      className={`${styles.panel} ${side ? styles.submenu : ''}`}
      initial={{ opacity: 0, y: side ? 0 : -4 }}
      animate={{ opacity: 1, y: side ? 0 : 8 }}
      exit={{ opacity: 0, y: side ? 0 : -4 }}
      transition={{ duration: 0.14 }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (onBack && (event.key === 'Escape' || (event.key === 'ArrowLeft' && !event.target.matches('input, textarea')))) {
          event.preventDefault(); event.stopPropagation(); onBack(); return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        if (event.target.matches('input, textarea') && !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
        const rows = [...event.currentTarget.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
        if (!rows.length) return;
        const index = rows.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1
          : event.key === 'ArrowDown' ? (index + 1) % rows.length : (index < 0 ? rows.length - 1 : (index - 1 + rows.length) % rows.length);
        event.preventDefault(); event.stopPropagation(); rows[next].focus();
      }}>
      {search && <div className={styles.searchField} role="search">
        <Search size={16} aria-hidden="true" />
        <input value={search.value} onChange={event => search.onChange(event.target.value)}
          placeholder={search.placeholder} aria-label={search.label ?? search.placeholder}
          onKeyDown={event => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) return;
            const first = items.find(item => !item.disabled && !item.submenu);
            if (first) { event.preventDefault(); onSelect(first, event); }
          }} />
      </div>}
      {title && <div className={styles.caption}><span>{title}</span><span role="status">{items.length}件</span></div>}
      <div role="menu" aria-label={title} className={styles.items}>
        {items.map((item, index) => <button data-tn-ui key={item.id ?? index} type="button"
          className={styles.action} data-active={activeIndex === index && !!item.submenu ? 'true' : undefined}
          data-danger={item.isDanger || undefined}
          role="menuitem" tabIndex={item.disabled ? -1 : 0} aria-disabled={!!item.disabled} disabled={item.disabled}
          aria-haspopup={item.submenu ? 'menu' : undefined}
          aria-expanded={item.submenu ? activeIndex === index : undefined}
          aria-controls={item.submenu && activeIndex === index ? submenuId : undefined}
          onMouseEnter={event => {
            if (item.submenu) open(item, index, event.currentTarget);
            else setActiveIndex(null);
          }}
          onFocus={event => {
            if (event.target !== event.currentTarget) return;
            if (item.submenu) open(item, index, event.currentTarget);
            else setActiveIndex(null);
          }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (item.submenu && event.key === 'ArrowRight') {
              event.preventDefault(); event.stopPropagation(); open(item, index, event.currentTarget, true);
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault(); event.stopPropagation();
              if (item.submenu) open(item, index, event.currentTarget, true);
              else if (!item.disabled) onSelect(item, event);
            }
          }}
          onClick={event => {
            event.stopPropagation();
            if (item.submenu) open(item, index, event.currentTarget, true);
            else if (!item.disabled) onSelect(item, event);
          }}>
          {item.icon}
          <span className={styles.label}>{item.label}</span>
          {item.badge && <span className={styles.badge}>{item.badge}</span>}
          {item.submenu && <RightArrow size={16} className={styles.arrow} aria-hidden="true" />}
        </button>)}
      </div>
      {!items.length && <div role="status" className={styles.empty}>{emptyLabel ?? '候補がありません。'}</div>}
    </motion.div>
    {activeItem?.submenu && !activeItem.disabled && <TN_FloatingLayer anchorRef={anchorRef} interactive placement="right" popupWidth={340}>
      <div id={submenuId}>
        <TN_DropdownMenuPanel {...activeItem.submenu} panelRef={submenuRef} theme={theme} owner={owner} onSelect={onSelect} side
          onBack={() => { anchorRef.current?.focus(); setActiveIndex(null); }} />
      </div>
    </TN_FloatingLayer>}
  </>;
}
