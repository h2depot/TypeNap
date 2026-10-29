import './TN_Selection.css';
import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Escape ancestor stacking contexts and overflow clipping while retaining React context.
export default function TN_FloatingLayer({ anchorRef, children, interactive = false, placement = 'auto', popupWidth = 320 }) {
  const layerRef = useRef(null);

  useLayoutEffect(() => {
    let frame;
    const update = () => {
      const anchor = anchorRef.current;
      const layer = layerRef.current;
      if (anchor && layer) {
        const rect = anchor.getBoundingClientRect();
        if (placement === 'right') {
          const width = Math.min(popupWidth, window.innerWidth - 24);
          const height = Math.min(420, window.innerHeight - 24);
          const left = rect.right + width + 4 <= window.innerWidth - 12 ? rect.right + 4 : rect.left - width - 4;
          const panelHeight = Math.min(height, layer.querySelector('[data-tn-popup-panel]')?.offsetHeight ?? height);
          const top = Math.max(12, Math.min(rect.top, window.innerHeight - panelHeight - 12));
          Object.assign(layer.style, {
            left: `${Math.max(12, Math.min(left, window.innerWidth - width - 12))}px`,
            top: `${top}px`, width: `${width}px`, height: '0px',
          });
          layer.style.setProperty('--tn-popup-top', '0px');
          layer.style.setProperty('--tn-popup-bottom', 'auto');
          layer.style.setProperty('--tn-popup-max-height', `${height}px`);
          frame = requestAnimationFrame(update);
          return;
        }
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
        // Compact navigation can anchor a wide dropdown near the left edge.
        const popup = layer.querySelector('[data-tn-popup-panel]');
        if (popup) {
          const popupLeft = rect.right - popup.offsetWidth;
          const clampedLeft = Math.max(12, Math.min(popupLeft, window.innerWidth - popup.offsetWidth - 12));
          layer.style.left = `${rect.left + clampedLeft - popupLeft}px`;
        }
      }
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [anchorRef, placement, popupWidth]);

  return createPortal(
    <div data-tn-ui ref={layerRef} data-tn-floating-layer
      onClick={interactive ? (event) => event.stopPropagation() : undefined}
      style={{ position: 'fixed', zIndex: 11000, pointerEvents: 'none' }}>
      {children}
    </div>,
    document.body,
  );
}
