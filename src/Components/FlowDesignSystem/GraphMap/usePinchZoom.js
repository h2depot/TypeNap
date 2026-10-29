import { useEffect, useRef } from 'react'

// React Flow's Windows wheel coefficient, with a modest pinch-only boost.
const PINCH_SENSITIVITY = 1.6

export default function usePinchZoom(instance, { minZoom, maxZoom }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !instance) return

    const onWheel = (event) => {
      // Trackpad pinches arrive as Ctrl+wheel. Leave ordinary scrolling alone.
      if (!event.ctrlKey || event.target.closest('.nowheel, .react-flow__minimap, .react-flow__controls')) return
      event.preventDefault()
      event.stopPropagation()

      const viewport = instance.getViewport()
      const coefficient = event.deltaMode === 1 ? 0.05 : event.deltaMode === 2 ? 1 : 0.002
      const platformFactor = /Mac|iPhone|iPad/.test(navigator.platform) ? 10 : 1
      const zoom = Math.min(maxZoom, Math.max(minZoom,
        viewport.zoom * 2 ** (-event.deltaY * coefficient * platformFactor * PINCH_SENSITIVITY),
      ))
      const bounds = container.getBoundingClientRect()
      const pointerX = event.clientX - bounds.left - container.clientLeft
      const pointerY = event.clientY - bounds.top - container.clientTop
      const ratio = zoom / viewport.zoom
      // Keep the graph point under the fingers stationary while scaling.
      void instance.setViewport({
        x: pointerX - (pointerX - viewport.x) * ratio,
        y: pointerY - (pointerY - viewport.y) * ratio,
        zoom,
      })
    }

    container.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => container.removeEventListener('wheel', onWheel, { capture: true })
  }, [instance, minZoom, maxZoom])

  return containerRef
}
