import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const TN_DialogErrorHandling = ({ isOpen, title, children, maxWidth = '500px' }) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="initialization-error-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.72)',
              backdropFilter: 'blur(4px)',
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth,
              background: 'var(--tn-gradient)',
              padding: '4px',
              borderRadius: '24px',
              boxShadow: 'var(--tn-shadow-large)',
              zIndex: 1,
            }}
          >
            <div style={{
              background: 'var(--tn-dialog-bg)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '20px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
            }}>
              <div style={{
                padding: '20px 24px',
                borderBottom: '2px solid var(--tn-border-light)',
              }}>
                <h2 id="initialization-error-title" style={{
                  margin: 0,
                  color: 'var(--tn-text)',
                  fontSize: '20px',
                  fontWeight: 'var(--font-weight-ui)',
                }}>
                  {title}
                </h2>
              </div>

              <div style={{
                padding: '24px',
                color: 'var(--tn-text)',
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

export default TN_DialogErrorHandling;
