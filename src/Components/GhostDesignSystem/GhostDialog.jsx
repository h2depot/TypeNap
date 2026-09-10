import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const GhostDialog = ({ isOpen, onClose, title, children, maxWidth = '500px' }) => {
  const { t } = useTranslation();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleCloseDialogs = () => {
        onCloseRef.current?.();
      };

      window.addEventListener('close-dialogs', handleCloseDialogs);
      
      return () => {
        document.body.style.overflow = previousOverflow;
        window.removeEventListener('close-dialogs', handleCloseDialogs);
      };
    }
  }, [isOpen]);

  const bgColor = 'var(--ghost-dialog-bg)';
  const textColor = 'var(--ghost-text)';

  const borderColor = 'var(--ghost-border)';

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px'
          }}
        >
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

          {/* A single soft edge separates the dialog from the backdrop. */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: maxWidth,
              background: borderColor,
              padding: '1px',
              borderRadius: '21px',
              maxHeight: 'calc(100dvh - 40px)',
              display: 'flex',
              boxShadow: 'var(--ghost-shadow-large)',
              zIndex: 1,
            }}
          >
            {/* Inner Dialog Content */}
            <div style={{
              background: bgColor,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '20px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              minHeight: 0,
            }}>
              {/* Header */}
              <div style={{
                padding: '24px',
                flexShrink: 0,
                gap: '16px',
                borderBottom: '1px solid var(--ghost-stroke)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <h2 style={{
                  margin: 0,
                  color: textColor,
                  fontSize: '20px',
                  fontWeight: 600,
                }}>
                  {title}
                </h2>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  aria-label={t("common.closeDialog")}
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

export default GhostDialog;
