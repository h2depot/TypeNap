import './TN_Selection.css';
import TN_FloatingLayer from './TN_FloatingLayer';
import TN_DropdownMenuPanel from './TN_DropdownMenuPanel';
import { useTNTheme } from './theme';
import { cloneElement, isValidElement, useId, useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';

const TN_DropdownMenu = ({ trigger, items = [], theme: themeOverride, placement = 'auto' }) => {
  const theme = useTNTheme(themeOverride);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const popupRef = useRef(null);
  const owner = useId();
  const focusTrigger = () => menuRef.current?.querySelector('button, [role="button"]')?.focus();

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = event => {
      if (!menuRef.current?.contains(event.target)
        && event.target.closest?.('[data-tn-dropdown-owner]')?.getAttribute('data-tn-dropdown-owner') !== owner) setIsOpen(false);
    };
    const handleKeyDown = event => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape') { setIsOpen(false); focusTrigger(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('focusin', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('focusin', handleClickOutside);
    };
  }, [isOpen, owner]);

  return <div data-tn-ui ref={menuRef} style={{ position: 'relative', display: 'inline-block', zIndex: isOpen ? 50 : undefined }}>
    {trigger && <div onClick={event => { event.stopPropagation(); setIsOpen(open => !open); }}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' && !event.target.closest('[disabled]')) {
          event.preventDefault(); setIsOpen(true);
          requestAnimationFrame(() => popupRef.current?.querySelector('[role="menuitem"]')?.focus());
        }
      }} style={{ display: 'inline-flex' }}>
      {isValidElement(trigger) ? cloneElement(trigger, { 'aria-haspopup': 'menu', 'aria-expanded': isOpen }) : trigger}
    </div>}
    <AnimatePresence>
      {isOpen && <TN_FloatingLayer anchorRef={menuRef} interactive placement={placement}>
        <TN_DropdownMenuPanel items={items} theme={theme} owner={owner} panelRef={popupRef}
          onSelect={(item, event) => { item.onClick?.(event); setIsOpen(false); focusTrigger(); }} />
      </TN_FloatingLayer>}
    </AnimatePresence>
  </div>;
};

export default TN_DropdownMenu;
