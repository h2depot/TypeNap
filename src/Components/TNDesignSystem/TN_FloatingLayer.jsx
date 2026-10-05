import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Escape ancestor stacking contexts and overflow clipping while retaining React context.
export default function TN_FloatingLayer({ anchorRef, children, interactive = false, placement = 'auto' }) {
  const layerRef = useRef(null);

  useLayoutEffect(() => {
    let frame;
    const update = () => {
      const anchor = anchorRef.current;
      const layer = layerRef.current;
      if (anchor && layer) {
        const rect = anchor.getBoundingClientRect();
        Object.assign(layer.style, {
          left: `${rect.left}px`, top: `${rect.top}px`,
          width: `${rect.width}px`, height: `${rect.height}px`,
        });
        const below = window.innerHeight - rect.bottom - 16;
        const above = rect.top - 16;
        const flip = placement === 'auto' && below < 240 && above > below;
        layer.style.setProperty('--tn-popup-top', flip ? 'auto' : '100%');
        layer.style.setProperty('--tn-popup-bottom', flip ? 'calc(100% + 16px)' : 'auto');
        layer.style.setProperty('--tn-popup-max-height', `${Math.max(0, flip ? above : below)}px`);
      }
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [anchorRef, placement]);

  return createPortal(
    <div ref={layerRef} data-tn-floating-layer
      onClick={interactive ? (event) => event.stopPropagation() : undefined}
      style={{ position: 'fixed', zIndex: 11000, pointerEvents: 'none' }}>
      {children}
    </div>,
    document.body,
  );
}
