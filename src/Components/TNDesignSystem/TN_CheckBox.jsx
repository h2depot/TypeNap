import { useTNTheme } from './theme';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from '../../assets/IconList';

const TN_CheckBox = ({ checked = false, onChange, label, theme: themeOverride, disabled = false, size = 'medium', ...props }) => {
  const theme = useTNTheme(themeOverride);
  /* color settings for light/dark theme */
  const bgColor = theme === 'light' ? '#C9C9C9' : '#363636';
  const borderColor = theme === 'light' ? '#232b69' : '#D4CFBF';
  const textColor = theme === 'light' ? '#232b69' : '#D4CFBF';

  /* accent color for checked state */
  const accentColor = '#85916D';

  // Checkbox box size
  const boxSize = size === 'small' ? '20px' : size === 'large' ? '28px' : '24px';
  const checkIconSize = size === 'small' ? 12 : size === 'large' ? 18 : 15;
  const labelFontSize = size === 'small' ? '13px' : size === 'large' ? '16px' : '14px';

  // Inner padding based on boxSize to ensure border is aligned
  const borderWidth = '3px';
  const borderRadius = '6px';
  const innerBorderRadius = `calc(${borderRadius} - 1.5px)`;

  // Scale and float animations on hover
  const boxVariants = {
    initial: { scale: 1 },
    hover: disabled ? {} : { scale: 1.05, y: -0.5, transition: { type: "spring", stiffness: 400, damping: 15 } },
    tap: disabled ? {} : { scale: 0.95, y: 0.5, transition: { type: "spring", stiffness: 500, damping: 10 } }
  };

  const handleToggle = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); handleToggle(); }
      }}
      onClick={handleToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        opacity: disabled ? 0.5 : 1,
      }}
      {...props}
    >
      {/* Checkbox Outer Container (Wrapper for border and padding) */}
      <motion.div
        initial="initial"
        whileHover="hover"
        whileTap="tap"
        variants={boxVariants}
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: boxSize,
          height: boxSize,
          borderRadius: borderRadius,
          background: borderColor, // acts as border color
          padding: borderWidth,
          boxShadow: disabled
            ? 'none'
            : theme === 'light'
              ? '0 2px 6px rgba(0,0,0,0.06)'
              : '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        {/* Inner Content Area */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            background: bgColor,
            borderRadius: innerBorderRadius,
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transition: 'background-color 0.25s ease',
          }}
        >
          {/* Active Accent Background Layer (Smoothly fades in when checked) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              background: accentColor,
              borderRadius: innerBorderRadius,
              zIndex: 0,
            }}
          />

          {/* Original Check Icon */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <AnimatePresence>
              {checked && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: '#232b69', // Dark marker on the checked fill
                  }}
                >
                  <Check size={checkIconSize} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Label Text */}
      {label && (
        <span
          style={{
            color: textColor,
            fontSize: labelFontSize,
            fontWeight: 'var(--font-weight-ui, 800)',
            transition: 'color 0.25s ease',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};

export default TN_CheckBox;
