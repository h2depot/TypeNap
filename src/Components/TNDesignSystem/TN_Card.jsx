import { useTNTheme } from './theme';
import { motion } from 'framer-motion';

const TN_Card = ({ children, title, theme: themeOverride, style = {} }) => {
  const theme = useTNTheme(themeOverride);
  const accentColor = '#E8890D';

  return (
    <motion.div
      initial="initial"
      animate="animate"
      whileHover="hover"
      variants={{
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        hover: { y: -8 }
      }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{
        position: 'relative',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '24px',
        boxShadow: theme === 'light'
          ? '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
          : '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        color: theme === 'light' ? '#232b69' : '#D4CFBF',
        maxWidth: '300px',
        margin: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        ...style
      }}
    >
      {/* 6px Accent Border on Hover */}
      <motion.div
        variants={{
          initial: { opacity: 0 },
          animate: { opacity: 0 },
          hover: { opacity: 1 }
        }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'absolute',
          inset: '-5px', // Expand outwards so it forms a 6px border total (1px original + 5px)
          borderRadius: '29px', // 24px + 5px
          padding: '6px',
          background: accentColor,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          pointerEvents: 'none',
          zIndex: 10
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {title && <h3 style={{ margin: 0, fontSize: '20px', color: theme === 'light' ? '#232b69' : '#E8890D' }}>{title}</h3>}
        <div style={{ fontSize: '15px', lineHeight: '1.6', opacity: 0.9 }}>
          {children}
        </div>
      </div>
    </motion.div>
  );
};

export default TN_Card;
