import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { normalizeImagePath } from '../utils/imagePaths.js';

export function photoSource(path) {
    const normalized = normalizeImagePath(path);
    if (!normalized || /^(https?:|data:|blob:|asset:|\/\/)/i.test(normalized)) return normalized;
    return isTauri() ? convertFileSrc(normalized) : normalized;
}
