export const MAX_OBJECT_IMAGES = 3;
let imageRenames = {};
const imageKey = path => path.replaceAll('\\', '/').toLowerCase();

export function registerImageRenames(renames) { imageRenames = { ...renames }; }

// Keep references saved by older versions usable after the directory migration.
export function normalizeImagePath(path) {
    let current = typeof path === 'string'
        ? path.replace(/([\\/])BgImage([\\/])(?=user[\\/]|presets[\\/])/gi, '$1Image$2')
        : '';
    for (let index = 0; index <= Object.keys(imageRenames).length; index++) {
        const next = imageRenames[imageKey(current)];
        if (!next) return current;
        if (imageKey(current) === imageKey(next)) return next;
        current = next;
    }
    throw new Error('Cyclic image rename references');
}

export function normalizeImageContent(content) {
    try {
        const value = JSON.parse(content);
        if (!Array.isArray(value?.imagePaths)) return content;
        const paths = value.imagePaths.map(path => typeof path === 'string' ? normalizeImagePath(path) : path);
        if (paths.every((path, index) => path === value.imagePaths[index])) return content;
        return JSON.stringify({ ...value, imagePaths: paths }, null, 2);
    } catch { return content; } // Keep incomplete JSON drafts intact.
}

export function validImagePaths(paths) {
    return Array.isArray(paths) && paths.length <= MAX_OBJECT_IMAGES
        && paths.every(path => typeof path === 'string' && path.trim().length > 0)
        && new Set(paths.map(normalizeImagePath)).size === paths.length;
}

export function photoPaths(paths) {
    return [...new Set((Array.isArray(paths) ? paths : [])
        .filter(path => typeof path === 'string' && path.trim())
        .map(normalizeImagePath))].slice(0, MAX_OBJECT_IMAGES);
}
