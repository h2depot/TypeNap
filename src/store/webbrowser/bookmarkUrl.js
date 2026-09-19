export function bookmarkUrl(value) {
    try { return new URL(value).href; }
    catch { return (value || "").trim(); }
}
