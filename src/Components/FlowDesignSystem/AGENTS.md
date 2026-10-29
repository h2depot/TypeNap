# Animation maintenance

- The user has repeatedly requested that explicit Hover/Tap animations remain active. Do not silently disable these effects with `reducedMotion="user"`, zeroed transform variants, zero-duration transitions, or a broad CSS media-query reset. Keep any separate policy for entrance/layout motion scoped to those effects.
- Before changing an animation, inspect its ancestor MotionConfig, gesture/drag conditions, CSS selectors, media queries, and inline styles. Diagnose the actual suppression before adding overrides.
- Give each animated property on an element one owner. In RoadMap, React Flow positions the outer node, CSS transitions its reorder position, and Motion animates the inner icon. CSS handles the icon's border/background, not its transform or shadow.
- Verify explicit interaction feedback under both values of the OS reduced-motion preference. A passing build does not verify an animation. Report runtime/visual checks separately from unit tests, and do not claim an unobserved animation works.
