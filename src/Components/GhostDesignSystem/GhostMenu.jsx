import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const GhostMenu = ({ trigger, items = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const bgColor = 'var(--ghost-bg)';
  const borderColor = 'var(--ghost-border)';
  const textColor = 'var(--ghost-text)';

  return (
    <div
      ref={menuRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        zIndex: isOpen ? 50 : undefined
      }}
    >
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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 8, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              WebkitUserSelect: 'none',
              userSelect: 'none',
              position: 'absolute',
              top: '100%',
              right: 0,
              width: '150px',
              background: bgColor,
              borderRadius: '16px',
              border: `4px solid ${borderColor}`,
              boxShadow: 'var(--ghost-shadow-large)',
              padding: '6px',
              zIndex: 100,
              overflow: 'hidden'
            }}
          >
            {items.map((item, index) => {
              const isDanger = item.isDanger;
              const isDisabled = item.disabled;
              const itemTextColor = isDanger ? '#ff4d4d' : textColor;

              return (
                <motion.div
                  key={index}
                  whileHover={isDisabled ? undefined : {
                    x: 4,
                    backgroundColor: isDanger
                      ? 'rgba(255, 77, 77, 0.15)'
                      : 'var(--ghost-menu-bg-hover)'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isDisabled) return;
                    item.onClick?.(e);
                    setIsOpen(false);
                  }}
                  aria-disabled={isDisabled}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: isDisabled ? 'default' : 'pointer',
                    fontSize: '13px',
                    color: itemTextColor,
                    opacity: isDisabled ? 0.45 : 1,
                    fontWeight: 'bold',
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
        )}
      </AnimatePresence>
    </div>
  );
};

export default GhostMenu;
