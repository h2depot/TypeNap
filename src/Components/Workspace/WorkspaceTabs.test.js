import test from 'node:test';
import assert from 'node:assert/strict';
import { restrictToFirstScrollableAncestor, restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { closestCenter } from '@dnd-kit/core';

test('tab drags stay inside the visible strip and keep the correct end as their drop target', () => {
    const viewport = { left: 100, right: 700, top: 0, bottom: 48, width: 600, height: 48 };
    const rects = new Map(['a', 'b', 'c'].map((id, index) => [id, {
        left: 100 + index * 200, right: 300 + index * 200,
        top: 7, bottom: 41, width: 200, height: 34,
    }]));
    for (const id of rects.keys()) {
        for (const [delta, expectedId, expectedLeft] of [[-10000, 'a', 100], [10000, 'c', 500]]) {
            const initial = rects.get(id);
            const bounded = restrictToFirstScrollableAncestor({
                draggingNodeRect: initial, scrollableAncestorRects: [viewport],
                transform: { x: delta, y: 500, scaleX: 1, scaleY: 1 },
            });
            const transform = restrictToHorizontalAxis({ transform: bounded });
            const collisionRect = {
                ...initial, left: initial.left + transform.x, right: initial.right + transform.x,
            };
            assert.equal(collisionRect.left, expectedLeft);
            assert.ok(collisionRect.right <= viewport.right, 'must stop before the add button');
            assert.equal(transform.y, 0);
            const collisions = closestCenter({
                collisionRect, droppableRects: rects,
                droppableContainers: [...rects.keys()].map(id => ({ id })),
            });
            assert.equal(collisions[0].id, expectedId, 'must not wrap to the opposite end');
        }
    }
});
