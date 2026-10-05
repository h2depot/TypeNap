import characterSvg from './slider-character.svg?raw';

// Keep the supplied artwork and orange eyes identical in both themes.
export const sliderCharacterLight = `data:image/svg+xml,${encodeURIComponent(characterSvg)}`;
export const sliderCharacterDark = `data:image/svg+xml,${encodeURIComponent(characterSvg.replaceAll('#1A1A1A', '#D4CFBF'))}`;
