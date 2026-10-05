import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const GhostDropdown = ({ options, value, onChange, placeholder = "Select option" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const bgColor = 'var(--ghost-bg)';
  const borderColor = 'var(--ghost-border)';
  const textColor = 'var(--ghost-text)';
  const gradient = 'var(--ghost-gradient)';

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '200px' }}>
      {/* Main Button */}
      <motion.div
        initial="initial"
        whileHover="hover"
        whileTap="tap"
        variants={{
          initial: { scale: 1 },
          hover: { scale: 1.02 },
          tap: { scale: 0.98 }
        }}
        style={{
          position: 'relative',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          borderRadius: '16px',
          padding: '2px', // stronger 2px border
          cursor: 'pointer',
          boxShadow: 'var(--ghost-shadow)',
          overflow: 'hidden'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ position: 'absolute', inset: 0, background: borderColor, zIndex: 0 }} />

        <motion.div
          animate={{
            opacity: isOpen ? 1 : 0
          }}
          variants={{
            initial: { opacity: isOpen ? 1 : 0 },
            hover: { opacity: 1 }
          }}
          transition={{ duration: 0.25 }}
          style={{ position: 'absolute', inset: 0, background: gradient, zIndex: 0 }}
        />

        {/* Inner Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            background: bgColor,
            borderRadius: '14px',
            padding: '12px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: textColor,
            fontWeight: 500,
            fontSize: '14px',
          }}
        >
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            style={{ fontSize: '12px' }}
          >
            ▼
          </motion.span>
        </div>
      </motion.div>

      {/* Dropdown Menu */}
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
              left: 0,
              right: 0,
              padding: '2px', // prominent 2px gradient border
              borderRadius: '16px',
              background: gradient,
              boxShadow: 'var(--ghost-shadow-large), 0 0 16px var(--ghost-glow)',
              zIndex: 100,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                background: bgColor,
                borderRadius: '14px',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}
            >
              {options.map((option) => (
                <motion.div
                  key={option.value}
                  whileHover={{
                    x: 4,
                    backgroundColor: value === option.value
                      ? borderColor
                      : 'var(--ghost-menu-bg-hover)'
                  }}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '11px 13px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: value === option.value ? bgColor : textColor,
                    backgroundColor: value === option.value ? borderColor : 'transparent',
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {option.label}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GhostDropdown;
