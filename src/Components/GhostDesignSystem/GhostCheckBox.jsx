import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

const GhostCheckBox = ({
  checked = false,
  onChange,
  label,
  disabled = false,
  size = 'medium',
  ...props
}) => {
  /* color settings for light/dark theme */
  const bgColor = 'var(--ghost-bg)';
  const borderColor = 'var(--ghost-border)';
  const textColor = 'var(--ghost-text)';

  /* gradient color for checked state */
  const gradient = 'var(--ghost-gradient)';

  // Checkbox box size
  const boxSize = size === 'small' ? '20px' : size === 'large' ? '28px' : '24px';
  const checkIconSize = size === 'small' ? 12 : size === 'large' ? 18 : 15;
  const labelFontSize = size === 'small' ? '13px' : size === 'large' ? '16px' : '14px';

  const borderWidth = '3px';
  const borderRadius = '6px';
  const innerBorderRadius = `calc(${borderRadius} - 1.5px)`;

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
            : 'var(--ghost-shadow-input)',
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
          {/* Active Gradient Background Layer (Smoothly fades in when checked) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              background: gradient,
              borderRadius: innerBorderRadius,
              zIndex: 0,
            }}
          />

          {/* Lucide Check Icon */}
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
                    color: borderColor, // Match outer border color
                  }}
                >
                  <Check size={checkIconSize} strokeWidth={3.5} />
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
            fontWeight: 500,
            transition: 'color 0.25s ease',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};

export default GhostCheckBox;
