import { useTNTheme } from './theme';
import React from 'react';
import { motion } from 'framer-motion';

const TN_IconButton = ({ icon, onClick, variant = 'secondary', size = 'medium', theme: themeOverride, borderRadius = '50%', disabled = false, type = 'button', style, ...props }) => {
  const theme = useTNTheme(themeOverride);
  const isPrimary = variant === 'primary';
  const isTransparent = variant === 'ghost';

  /* color settings for light/dark theme */
  const bgColor = theme === 'light' ? '#C9C9C9' : '#363636';
  const borderColor = theme === 'light' ? '#232b69' : '#D4CFBF';
  const textColor = theme === 'light' ? '#232b69' : '#D4CFBF';

  /* accent color for light/dark theme */
  const accentColor = '#E8890D';

  // Inner button styling based on variants
  let buttonBgColor = bgColor;
  let buttonTextColor = textColor;
  let borderBgColor = borderColor;

  if (isPrimary) {
    buttonBgColor = borderColor;
    buttonTextColor = bgColor;
    borderBgColor = bgColor;
  } else if (isTransparent) {
    buttonBgColor = 'transparent';
    buttonTextColor = textColor;
    borderBgColor = 'transparent';
  }

  // Size calculations
  const buttonSize = size === 'extra_large' ? '80px' : size === 'small' ? '36px' : size === 'large' ? '48px' : '42px';
  const iconSize = size === 'extra_large' ? 40 : size === 'small' ? 16 : size === 'large' ? 24 : 20;

  const innerBorderRadius = borderRadius.toString().endsWith('%')
    ? borderRadius
    : `calc(${borderRadius} - 3px)`;

  // React.cloneElement to inject correct size to Lucide icons if not already set
  const clonedIcon = icon && React.isValidElement(icon)
    ? React.cloneElement(icon, { size: icon.props.size || iconSize })
    : icon;

  // Outer container scale animations
  const buttonVariants = {
    initial: { scale: 1, y: 0 },
    hover: {
      scale: 1.05,
      y: -2,
      transition: { type: "spring", stiffness: 400, damping: 15 }
    },
    tap: {
      scale: 0.95,
      y: 1,
      transition: { type: "spring", stiffness: 500, damping: 10 }
    }
  };

  // Micro-animation: Float the icon up and down like a gentle ghost
  const iconContainerVariants = {
    initial: { y: 0, rotate: 0 },
    hover: {
      y: [0, -3, 2, -2, 0],
      rotate: [0, -4, 4, -2, 0],
      transition: {
        duration: 2.2,
        repeat: Infinity,
        repeatType: "loop",
        ease: "easeInOut"
      }
    }
  };

  return (
    <motion.button
      type={type}
      onClick={disabled ? undefined : onClick}
      initial="initial"
      whileHover={disabled ? undefined : "hover"}
      whileTap={disabled ? undefined : "tap"}
      variants={buttonVariants}
      disabled={disabled}
      style={{
        position: 'relative',
        display: 'inline-flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: buttonSize,
        height: buttonSize,
        border: 'none',
        background: 'transparent',
        padding: '3px', // border width
        borderRadius: borderRadius,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled
          ? 'none'
          : theme === 'light'
            ? '0 4px 10px rgba(0,0,0,0.06)'
            : '0 4px 12px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        outline: 'none',
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
      {...props}
    >
      {/* 1. Solid / Semi-transparent Border Background */}
      {!isTransparent && (
        <div style={{ position: 'absolute', inset: 0, background: borderBgColor, zIndex: 0, borderRadius }} />
      )}

      {/* 2. Accent Border / Glow Background (Fades in on hover) */}
      {!disabled && (
        <motion.div
          variants={{
            initial: { opacity: 0 },
            hover: { opacity: 1 }
          }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'absolute',
            inset: 0,
            background: accentColor,
            zIndex: 0,
            borderRadius
          }}
        />
      )}

      {/* 3. Inner Container */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '100%',
          background: isTransparent ? 'transparent' : buttonBgColor,
          borderRadius: innerBorderRadius,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: buttonTextColor,
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }}
      >
        {/* TN_MascotIcon hover glassmorphism background for the ghost variant */}
        {isTransparent && !disabled && (
          <motion.div
            variants={{
              initial: { opacity: 0 },
              hover: { opacity: 0.12 }
            }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: theme === 'light' ? '#000' : '#fff',
              backdropFilter: 'blur(4px)',
              borderRadius: innerBorderRadius,
              zIndex: -1,
            }}
          />
        )}

        <motion.div
          variants={iconContainerVariants}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {clonedIcon}
        </motion.div>
      </div>
    </motion.button>
  );
};

export default TN_IconButton;
