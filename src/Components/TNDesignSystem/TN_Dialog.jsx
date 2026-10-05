import { useTranslation } from 'react-i18next';
import { useTNTheme } from './theme';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TN_Dialog = ({ isOpen, onClose, title, children, theme: themeOverride, maxWidth = '500px' }) => {
  const theme = useTNTheme(themeOverride);
  const { t } = useTranslation();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = () => onCloseRef.current?.();
    window.addEventListener('close-dialogs', close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('close-dialogs', close);
    };
  }, [isOpen]);

  const bgColor = theme === 'light' ? 'var(--light-base, #E5E5E5)' : 'var(--dark-base, #1A1A1A)';
  const textColor = theme === 'light' ? '#232b69' : '#D4CFBF';

  return (
    <AnimatePresence>
      {isOpen && (
        <div role="dialog" aria-modal="true" aria-label={title} style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Borderless dialog on the page's base color */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: maxWidth,
              maxHeight: 'calc(100dvh - 40px)',
              display: 'flex',
              background: bgColor,
              border: 'none',
              borderRadius: '24px',
              boxShadow: theme === 'light' ? '0 20px 40px rgba(0,0,0,0.2)' : '0 20px 40px rgba(0,0,0,0.5)',
              zIndex: 1,
            }}
          >
            {/* Inner Dialog Content */}
            <div style={{
              background: bgColor,
              borderRadius: '24px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              minHeight: 0,
            }}>
              {/* Header */}
              <div style={{
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <h2 style={{
                  margin: 0,
                  color: textColor,
                  fontSize: '20px',
                  fontWeight: 'var(--font-weight-ui, 800)',
                }}>
                  {title}
                </h2>
                <motion.button
                  type="button"
                  aria-label={t("common.close")}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: textColor,
                    fontSize: '24px',
                    lineHeight: 1,
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: '50%',
                  }}
                >
                  &times;
                </motion.button>
              </div>

              {/* Body */}
              <div style={{
                padding: '24px',
                color: textColor,
                fontSize: '16px',
                lineHeight: 1.5,
                maxHeight: '70vh',
                overflowY: 'auto',
              }}>
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TN_Dialog;
