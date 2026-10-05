import { convertFileSrc, isTauri } from '@tauri-apps/api/core';

export function getBookCoverStyle(coverColor) {
    if (!coverColor) return {};
    if (coverColor.startsWith('var(') || CSS.supports('color', coverColor)) {
        return { backgroundColor: coverColor };
    }
    // Web URLs and bundled assets already work in both runtimes.
    const isWebSource = /^(https?:|data:|blob:|asset:|\/\/)/i.test(coverColor);
    const source = isTauri() && !isWebSource ? convertFileSrc(coverColor) : coverColor;
    return { backgroundImage: `url(${JSON.stringify(source)})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundOrigin: 'border-box' };
}
