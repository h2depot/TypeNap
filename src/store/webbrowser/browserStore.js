import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { createSiteInfoCache } from "./siteInfoCache";

const getSiteInfo = createSiteInfoCache(invoke);

// Native labels live only for this session; never persist them with saved tabs.
export const useBrowserStore = create((set, get) => {
    const run = async (tabId, command, args = {}) => {
        const label = get().webviews[tabId];
        if (!label) throw new Error("Webview is not ready");
        return invoke(command, { label, ...args });
    };

    return {
        webviews: {},
        getSiteInfo,
        getSuggestions: (query) => invoke("get_suggestions", { query }),
        resolveUrl: (query, searchEngine) => invoke("setup_url", { query, searchEngine }),
        validateShortcutUrl: (query) => invoke("validate_shortcut_url", { query }),
        navigationState: (tabId) => run(tabId, "webview_navigation_state"),
        registerWebview: (tabId, label) => set((state) => ({
            webviews: { ...state.webviews, [tabId]: label },
        })),
        unregisterWebview: (tabId, label) => set((state) => {
            // A late cleanup must not remove a replacement webview.
            if (state.webviews[tabId] !== label) return state;
            const webviews = { ...state.webviews };
            delete webviews[tabId];
            return { webviews };
        }),
        back: (tabId) => run(tabId, "webview_back"),
        forward: (tabId) => run(tabId, "webview_forward"),
        reload: (tabId) => run(tabId, "webview_reload"),
        navigate: (tabId, url) => run(tabId, "webview_navigate", { url }),
    };
});
