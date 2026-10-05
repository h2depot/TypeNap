import TN_FloatingLayer from './TN_FloatingLayer';
import { useTNTheme } from './theme';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TN_Menu = ({ trigger, items = [], theme: themeOverride, placement = 'auto' }) => {
  const theme = useTNTheme(themeOverride);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && !popupRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const bgColor = theme === 'light' ? '#C9C9C9' : '#363636';
  const borderColor = theme === 'light' ? '#232b69' : '#D4CFBF';
  const textColor = theme === 'light' ? '#232b69' : '#D4CFBF';

  return (
    <div 
      ref={menuRef} 
      style={{ 
        position: 'relative', 
        display: 'inline-block',
        zIndex: isOpen ? 50 : undefined
      }}
    >
      {/* Trigger element container */}
      {trigger && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          style={{ display: 'inline-flex' }}
        >
          {trigger}
        </div>
      )}

      {/* Action Menu Popover */}
      <AnimatePresence>
        {isOpen && (
          <TN_FloatingLayer anchorRef={menuRef} interactive placement={placement}>
          <motion.div
            ref={popupRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 8, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              WebkitUserSelect: 'none',
              userSelect: 'none',
              position: 'absolute',
              top: 'var(--tn-popup-top, 100%)',
              bottom: 'var(--tn-popup-bottom, auto)',
              maxHeight: 'var(--tn-popup-max-height)',
              boxSizing: 'border-box',
              pointerEvents: 'auto',
              right: 0, // align menu with right edge of the trigger button
              width: 'max-content',
              minWidth: '150px',
              background: bgColor,
              borderRadius: '16px',
              border: `4px solid ${borderColor}`,
              boxShadow: theme === 'light' ? '0 10px 25px rgba(0,0,0,0.1)' : '0 10px 25px rgba(0,0,0,0.4)',
              padding: '6px',
              zIndex: 100,
              overflowY: 'auto',
              overscrollBehavior: 'contain'
            }}
          >
            {items.map((item, index) => {
              const isDanger = item.isDanger;
              const itemTextColor = isDanger ? 'var(--theme-red)' : textColor;
              
              return (
                <motion.div
                  key={index}
                  whileHover={{
                    x: 4,
                    backgroundColor: theme === 'light'
                      ? (isDanger ? 'rgba(160, 73, 64, 0.15)' : 'rgba(34, 44, 149, 0.1)')
                      : (isDanger ? 'rgba(160, 73, 64, 0.15)' : 'rgba(217, 217, 217, 0.1)')
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onClick?.(e);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    whiteSpace: 'nowrap',
                    color: itemTextColor,
                    fontWeight: 'var(--font-weight-ui, 800)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start'
                  }}
                >
                  {item.label}
                </motion.div>
              );
            })}
          </motion.div>
          </TN_FloatingLayer>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TN_Menu;
