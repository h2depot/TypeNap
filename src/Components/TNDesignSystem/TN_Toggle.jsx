import { useTNTheme } from './theme';
import { motion } from 'framer-motion';

const TN_Toggle = ({ isOn, onToggle, label, 'aria-label': ariaLabel, theme: themeOverride, scale = 1, disabled = false }) => {
  const theme = useTNTheme(themeOverride);
  const borderColor = theme === 'light' ? '#232b69' : '#D4CFBF';

  return (
    <button type="button" role="switch" aria-checked={Boolean(isOn)} aria-label={ariaLabel ?? label} disabled={disabled} style={{ display: 'flex', alignItems: 'center', gap: `${12 * scale}px`, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, background: 'transparent', border: 0, padding: 0, color: 'var(--tn-text)' }} onClick={onToggle}>
      {label && <span style={{ fontSize: `${14 * scale}px`, opacity: 0.8 }}>{label}</span>}
      <div
        style={{
          width: `${50 * 1.618 * scale}px`,
          // 30px thumb + 4px padding and 6px border on each side.
          boxSizing: 'border-box',
          height: `${50 * scale}px`,
          flexShrink: 0,
          background: isOn
            ? '#85916D'
            : (theme === 'light' ? '#C9C9C9' : '#363636'),
          borderRadius: `${10 * scale}px`,
          border: `${6 * scale}px solid ${borderColor}`,
          padding: `${4 * scale}px`,
          display: 'flex',
          justifyContent: isOn ? 'flex-end' : 'flex-start',
          alignItems: 'center',
          boxShadow: isOn
            ? '0 4px 12px rgba(232, 137, 13, 0.4)'
            : theme === 'light' ? 'inset 0 2px 6px rgba(0,0,0,0.1)' : 'inset 0 2px 6px rgba(255,255,255,0.1)',
          transition: 'all 0.3s ease'
        }}
      >
        <motion.div
          layout
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30
          }}
          style={{
            width: `${30 * scale}px`,
            height: `${30 * scale}px`,
            flexShrink: 0,
            background: borderColor,
            borderRadius: `${6 * scale}px`,
            boxShadow: theme === 'light'
              ? '0 2px 6px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)'
              : '0 2px 6px rgba(255,255,255,0.15), 0 1px 3px rgba(255,255,255,0.1)'
          }}
        />
      </div>
    </button>
  );
};

export default TN_Toggle;
