import { createElement, forwardRef, useId } from 'react';

// Keep fills and the individual stroke widths from the original artwork.
export default function createOriginalIcon(name, nodes, canvasSize = 24) {
  const Icon = forwardRef(function OriginalIcon({
    size = canvasSize,
    color = 'currentColor',
    strokeWidth,
    absoluteStrokeWidth = false,
    className = '',
    children,
    ...props
  }, ref) {
    const instanceId = useId();
    const renderNode = ([tag, attributes, descendants = []], index) => {
      const attrs = { ...attributes, key: index };
      if (attrs.id) attrs.id = `${instanceId}-${attrs.id}`;
      for (const reference of ['clipPath', 'mask']) {
        if (attrs[reference]) {
          attrs[reference] = attrs[reference].replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${instanceId}-${id})`);
        }
      }
      if (attrs.strokeWidth !== undefined) {
        const width = strokeWidth ?? attrs.strokeWidth;
        attrs.strokeWidth = absoluteStrokeWidth && Number(size) > 0
          ? Number(width) * canvasSize / Number(size)
          : width;
      }
      return createElement(tag, attrs, ...descendants.map(renderNode));
    };
    const hasLabel = props['aria-label'] || props['aria-labelledby'] || props.role || children;
    // Forward the ref to the SVG element; createElement never reads ref.current.
    return createElement('svg', {
      ref,
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: `0 0 ${canvasSize} ${canvasSize}`,
      fill: 'none',
      stroke: 'none',
      color,
      className: `original-icon original-icon-${name}${className ? ` ${className}` : ''}`,
      'aria-hidden': hasLabel ? undefined : true,
      focusable: 'false',
      ...props,
    }, ...nodes.map(renderNode), children);
  });
  Icon.displayName = name;
  return Icon;
}
