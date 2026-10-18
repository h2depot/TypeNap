import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImagePath, photoPaths, validImagePaths } from './imagePaths.js';

test('old image references migrate on Windows and POSIX without changing other paths or colours', () => {
    assert.equal(normalizeImagePath('C:\\data\\BgImage\\user\\portrait.png'), 'C:\\data\\Image\\user\\portrait.png');
    assert.equal(normalizeImagePath('/data/BgImage/presets/landscape.jpg'), '/data/Image/presets/landscape.jpg');
    for (const value of ['#123456', 'var(--theme-red)', '/data/BgImage/unrelated/file.png', '/data/Image/user/portrait.png']) {
        assert.equal(normalizeImagePath(value), value);
    }
    const duplicate = ['C:\\data\\BgImage\\user\\portrait.png', 'C:\\data\\Image\\user\\portrait.png'];
    assert.equal(validImagePaths(duplicate), false);
    assert.deepEqual(photoPaths(duplicate), ['C:\\data\\Image\\user\\portrait.png']);
});
