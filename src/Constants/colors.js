export const SOLID_PALETTE_COLORS = [
    "var(--solid-color-1)",
    "var(--solid-color-2)",
    "var(--solid-color-3)",
    "var(--solid-color-4)",
    "var(--solid-color-5)",
    "#D4CFBF",
    "#232B69",
];

// Backgrounds have paired opaque shell/content colours; covers keep their palette.
export const BACKGROUND_PALETTE_COLORS = [
    "var(--theme-red)", "var(--theme-green)", "var(--theme-blue)",
];

export function normalizeBackgroundPath(path = "") {
    const aliases = {
        "var(--solid-color-1)": "", "var(--solid-color-2)": "",
        "var(--light-base)": "", "var(--dark-base)": "",
        "#e5e5e5": "", "#1a1a1a": "",
        "var(--solid-color-3)": "var(--theme-red)",
        "var(--solid-color-4)": "var(--theme-green)",
        "var(--solid-color-5)": "var(--theme-blue)",
        "#a04940": "var(--theme-red)", "#85916d": "var(--theme-green)",
        "#246a84": "var(--theme-blue)", "#d4cfbf": "var(--brand-neutral)",
        "#232b69": "var(--brand-indigo)",
    };
    return aliases[path.toLowerCase()] ?? path;
}

export function backgroundShellColor(path) {
    return `color-mix(in srgb, ${path} var(--app-color-shell-weight), var(--app-color-mix))`;
}

export function backgroundContentColor(path) {
    return `color-mix(in srgb, ${path} var(--app-color-content-weight), var(--app-color-mix))`;
}
