import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const GhostURLField = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  icon,
  isBookmarked: controlledIsBookmarked,
  onBookmarkToggle,
  showBookmarkButton = true,
  bookmarkDisabled = false,
  borderRadius = '16px',
  width = '100%',
  onFocus,
  onBlur,
  onMouseDown,
  style,
  className = '',
  ...props
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("common.inputPlaceholder");
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [internalIsBookmarked, setInternalIsBookmarked] = useState(false);
  const inputRef = useRef(null);

  const isBookmarked = controlledIsBookmarked !== undefined ? controlledIsBookmarked : internalIsBookmarked;

  const bgColor = 'var(--ghost-bg)';
  const borderColor = 'var(--ghost-border)';
  const textColor = 'var(--ghost-text)';
  const gradient = 'var(--ghost-gradient)';

  const handleFocus = (event) => {
    setIsFocused(true);
    event.currentTarget.select();
    onFocus?.(event);
  };

  const handleBlur = (event) => {
    setIsFocused(false);
    event.currentTarget.scrollLeft = 0;
    onBlur?.(event);
  };

  const handleMouseDown = (event) => {
    onMouseDown?.(event);
    if (!event.defaultPrevented && event.button === 0 && document.activeElement !== event.currentTarget) {
      // Prevent the first click from collapsing the selection made on focus.
      event.preventDefault();
      event.currentTarget.focus();
    }
  };

  const handleBookmarkClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled || bookmarkDisabled) return;

    const nextState = !isBookmarked;
    if (controlledIsBookmarked === undefined) {
      setInternalIsBookmarked(nextState);
    }
    onBookmarkToggle?.(nextState, event);
  };

  return (
    <div style={{ width: width, position: 'relative', boxSizing: 'border-box' }}>
      <motion.div
        animate={{
          y: 0,
          scale: 1,
          boxShadow: isFocused
            ? '0 0 0 2px var(--ghost-focus)'
            : isHovered
              ? 'var(--ghost-shadow-input-focus)'
              : 'var(--ghost-shadow-input)',
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        style={{
          position: 'relative',
          borderRadius: borderRadius,
          padding: '1px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          transition: 'box-shadow 0.3s ease',
        }}
      >
        {/* Solid Border Background */}
        <div style={{ position: 'absolute', inset: 0, background: borderColor, zIndex: 0 }} />

        {/* Gradient Border Background (Fades in on hover / full on focus) */}
        <motion.div
          animate={{
            opacity: isFocused ? 1 : isHovered ? 0.5 : 0
          }}
          transition={{ duration: 0.25 }}
          style={{ position: 'absolute', inset: 0, background: gradient, zIndex: 0 }}
        />

        {/* Inner Container */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            background: bgColor,
            borderRadius: `calc(${borderRadius} - 1px)`,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            gap: '8px',
            transition: 'background-color 0.3s ease',
          }}
        >
          {icon && (
            <div style={{ display: 'flex', alignItems: 'center', color: textColor, opacity: 0.7 }}>
              {icon}
            </div>
          )}

          <input
            {...props}
            ref={inputRef}
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={onChange}
            placeholder={resolvedPlaceholder}
            disabled={disabled}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onMouseDown={handleMouseDown}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              color: (!isFocused && value) ? 'var(--ghost-placeholder, rgba(128,128,128,0.6))' : textColor,
              fontWeight: 500,
              fontSize: '13px',
              lineHeight: '20px',
              fontFamily: 'inherit',
              padding: 0,
              margin: 0,
              width: '100%',
              textOverflow: isFocused ? 'clip' : 'ellipsis',
              transition: 'color 0.2s ease',
              ...style,
            }}
            className={`ghost-url-field-input ${className}`}
          />

          {showBookmarkButton && (
            <div style={{ flex: '0 0 18px', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <motion.button
                type="button"
                disabled={disabled || bookmarkDisabled}
                aria-pressed={isBookmarked}
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleBookmarkClick}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.85 }}
                animate={{
                  scale: isBookmarked ? [0.85, 1.2, 1] : 1,
                  rotate: isBookmarked ? [0, -15, 15, 0] : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 15,
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  cursor: disabled || bookmarkDisabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: '0 0 18px',
                  width: '18px',
                  height: '18px',
                  color: isBookmarked ? 'var(--ghost-star-active, #f59e0b)' : textColor,
                  opacity: isBookmarked ? 1 : isHovered ? 0.75 : 0.35,
                  outline: 'none',
                  transition: 'color 0.2s ease, opacity 0.2s ease',
                  filter: isBookmarked ? 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.45))' : 'none',
                }}
                aria-label={isBookmarked ? t("common.removeBookmark", "ブックマークを解除") : t("common.addBookmark", "ブックマークに追加")}
                title={isBookmarked ? t("common.removeBookmark", "ブックマークを解除") : t("common.addBookmark", "ブックマークに追加")}
              >
                <Star
                  size={14}
                  strokeWidth={2}
                  fill={isBookmarked ? 'currentColor' : 'none'}
                />
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>

      <style>{`
        .ghost-url-field-input::placeholder {
          color: var(--ghost-placeholder) !important;
          opacity: 1;
        }
        .ghost-url-field-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default GhostURLField;
