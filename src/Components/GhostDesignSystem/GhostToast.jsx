import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ghost, Sparkles, HelpCircle, Skull, X } from 'lucide-react';

// Single Toast Component
export const GhostToast = ({
  id,
  message,
  type = 'info', // 'success' | 'info' | 'warning' | 'error'
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  /* Color mapping per toast type (glow color) */
  const glowColors = {
    success: 'var(--ghost-toast-success)', 
    info: 'var(--ghost-toast-info)',    
    warning: '#f59e0b',                                 
    error: '#ef4444',                               
  };

  const glowColor = glowColors[type];

  // Base theme colors
  const cardBg = 'var(--ghost-toast-bg)';
  
  const textColor = 'var(--ghost-toast-text)';
  const borderBgColor = 'var(--ghost-toast-border)';

  // Choose corresponding ghost/icon and float animation per type
  let IconComponent = Ghost;
  let iconAnimation = {};

  if (type === 'success') {
    IconComponent = Ghost;
    // Friendly float: higher frequency, joyful jump
    iconAnimation = {
      y: [0, -6, 2, -4, 0],
      scale: [1, 1.08, 0.95, 1.03, 1],
      transition: {
        duration: 2.0,
        repeat: Infinity,
        ease: "easeInOut"
      }
    };
  } else if (type === 'info') {
    IconComponent = Sparkles;
    // Sparkle pulse and gentle drift
    iconAnimation = {
      y: [0, -4, 0],
      scale: [1, 1.15, 1],
      rotate: [0, 15, -15, 0],
      transition: {
        duration: 2.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    };
  } else if (type === 'warning') {
    IconComponent = HelpCircle;
    // Slow planetary orbital tilt/sway
    iconAnimation = {
      y: [0, -3, 0],
      rotate: [-12, 12, -12],
      transition: {
        duration: 3.2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    };
  } else if (type === 'error') {
    IconComponent = Skull;
    // Spooky jitter / shudder
    iconAnimation = {
      x: [-0.8, 0.8, -0.6, 0.6, 0],
      y: [-0.5, 0.5, -0.4, 0.4, 0],
      rotate: [-2, 2, -1, 1, 0],
      transition: {
        duration: 0.18,
        repeat: Infinity,
        repeatType: "mirror"
      }
    };
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, scale: 0.9, x: 20 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ 
        opacity: 0, 
        y: -60, // Ascend animation (ascends into sky)
        scale: 0.92,
        transition: { duration: 0.35, ease: 'easeIn' }
      }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        width: '320px',
        padding: '16px',
        background: cardBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `2px solid ${borderBgColor}`,
        borderRadius: '18px',
        color: textColor,
        boxShadow: `var(--ghost-shadow-toast), 0 0 16px ${glowColor}25`,
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      {/* Dynamic Type Glow Strip at the left edge */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: '6px',
          background: glowColor,
          boxShadow: `0 0 10px ${glowColor}`,
          zIndex: 2,
        }}
      />

      {/* Dynamic Animated Ghost Icon */}
      <motion.div
        animate={iconAnimation}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: glowColor,
          flexShrink: 0,
          paddingLeft: '6px', // space from glow strip
        }}
      >
        <IconComponent size={24} />
      </motion.div>

      {/* Message Text */}
      <div
        style={{
          flex: 1,
          fontSize: '14px',
          fontWeight: 600,
          lineHeight: 1.4,
          textAlign: 'left',
          paddingRight: '6px',
        }}
      >
        {message}
      </div>

      {/* Close button */}
      <button
        onClick={() => onClose(id)}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          color: textColor,
          opacity: 0.5,
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '50%',
          transition: 'all 0.2s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.5';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};

// Toast Fixed Container Component
export const GhostToastContainer = ({
  toasts = [],
  onClose,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        alignItems: 'flex-end',
        pointerEvents: 'none', // Allow clicks through empty gaps
        maxWidth: '100%',
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <GhostToast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={onClose}
            duration={toast.duration}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
export default GhostToastContainer;
