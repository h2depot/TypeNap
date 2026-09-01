import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ghost, Circle } from 'lucide-react';

const GhostRadioButton = ({
  checked = false,
  onChange,
  label,
  disabled = false,
  size = 'medium',
  iconType = 'ghost', // 'ghost' | 'dot'
  name,
  ...props
}) => {
  /* color settings for light/dark theme */
  const bgColor = 'var(--ghost-bg)';
  const borderColor = 'var(--ghost-border)';
  const textColor = 'var(--ghost-text)';

  /* gradient color for checked state */
  const gradient = 'var(--ghost-gradient)';

  // Radio box size
  const boxSize = size === 'small' ? '20px' : size === 'large' ? '28px' : '24px';
  const iconSize = size === 'small' ? 12 : size === 'large' ? 18 : 15;
  const labelFontSize = size === 'small' ? '13px' : size === 'large' ? '16px' : '14px';

  // Exact circle border alignment values
  const borderWidth = '3px';
  const borderRadius = '50%'; // Uniform circular borders to prevent distortion

  // Scale and float animations on hover
  const boxVariants = {
    initial: { scale: 1 },
    hover: disabled ? {} : { scale: 1.05, y: -0.5, transition: { type: "spring", stiffness: 400, damping: 15 } },
    tap: disabled ? {} : { scale: 0.95, y: 0.5, transition: { type: "spring", stiffness: 500, damping: 10 } }
  };

  const handleSelect = () => {
    if (!disabled && !checked && onChange) {
      onChange(true);
    }
  };

  // Match active color to the outer border color
  const activeIconColor = borderColor;

  return (
    <div
      onClick={handleSelect}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        cursor: disabled ? 'not-allowed' : (checked ? 'default' : 'pointer'),
        userSelect: 'none',
        opacity: disabled ? 0.5 : 1,
      }}
      {...props}
    >
      {/* Radio Circle Outer Container */}
      <motion.div
        initial="initial"
        whileHover={disabled ? undefined : "hover"}
        whileTap={disabled ? undefined : "tap"}
        variants={boxVariants}
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: boxSize,
          height: boxSize,
          borderRadius: borderRadius,
          background: borderColor, // acts as border
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
            borderRadius: borderRadius, // Matches 50% circle perfectly
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transition: 'background-color 0.25s ease',
          }}
        >
          {/* Active Gradient Background Layer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: checked ? 1 : 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              background: gradient,
              borderRadius: borderRadius,
              zIndex: 0,
            }}
          />

          {/* Checked Marker Area */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <AnimatePresence>
              {checked && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.4, y: 3 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.4, y: 3 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: activeIconColor,
                  }}
                >
                  {iconType === 'ghost' ? (
                    <Ghost size={iconSize} strokeWidth={2.2} />
                  ) : (
                    // Minimal solid dot or lucide circle
                    <Circle size={iconSize - 4} fill={activeIconColor} strokeWidth={0} />
                  )}
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

export default GhostRadioButton;
