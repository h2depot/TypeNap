import React from 'react';
import { motion } from 'framer-motion';

const GhostButton = ({ children, onClick, variant = 'primary', size = 'medium', borderRadius = '30px', type = 'button', disabled = false }) => {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  /* color settings for light/dark theme */
  const bgColor = 'var(--ghost-bg)';
  const borderColor = 'var(--ghost-border)';
  const textColor = 'var(--ghost-text)';

  /* gradient color for light/dark theme */
  const gradient = 'var(--ghost-gradient)';

  /* Primary inverts the colors for emphasis, Danger uses red theme colors */
  const buttonBgColor = isDanger ? '#E53E3E' : (isPrimary ? borderColor : bgColor);
  const buttonTextColor = isDanger ? '#D4CFBF' : (isPrimary ? bgColor : textColor);
  /* Primary has a border color that contrasts its background */
  const borderBgColor = isDanger ? '#E53E3E' : isPrimary ? bgColor : borderColor;

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      initial="initial"
      whileHover="hover"
      whileTap="tap"
      variants={{
        initial: { scale: 1, y: 0 },
        hover: { scale: 1.01, y: -1 },
        tap: { scale: 0.97, y: 1 }
      }}
      transition={{ type: "spring", stiffness: 700, damping: 35, mass: 0.5 }}
      style={{
        position: 'relative',
        display: 'inline-flex',
        border: 'none',
        background: 'transparent',
        padding: '4px', // border width
        borderRadius: borderRadius,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        boxShadow: 'var(--ghost-shadow)',
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: borderBgColor, zIndex: 0 }} />

      <motion.div
        variants={{
          initial: { opacity: 0 },
          hover: { opacity: 1 }
        }}
        transition={{ duration: 0.3 }}
        style={{ position: 'absolute', inset: 0, background: gradient, zIndex: 0 }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: buttonBgColor,
          borderRadius: `calc(${borderRadius} - 4px)`,
          padding: size === 'large' ? '12px 28px' : '8px 20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          color: buttonTextColor,
          fontWeight: 700,
          fontSize: size === 'large' ? '18px' : '16px',
        }}
      >
        {children}
      </div>
    </motion.button>
  );
};

export default GhostButton;
