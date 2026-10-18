import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutImages, selectImages } from './imageGallery.js';

const images = Array.from({ length: 9 }, (_, index) => ({ name: `photo${index + 1}.png`, path: `/images/${index}.png`, kind: 'user' }));
const dimensions = Object.fromEntries(images.map((image, index) => [image.path, { width: 100, height: [200, 50, 150, 100, 50, 100, 200, 100, 50][index] }]));

test('starts left to right, then fills the shortest column using each image aspect ratio', () => {
    const { items, height } = layoutImages(images, dimensions, 448);
    assert.deepEqual(items.slice(0, 4).map(item => [item.x, item.y, item.width, item.imageHeight]), [
        [0, 0, 100, 200], [116, 0, 100, 50], [232, 0, 100, 150], [348, 0, 100, 100],
    ]);
    assert.deepEqual(items.slice(4, 7).map(item => [item.column, item.y]), [[1, 124], [3, 174], [2, 224]]);
    assert.equal(height, 482);
    assert.deepEqual(items.map(item => item.image.path), images.map(image => image.path), 'DOM order follows the sort order');
});

test('equal heights choose the leftmost column, even with fewer than four images', () => {
    const result = layoutImages(images, {}, 448);
    assert.deepEqual(result.items.map(item => item.column), [0, 1, 2, 3, 0, 1, 2, 3, 0]);
    assert.equal(layoutImages(images.slice(0, 2), {}, 448).height, 158);
    assert.deepEqual(layoutImages([], {}, 448), { items: [], height: 0 });
    assert.deepEqual(layoutImages(images, dimensions, 0), { items: [], height: 0 });
});

test('resizing and filtering reflow into four columns without overlaps or trailing space', () => {
    for (const width of [320, 448, 900, 1920]) {
        for (const list of [images, images.filter((_, index) => index % 2 === 0)]) {
            const { items, height } = layoutImages(list, dimensions, width);
            assert.ok(Math.abs(items[3].x + items[3].width - width) < 1e-8);
            for (const item of items) {
                assert.ok(Number.isFinite(item.height) && item.height > 0);
                assert.ok(item.y + item.height <= height);
                for (const other of items) {
                    if (other === item || other.column !== item.column) continue;
                    assert.ok(other.y >= item.y + item.height + 16 || item.y >= other.y + other.height + 16);
                }
            }
            assert.equal(Math.max(...items.map(item => item.y + item.height)), height);
        }
    }
});

test('unreadable dimensions reserve a square and loaded dimensions reflow in input order', () => {
    const broken = { [images[0].path]: { width: 0, height: 0 }, [images[1].path]: { width: 1, height: 1, failed: true } };
    assert.equal(layoutImages(images, broken, 448).items[0].imageHeight, 100);
    const forward = Object.fromEntries(Object.entries(dimensions));
    const backward = Object.fromEntries(Object.entries(dimensions).reverse());
    assert.deepEqual(layoutImages(images, forward, 448), layoutImages(images, backward, 448));
});

test('searches normalized names across user and preset images without changing the shared collection', () => {
    const collection = [
        { name: 'ＰＨＯＴＯ10.png', kind: 'user', path: '/10' },
        { name: 'photo2.png', kind: 'user', path: '/2' },
        { name: 'photo1.png', kind: 'preset', path: '/1' },
        { name: 'portrait.png', kind: 'user', path: '/portrait' },
    ];
    const original = [...collection];
    assert.deepEqual(selectImages(collection, { query: ' photo ' }).map(image => image.path), ['/1', '/2', '/10']);
    assert.deepEqual(selectImages(collection, { query: 'missing' }), []);
    assert.deepEqual(collection, original);
});

test('sorts by name or filesystem dates, with a stable tie break and both directions', () => {
    const collection = [
        { name: 'photo10.png', path: '/b', created_at: 30, last_update: 10 },
        { name: 'photo2.png', path: '/c', created_at: 10, last_update: 20 },
        { name: 'photo2.png', path: '/a', created_at: 20, last_update: 20 },
    ];
    const paths = options => selectImages(collection, options).map(image => image.path);
    assert.deepEqual(paths(), ['/a', '/c', '/b']);
    assert.deepEqual(paths({ ascending: false }), ['/b', '/c', '/a']);
    assert.deepEqual(paths({ sortBy: 'created' }), ['/c', '/a', '/b']);
    assert.deepEqual(paths({ sortBy: 'updated', ascending: false }), ['/c', '/a', '/b']);
});
