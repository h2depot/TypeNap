import { useTranslation } from 'react-i18next';
import { useTNTheme } from './theme';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from '../../assets/IconList';

const TN_TextField = ({
  value,
  onChange,
  placeholder,
  onFocus,
  onBlur,
  theme: themeOverride,
  disabled = false,
  icon, // 左側に置くアイコン (例: <Search size={18} /> など)
  showClearButton = true,
  borderRadius = '16px',
  width = '100%',
  ...props
}) => {
  const theme = useTNTheme(themeOverride);
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef(null);

  const bgColor = theme === 'light' ? '#C9C9C9' : '#363636';
  const borderColor = theme === 'light' ? '#232b69' : '#D4CFBF';
  const textColor = theme === 'light' ? '#232b69' : '#D4CFBF';
  const placeholderColor = theme === 'light' ? 'rgba(35, 43, 105, 0.4)' : 'rgba(212, 207, 191, 0.4)';

  const accentColor = '#E8890D';

  const glowColor = 'rgba(232, 137, 13, 0.4)';

  const handleClear = () => {
    if (onChange) {
      onChange({ target: { value: '' } });
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div style={{ width: width, position: 'relative' }}>
      <motion.div
        animate={{
          y: isFocused ? -2 : 0,
          boxShadow: isFocused
            ? `0 8px 24px ${glowColor}`
            : isHovered
              ? (theme === 'light' ? '0 4px 12px rgba(0,0,0,0.08)' : '0 4px 12px rgba(0,0,0,0.25)')
              : (theme === 'light' ? '0 2px 6px rgba(0,0,0,0.05)' : '0 2px 6px rgba(0,0,0,0.15)'),
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        style={{
          position: 'relative',
          borderRadius: borderRadius,
          padding: '4px', // 外枠の太さ（グラデーション境界線）
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          transition: 'box-shadow 0.3s ease',
        }}
      >
        {/* Solid Border Background */}
        <div style={{ position: 'absolute', inset: 0, background: borderColor, zIndex: 0 }} />

        {/* Accent Border Background (Fades in on hover / full on focus) */}
        <motion.div
          animate={{
            opacity: isFocused ? 1 : isHovered ? 0.5 : 0
          }}
          transition={{ duration: 0.25 }}
          style={{ position: 'absolute', inset: 0, background: accentColor, zIndex: 0 }}
        />

        {/* Inner Container */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            background: bgColor,
            borderRadius: `calc(${borderRadius} - 4px)`,
            padding: '10px 16px',
            boxSizing: 'border-box',
            minHeight: '48px',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            gap: '10px',
            transition: 'background-color 0.3s ease',
          }}
        >
          {/* 左側のアイコン */}
          {icon && (
            <div style={{ display: 'flex', alignItems: 'center', color: textColor, opacity: 0.7 }}>
              {icon}
            </div>
          )}

          {/* インプット要素 */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder ?? t("common.inputPlaceholder")}
            disabled={disabled}
            onFocus={(event) => { setIsFocused(true); onFocus?.(event); }}
            onBlur={(event) => { setIsFocused(false); onBlur?.(event); }}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              color: textColor,
              fontWeight: 'var(--font-weight-ui, 800)',
              fontSize: '15px',
              lineHeight: '24px',
              fontFamily: 'var(--font-family-ui)',
              padding: 0,
              margin: 0,
              width: '100%',
            }}
            {...props}
          />

          {/* クリアボタン */}
          <AnimatePresence>
            {showClearButton && value && !disabled && (
              <motion.button
                type="button"
                onClick={handleClear}
                initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
                whileHover={{ scale: 1.15, rotate: [0, -10, 10, 0] }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 15,
                  rotate: { duration: 0.5 }
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '4px',
                  boxSizing: 'border-box',
                  width: '24px',
                  height: '24px',
                  flexShrink: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: textColor,
                  outline: 'none',
                }}
                title={t("common.clearInput")}
                aria-label={t("common.clearInput")}
              >
                <X size={16} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* プレースホルダーのカスタムスタイルと disabled スタイル */}
      <style>{`
        input::placeholder {
          color: ${placeholderColor} !important;
          opacity: 1;
        }
        input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default TN_TextField;
