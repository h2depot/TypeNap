import React from 'react';
import { motion } from 'framer-motion';

const SpiritCard = ({ children, title, style = {} }) => {
  const gradient = 'var(--ghost-gradient)';

  return (
    <motion.div
      initial="initial"
      animate="animate"
      whileHover="hover"
      variants={{
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        hover: { y: 0 }
      }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        position: 'relative',
        background: 'var(--ghost-card-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '24px',
        border: 'var(--ghost-card-border)',
        padding: '24px',
        boxShadow: 'var(--ghost-shadow, 0 4px 16px rgba(0, 0, 0, 0.1))',
        color: 'var(--ghost-text)',
        maxWidth: '300px',
        margin: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        ...style
      }}
    >
      <motion.div
        variants={{
          initial: { opacity: 0 },
          animate: { opacity: 0 },
          hover: { opacity: 1 }
        }}
        transition={{ duration: 0.25 }}
        style={{
          position: 'absolute',
          inset: '-1px',
          borderRadius: '24px', 
          padding: '2px',
          background: gradient,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          pointerEvents: 'none',
          zIndex: 10
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'center' }}>
        {title && <h3 style={{ margin: 0, fontSize: '20px', color: '#a777e3' }}>{title}</h3>}
        <div style={{ fontSize: '15px', lineHeight: '1.6', opacity: 0.9, display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {children}
        </div>
      </div>
    </motion.div>
  );
};

export default SpiritCard;
