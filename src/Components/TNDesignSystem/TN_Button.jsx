import { useTNTheme } from './theme';
import { motion } from 'framer-motion';

const TN_Button = ({ children, onClick, variant = 'primary', size = 'medium', theme: themeOverride, borderRadius = '30px', type = 'button', disabled = false, style, ...props }) => {
  const theme = useTNTheme(themeOverride);
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isProceed = variant === 'proceed';

  /* color settings for light/dark theme */
  const bgColor = theme === 'light' ? '#C9C9C9' : '#363636';
  const borderColor = theme === 'light' ? '#232b69' : '#D4CFBF';
  const textColor = theme === 'light' ? '#232b69' : '#D4CFBF';

  /* accent color for light/dark theme */
  const accentColor = '#E8890D';

  /* Primary inverts the colors for emphasis */
  const buttonBgColor = isDanger ? 'var(--theme-red)' : isProceed ? accentColor : isPrimary ? borderColor : bgColor;
  const buttonTextColor = isDanger ? 'var(--light-base)' : isProceed ? '#1a1a1a' : isPrimary ? bgColor : textColor;
  /* Primary has a border color that contrasts its background */
  const borderBgColor = isPrimary ? bgColor : borderColor;
  const baseShadow = theme === 'light'
    ? '0 6px 15px rgba(0,0,0,0.1)'
    : '0 6px 15px rgba(0,0,0,0.3)';
  const proceedShadow = theme === 'light'
    ? '0 8px 20px rgba(0,0,0,0.16), 0 0 14px rgba(232,137,13,0.18)'
    : '0 8px 20px rgba(0,0,0,0.4), 0 0 18px rgba(232,137,13,0.25)';

  return (
    <motion.button
      {...props}
      type={type}
      disabled={disabled}
      onClick={onClick}
      initial="initial"
      whileHover={disabled ? undefined : "hover"}
      whileTap={disabled ? undefined : "tap"}
      variants={{
        initial: { scale: 1, y: 0, boxShadow: baseShadow },
        hover: {
          scale: 1.01,
          y: -1,
          boxShadow: isProceed ? proceedShadow : baseShadow,
        },
        tap: { scale: 0.97, y: 1 }
      }}
      transition={{ type: "spring", stiffness: 700, damping: 35, mass: 0.5, boxShadow: { type: 'tween', duration: 0.2, ease: 'easeOut' } }}
      style={{
        position: 'relative',
        display: 'inline-flex',
        border: 'none',
        background: isProceed ? accentColor : 'transparent',
        padding: isProceed ? 0 : '4px',
        borderRadius: borderRadius,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        overflow: 'hidden',
        outline: 'none',
        ...style,
      }}
    >
      {/* Solid Border Background */}
      {!isProceed && <div style={{ position: 'absolute', inset: 0, background: borderBgColor, zIndex: 0 }} />}

      {/* Accent Border Background (Fades in on hover) */}
      {!isProceed && <motion.div
        variants={{
          initial: { opacity: 0 },
          hover: { opacity: 1 }
        }}
        transition={{ duration: 0.3 }}
        style={{ position: 'absolute', inset: 0, background: accentColor, zIndex: 0 }}
      />}

      {/* Inner Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: buttonBgColor,
          borderRadius: isProceed ? borderRadius : `calc(${borderRadius} - 4px)`,
          // Preserve the overall size when removing the 4px border.
          padding: isProceed
            ? size === 'large' ? '16px 32px' : '12px 24px'
            : size === 'large' ? '12px 28px' : '8px 20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          color: buttonTextColor,
          fontWeight: 'var(--font-weight-ui)',
          fontSize: size === 'large' ? '18px' : '16px',
        }}
      >
        {children}
      </div>
    </motion.button>
  );
};

export default TN_Button;
