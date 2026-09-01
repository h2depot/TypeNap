import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

const THUMB_SIZE = 36;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeValue = (value, min, max) => {
  const numericValue = Number(value);
  return clamp(Number.isFinite(numericValue) ? numericValue : min, min, max);
};

const GhostSlider = ({ min = 0, max = 100, value: propValue, defaultValue = 50, onChange }) => {
  const [value, setValue] = useState(() => normalizeValue(propValue ?? defaultValue, min, max));
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (propValue !== undefined) {
      setValue(normalizeValue(propValue, min, max));
    }
  }, [propValue, min, max]);
  const constraintsRef = useRef(null);
  const thumbPath = "M6 30C6 16.7452 16.7452 6 30 6H82C95.2548 6 106 16.7452 106 30V95.5723C106 101.331 101.331 106 95.5723 106C92.658 106 89.8767 104.78 87.9023 102.637L82.25 96.5C77.5382 91.3844 69.4618 91.3844 64.75 96.5C60.0382 101.616 51.9618 101.616 47.25 96.5C42.5382 91.3844 34.4618 91.3844 29.75 96.5L24.0977 102.637C22.1233 104.78 19.342 106 16.4276 106C10.6686 106 6 101.331 6 95.5723V30Z";

  const x = useMotionValue(0);
  const [trackWidth, setTrackWidth] = useState(0);

  // Derive width for progress bar natively
  const travelWidth = Math.max(0, trackWidth - THUMB_SIZE);
  const fillWidth = useTransform(x, (v) => `${Math.max(0, v) + THUMB_SIZE / 2}px`);

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
      const range = max - min;
      const percentage = range > 0 ? (normalizeValue(value, min, max) - min) / range : 0;
      x.set(percentage * travelWidth);
    }
  }, [value, min, max, trackWidth, travelWidth, isDragging, x]);

  const handleDrag = (event, info) => {
    if (travelWidth > 0) {
      // Calculate new value based on native x
      const currentX = x.get();
      const newPercent = clamp((currentX / travelWidth) * 100, 0, 100);
      const newValue = Math.round((newPercent / 100) * (max - min) + min);
      setValue(newValue);
      if (onChange) onChange(newValue);
    }
  };

  const handleClickTrack = (e) => {
    if (constraintsRef.current) {
      const rect = constraintsRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left - THUMB_SIZE / 2;
      const newPercent = travelWidth > 0 ? clamp((clickX / travelWidth) * 100, 0, 100) : 0;
      const newValue = Math.round((newPercent / 100) * (max - min) + min);
      const clampedValue = Math.max(min, Math.min(max, newValue));
      setValue(clampedValue);
      if (onChange) onChange(clampedValue);
    }
  };

  const handleKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextValue = event.key === 'Home'
      ? min
      : event.key === 'End'
        ? max
        : normalizeValue(value + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1), min, max);
    setValue(nextValue);
    onChange?.(nextValue);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '40px',
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
          height: '8px',
          background: 'rgba(110, 142, 251, 0.1)',
          borderRadius: '10px',
          position: 'relative',
        }}
      >
        {/* Native Progress Fill */}
        <motion.div
          style={{
            width: fillWidth,
            height: '100%',
            background: 'var(--ghost-gradient)',
            borderRadius: '10px'
          }}
        />

        {/* Thumb & Value Bubble */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: travelWidth }}
          dragElastic={0}
          dragMomentum={false}
          onDrag={handleDrag}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={handleKeyDown}
          role="slider"
          tabIndex={0}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          style={{
            x, // Native MotionValue binding!
            position: 'absolute',
            top: '50%',
            marginTop: '-18px', // Center vertically (half of 36px)
            left: 0,
            width: `${THUMB_SIZE}px`,
            height: `${THUMB_SIZE}px`,
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
              y: isDragging ? -45 : -35,
              scale: isDragging ? 1.2 : 1,
              rotate: isDragging ? [0, 5, -5, 0] : 0
            }}
            transition={{
              y: { type: "spring", stiffness: 400, damping: 20 },
              rotate: { repeat: Infinity, duration: 2, ease: "easeInOut" }
            }}
            style={{
              position: 'absolute',
              width: '32px',
              height: '32px',
              background: 'var(--ghost-border)',
              borderRadius: '50% 50% 50% 5px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'var(--ghost-bg)',
              fontSize: '12px',
              fontWeight: 'bold',
              boxShadow: 'var(--ghost-shadow)',
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
                ? 'var(--ghost-slider-drag-shadow)'
                : isHovering
                  ? 'var(--ghost-slider-hover-shadow)'
                  : 'var(--ghost-slider-normal-shadow)'
            }}
            transition={{
              scale: { type: "spring", stiffness: 400, damping: 40 },
              filter: { duration: 0.2 }
            }}
            onHoverStart={() => setIsHovering(true)}
            onHoverEnd={() => setIsHovering(false)}
            style={{
              width: '36px',
              height: '36px',
              cursor: isDragging ? 'grabbing' : 'grab',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              filter: 'var(--ghost-slider-normal-shadow)'
            }}
          >
            <svg viewBox="0 0 112 112" style={{ width: '100%', height: '100%' }} aria-hidden="true">
              <path d={thumbPath} fill="var(--ghost-bg)" stroke="var(--ghost-border)" strokeWidth="12" strokeLinejoin="round" />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default GhostSlider;
