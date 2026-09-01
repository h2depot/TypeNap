import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';


export const SpiritListView = ({ children, width = '100%', maxWidth = '800px', gap = '14px', ...props }) => {

  return (
    <div
      style={{
        width: width,
        maxWidth: maxWidth,
        display: 'flex',
        flexDirection: 'column',
        gap: gap,
        margin: '16px auto',
      }}
      {...props}
    >
      {children}
    </div>
  );
};


export const SpiritListItem = ({
  icon,
  title,
  description,
  control,
  onClick,
  disabled = false,
  ...props
}) => {
  const isClickable = !!onClick;

  const textColor = 'var(--ghost-text)';
  const subTextColor = 'var(--ghost-subtext)';

  const gradient = 'var(--ghost-gradient)';

  const hoverBg = 'var(--ghost-list-item-bg)';

  return (
    <motion.div
      initial="initial"
      whileHover={!disabled ? "hover" : undefined}
      whileTap={(isClickable && !disabled) ? "tap" : undefined}
      variants={{
        initial: {
          y: 0,
          scale: 1,
          backgroundColor: 'var(--ghost-list-item-bg)',
          zIndex: 1,
        },
        hover: {
          y: -1,
          scale: 1.01,
          backgroundColor: hoverBg,
          zIndex: 10,
        },
        tap: {
          y: -1,
          scale: 0.99,
        }
      }}
      transition={{
        type: "spring", stiffness: 400, damping: 30,
        scale: { type: "tween", duration: 0.15, ease: "easeOut" }
      }}
      onClick={(e) => {
        if (disabled) {
          return;
        }
        if (isClickable && onClick) {
          onClick(e);
        }
      }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 24px',
        borderRadius: '20px',
        border: 'var(--ghost-list-item-border)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        cursor: isClickable ? 'pointer' : 'default',
        opacity: disabled ? 0.45 : 1,
        pointerEvents: 'auto',
        userSelect: 'none',
        gap: '20px',
        ...props.style,
      }}
      {...Object.keys(props).reduce((acc, key) => {
        if (key !== 'style') acc[key] = props[key];
        return acc;
      }, {})}
    >
      <motion.div
        variants={{
          initial: { opacity: 0 },
          hover: { opacity: 1 }
        }}
        transition={{ duration: 0.25 }}
        style={{
          position: 'absolute',
          inset: '-1px', 
          borderRadius: '20px',
          padding: '2px',
          background: gradient,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          pointerEvents: 'none',
          zIndex: 10
        }}
      />


      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        {icon && (
          <motion.div
            variants={{
              initial: { rotate: 0, scale: 1 },
              hover: { rotate: [0, -8, 8, 0], scale: 1.08 }
            }}
            transition={{ duration: 0.35 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'var(--ghost-hover-bg)',
              color: textColor,
              flexShrink: 0,
            }}
          >
            {icon}
          </motion.div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          {title && (
            <span style={{
              fontSize: '16px',
              fontWeight: 700,
              color: textColor,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {title}
            </span>
          )}
          {description && (
            <span style={{
              fontSize: '13px',
              color: subTextColor,
              lineHeight: 1.4,
            }}>
              {description}
            </span>
          )}
        </div>
      </div>

      <div
        style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, position: 'relative', zIndex: 11 }}
        onClick={(e) => {
          if (control) {
            e.stopPropagation();
          }
        }}
      >
        {control && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {control}
          </div>
        )}

        {isClickable && (
          <motion.div
            variants={{
              initial: { x: 0 },
              hover: { x: 4 }
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{ color: subTextColor, display: 'flex', alignItems: 'center' }}
          >
            <ChevronRight size={18} />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
