// Share in-flight requests and recently fetched metadata across tabs/shortcuts.
export function createSiteInfoCache(invoke, now = Date.now) {
    const cache = new Map();
    return (url) => {
        url = url.trim();
        if (!url) return Promise.resolve({ title: "Search", icon: "Search" });
        try { url = new URL(url).href; } catch { /* Raw search queries stay as entered. */ }
        const cached = cache.get(url);
        if (cached && cached.expires > now()) return cached.promise;
        const entry = { expires: Infinity };
        entry.promise = Promise.resolve().then(() => invoke("get_site_info", { url })).catch((error) => ({
            success: false, title: null, icon: null,
            titleError: String(error), iconError: String(error),
        })).then((info) => {
            entry.expires = now() + (info.success ? 5 * 60_000 : 30_000);
            return { ...info, title: info.title || url, icon: info.icon || null };
        });
        cache.delete(url);
        cache.set(url, entry);
        if (cache.size > 128) cache.delete(cache.keys().next().value);
        return entry.promise;
    };
}
