export function formatCharacterCount(value, locale = "ja") {
    const count = Number.isFinite(value) ? value : 0;
    const japanese = locale.toLowerCase().startsWith("ja");
    const units = japanese
        ? [[1e12, "兆"], [1e8, "億"], [1e4, "万"]]
        : [[1e12, " trillion"], [1e9, " billion"], [1e6, " million"]];
    const unit = units.find(([scale]) => Math.abs(count) >= scale);
    if (!unit) return new Intl.NumberFormat(locale).format(count);
    const [scale, suffix] = unit;
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }).format(count / scale) + suffix;
}
