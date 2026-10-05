import TN_FloatingLayer from './TN_FloatingLayer';
import { useTNTheme } from './theme';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TN_Dropdown = ({ options, value, onChange, placeholder = "Select option", theme: themeOverride, scale = 1, width = '200px', 'aria-label': ariaLabel }) => {
  const theme = useTNTheme(themeOverride);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const popupRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && !popupRef.current?.contains(event.target)) {
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

  const accentColor = '#E8890D';

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width, maxWidth: '100%' }}>
      {/* Main Button */}
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen((open) => !open);
          }
        }}
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
          borderRadius: `${16 * scale}px`,
          padding: `${4 * scale}px`, // This acts as the border width
          cursor: 'pointer',
          boxShadow: theme === 'light' ? '0 4px 12px rgba(0,0,0,0.1)' : '0 4px 12px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Solid Border Background */}
        <div style={{ position: 'absolute', inset: 0, background: borderColor, zIndex: 0 }} />

        {/* Accent Border Background (Fades in on hover) */}
        <motion.div
          variants={{
            initial: { opacity: 0 },
            hover: { opacity: 1 }
          }}
          transition={{ duration: 0.3 }}
          style={{ position: 'absolute', inset: 0, background: accentColor, zIndex: 0 }}
        />

        {/* Inner Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            background: bgColor,
            borderRadius: `${12 * scale}px`, // Outer radius minus border width
            padding: `${10 * scale}px ${12 * scale}px`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: textColor,
            fontWeight: 'var(--font-weight-ui, 800)',
            fontSize: `${14 * scale}px`,
            lineHeight: `${24 * scale}px`,
          }}
        >
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            style={{ fontSize: `${12 * scale}px` }}
          >
            ▼
          </motion.span>
        </div>
      </motion.div>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <TN_FloatingLayer anchorRef={dropdownRef} interactive>
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
              left: 0,
              right: 0,
              background: bgColor,
              borderRadius: `${16 * scale}px`,
              border: `${4 * scale}px solid ${borderColor}`,
              boxShadow: theme === 'light' ? '0 10px 25px rgba(0,0,0,0.1)' : '0 10px 25px rgba(0,0,0,0.4)',
              padding: `${8 * scale}px`,
              zIndex: 100,
              overflowY: 'auto',
              overscrollBehavior: 'contain'
            }}
          >
            {options.map((option) => (
              <motion.div
                key={option.value}
                role="button"
                tabIndex={0}
                aria-pressed={value === option.value}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onChange(option.value);
                    setIsOpen(false);
                    dropdownRef.current?.querySelector('[role="button"]')?.focus();
                  }
                }}
                whileHover={{
                  x: 4,
                  backgroundColor: value === option.value
                    ? borderColor
                    : (theme === 'light' ? 'rgba(34, 44, 149, 0.1)' : 'rgba(217, 217, 217, 0.1)')
                }}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={{
                  padding: `${10 * scale}px ${12 * scale}px`,
                  borderRadius: `${8 * scale}px`,
                  cursor: 'pointer',
                  fontSize: `${14 * scale}px`,
                  lineHeight: `${24 * scale}px`,
                  color: value === option.value ? bgColor : textColor,
                  backgroundColor: value === option.value ? borderColor : 'transparent',
                  fontWeight: 'var(--font-weight-ui, 800)',
                  transition: 'all 0.2s ease'
                }}
              >
                {option.label}
              </motion.div>
            ))}
          </motion.div>
          </TN_FloatingLayer>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TN_Dropdown;
