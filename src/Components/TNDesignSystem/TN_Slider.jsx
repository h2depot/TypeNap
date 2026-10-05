import { useTranslation } from 'react-i18next';
import { useTNTheme } from './theme';
import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

const TN_Slider = ({ min = 0, max = 100, value: propValue, defaultValue = 50, onChange, theme: themeOverride, scale = 1, 'aria-label': ariaLabel }) => {
  const theme = useTNTheme(themeOverride);
  const { t } = useTranslation();
  const clamp = (v) => Math.min(max, Math.max(min, Number.isFinite(Number(v)) ? Number(v) : min));
  const [localValue, setValue] = useState(() => clamp(defaultValue));
  const value = clamp(propValue ?? localValue);
  const changeValue = (next) => { const bounded = clamp(next); setValue(bounded); onChange?.(bounded); };
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const constraintsRef = useRef(null);

  const x = useMotionValue(0);
  const [trackWidth, setTrackWidth] = useState(0);

  // Derive width for progress bar natively
  const fillWidth = useTransform(x, (v) => `${Math.max(0, v)}px`);


  // Track the width of the container
  useEffect(() => {
    if (constraintsRef.current) {
      setTrackWidth(constraintsRef.current.offsetWidth);
      const observer = new ResizeObserver((entries) => {
        setTrackWidth(entries[0].contentRect.width);
      });
      observer.observe(constraintsRef.current);
      return () => observer.disconnect();
    }
  }, []);

  // Sync state -> Native x (only when NOT dragging)
  useEffect(() => {
    if (!isDragging && trackWidth > 0) {
      const percentage = max > min ? (value - min) / (max - min) : 0;
      x.set(percentage * trackWidth);
    }
  }, [value, min, max, trackWidth, isDragging, x]);

  const handleDrag = (event, info) => {
    if (trackWidth > 0) {
      // Calculate new value based on native x
      const currentX = x.get();
      const newPercent = Math.max(0, Math.min(100, (currentX / trackWidth) * 100));
      const newValue = Math.round((newPercent / 100) * (max - min) + min);
      changeValue(newValue);
    }
  };

  const handleClickTrack = (e) => {
    if (!isDragging && constraintsRef.current) {
      const rect = constraintsRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const newPercent = rect.width > 0 ? (clickX / rect.width) * 100 : 0;
      const newValue = Math.round((newPercent / 100) * (max - min) + min);
      changeValue(newValue);
    }
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={ariaLabel ?? t('settings.fontSize.title')}
      onKeyDown={(event) => {
        const next = { ArrowRight: value + 1, ArrowUp: value + 1, ArrowLeft: value - 1, ArrowDown: value - 1, Home: min, End: max }[event.key];
        if (next !== undefined) { event.preventDefault(); changeValue(next); }
      }}
      style={{
        width: '100%',
        height: `${40 * scale}px`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      onClick={handleClickTrack}
    >
      {/* Background Track (also constraints) */}
      <div
        ref={constraintsRef}
        style={{
          width: '100%',
          height: `${8 * scale}px`,
          background: 'rgba(232, 137, 13, 0.1)',
          borderRadius: '10px',
          position: 'relative',
        }}
      >
        {/* Native Progress Fill */}
        <motion.div
          style={{
            width: fillWidth,
            height: '100%',
            background: '#E8890D',
            borderRadius: '10px'
          }}
        />

        {/* Thumb & Value Bubble */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: trackWidth }}
          dragElastic={0}
          dragMomentum={false}
          onDrag={handleDrag}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
          style={{
            x, // Native MotionValue binding!
            position: 'absolute',
            top: '50%',
            marginTop: `${-15 * scale}px`, // Center the thumb on the track
            left: 0,
            marginLeft: `${-15 * scale}px`, // Keep the thumb centered on its value
            width: `${30 * scale}px`,
            height: `${30 * scale}px`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 15,
          }}
        >
          {/* Value Bubble (Floating above) */}
          <motion.div
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{
              opacity: isDragging ? 1 : 0.8,
              y: (isDragging ? -45 : -35) * scale,
              scale: isDragging ? 1.2 : 1,
              rotate: isDragging ? [0, 5, -5, 0] : 0
            }}
            transition={{
              y: { type: "spring", stiffness: 400, damping: 20 },
              rotate: { repeat: Infinity, duration: 2, ease: "easeInOut" }
            }}
            style={{
              position: 'absolute',
              width: `${32 * scale}px`,
              height: `${32 * scale}px`,
              background: theme === 'light'
                ? '#232b69'
                : '#D4CFBF',
              borderRadius: '50% 50% 50% 5px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: theme === 'light' ? '#D4CFBF' : '#232b69',
              fontSize: `${12 * scale}px`,
              fontWeight: 'var(--font-weight-ui, 800)',
              boxShadow: '0 4px 15px rgba(232, 137, 13, 0.4)',
              transform: 'rotate(-45deg)',
            }}
          >
            <span style={{ transform: 'rotate(45deg)' }}>{value}</span>
          </motion.div>

          {/* The Actual Thumb */}
          <motion.div
            animate={{
              scale: isDragging ? 0.9 : isHovering ? 1.1 : 1,
              filter: isDragging
                ? (theme === 'light' ? 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' : 'drop-shadow(0 1px 3px rgba(255,255,255,0.3))')
                : isHovering
                  ? (theme === 'light' ? 'drop-shadow(0 6px 12px rgba(0,0,0,0.25))' : 'drop-shadow(0 6px 12px rgba(255,255,255,0.25))')
                  : (theme === 'light' ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))' : 'drop-shadow(0 2px 6px rgba(255,255,255,0.15))')
            }}
            transition={{
              scale: { type: "spring", stiffness: 400, damping: 40 },
              filter: { duration: 0.2 }
            }}
            onHoverStart={() => setIsHovering(true)}
            onHoverEnd={() => setIsHovering(false)}
            style={{
              width: `${30 * scale}px`,
              height: `${30 * scale}px`,
              boxSizing: 'border-box',
              borderRadius: `${6 * scale}px`,
              background: theme === 'light' ? '#232b69' : '#D4CFBF',
              border: `${3 * scale}px solid ${theme === 'light' ? '#D4CFBF' : '#232b69'}`,
              cursor: isDragging ? 'grabbing' : 'grab',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              filter: theme === 'light' ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))' : 'drop-shadow(0 2px 6px rgba(255,255,255,0.15))'
            }}
          />
        </motion.div>
      </div>
    </div>
  );
};

export default TN_Slider;
