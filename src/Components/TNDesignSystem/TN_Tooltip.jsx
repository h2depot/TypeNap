import TN_FloatingLayer from './TN_FloatingLayer';
import { useTNTheme } from './theme';
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TN_Tooltip = ({
  children,
  content,
  position = 'top', // 'top' | 'bottom' | 'left' | 'right'
  theme: themeOverride,
  delay = 0.2,
  subtle = false,
}) => {
  const theme = useTNTheme(themeOverride);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef(null);
  const anchorRef = useRef(null);

  const clearShowTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const showTooltip = () => {
    if (!content) return;

    clearShowTimer();

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      timeoutRef.current = null;
    }, delay * 100);
  };

  const hideTooltip = () => {
    clearShowTimer();
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      clearShowTimer();
    };
  }, []);

  const bgColor = theme === 'light' ? '#C9C9C9' : '#363636';
  const textColor = theme === 'light' ? '#363636' : '#C9C9C9';
  const borderColor = theme === 'light'
    ? 'rgba(54, 54, 54, 0.2)'
    : 'rgba(201, 201, 201, 0.2)';

  const posConfig = {
    top: {
      containerStyle: { bottom: '100%', left: '50%', marginBottom: '10px' },
      containerMotion: { x: '-50%', y: 0 },
      tailStyle: {
        bottom: '-5px',
        left: '50%',
        marginLeft: '-5px',
        borderBottom: `1px solid ${borderColor}`,
        borderRight: `1px solid ${borderColor}`,
      },
      initialAnimation: { opacity: 0, y: 10, x: '-50%', scale: 0.9 },
      exitAnimation: { opacity: 0, y: -5, x: '-50%', scale: 0.95 },
    },

    bottom: {
      containerStyle: { top: '100%', left: '50%', marginTop: '10px' },
      containerMotion: { x: '-50%', y: 0 },
      tailStyle: {
        top: '-5px',
        left: '50%',
        marginLeft: '-5px',
        borderTop: `1px solid ${borderColor}`,
        borderLeft: `1px solid ${borderColor}`,
      },
      initialAnimation: { opacity: 0, y: -10, x: '-50%', scale: 0.9 },
      exitAnimation: { opacity: 0, y: 5, x: '-50%', scale: 0.95 },
    },

    left: {
      containerStyle: { right: '100%', top: '50%', marginRight: '10px' },
      containerMotion: { x: 0, y: '-50%' },
      tailStyle: {
        right: '-5px',
        top: '50%',
        marginTop: '-5px',
        borderTop: `1px solid ${borderColor}`,
        borderRight: `1px solid ${borderColor}`,
      },
      initialAnimation: { opacity: 0, x: 10, y: '-50%', scale: 0.9 },
      exitAnimation: { opacity: 0, x: -5, y: '-50%', scale: 0.95 },
    },

    right: {
      containerStyle: { left: '100%', top: '50%', marginLeft: '10px' },
      containerMotion: { x: 0, y: '-50%' },
      tailStyle: {
        left: '-5px',
        top: '50%',
        marginTop: '-5px',
        borderBottom: `1px solid ${borderColor}`,
        borderLeft: `1px solid ${borderColor}`,
      },
      initialAnimation: { opacity: 0, x: -10, y: '-50%', scale: 0.9 },
      exitAnimation: { opacity: 0, x: 5, y: '-50%', scale: 0.95 },
    },
  };

  const config = posConfig[position] || posConfig.top;

  return (
    <div
      ref={anchorRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}

      <AnimatePresence>
        {isVisible && content && (
          <TN_FloatingLayer anchorRef={anchorRef}>
          <motion.div
            initial={subtle ? { ...config.containerMotion, opacity: 0 } : config.initialAnimation}
            animate={{
              opacity: 1,
              x: config.containerMotion.x,
              y: config.containerMotion.y,
              scale: 1,
            }}
            exit={{
              ...(subtle ? { ...config.containerMotion, opacity: 0 } : config.exitAnimation),
              transition: { duration: 0.25, ease: 'easeIn' },
            }}
            transition={subtle ? { duration: 0.15, ease: 'easeOut' } : {
              type: 'spring',
              stiffness: 400,
              damping: 20,
            }}
            style={{
              position: 'absolute',
              zIndex: 1000,
              pointerEvents: 'none',
              ...config.containerStyle,
            }}
          >
            <motion.div
              animate={subtle ? { y: 0 } : {
                y: [0, -3, 0],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                position: 'relative',
                background: bgColor,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: `1px solid ${borderColor}`,
                borderRadius: subtle ? '8px' : '12px',
                padding: subtle ? '6px 10px' : '8px 14px',
                color: textColor,
                fontSize: '12px',
                fontWeight: 'var(--font-weight-ui, 800)',
                whiteSpace: 'nowrap',
                boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
              }}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>
                {content}
              </span>

              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  width: '10px',
                  height: '10px',
                  background: bgColor,
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  transform: 'rotate(45deg)',
                  zIndex: 0,
                  ...config.tailStyle,
                }}
              />
            </motion.div>
          </motion.div>
          </TN_FloatingLayer>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TN_Tooltip;
