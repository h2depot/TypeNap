import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { LazyStore } from "@tauri-apps/plugin-store";
import { useToastStore } from "../toastStore";
import i18next from "../languageController";
import initialBookmarksJa from "../../Constants/InitShortCutsURL/initURL.ja.json";
import initialBookmarksEn from "../../Constants/InitShortCutsURL/initURL.en.json";
import { bookmarkUrl } from "../webbrowser/bookmarkUrl";
import { useAppSettings } from "./appSettings";
import { migrateDailyChars, getWritingStreak } from "./statsSummary";

const showErrorToast = (message, error) => {
    useToastStore.getState().addToast(i18next.t("common.errorWithDetail", { message, error: String(error) }), "error");
};

const store = new LazyStore("stats.json");
let bookmarkSaveQueue = Promise.resolve();
let characterSaveQueue = Promise.resolve();

const defaultStats = {
    total_chars: 0,
    daily_chars: {},
    writing_streak: { current_days: 0, longest_days: 0, last_writing_date: null, as_of_date: null },
    recent_file: [],
    recent_tabs: [],
    selected_tab: {},
    bookmarks: []
};

export const useStatsStore = create((set, get) => ({
    stats: defaultStats,
    isReady: false,

    initStats: async () => {
        try {
            const loadedStats = {};
            let needSave = false;

            for (const key of Object.keys(defaultStats)) {
                let savedValue = null;
                try {
                    savedValue = await store.get(key);
                } catch (error) {
                    console.error(`Failed to get ${key} from store:`, error);
                }

                if (savedValue == null) {
                    const language = useAppSettings.getState().settings.language;
                    const initialBookmarks = language === "ja" ? initialBookmarksJa : initialBookmarksEn;
                    savedValue = key === "bookmarks" ? initialBookmarks : defaultStats[key];
                    await store.set(key, savedValue);
                    needSave = true;
                }

                loadedStats[key] = savedValue;
            }

            const totalChars = Number.isFinite(loadedStats.total_chars) ? Math.max(0, loadedStats.total_chars) : 0;
            if (totalChars !== loadedStats.total_chars) {
                loadedStats.total_chars = totalChars;
                await store.set("total_chars", totalChars);
                needSave = true;
            }

            // Persist migration before removing legacy entries.
            const weeklyChars = await store.get("weekly_chars");
            const dailyChars = migrateDailyChars(loadedStats.daily_chars, weeklyChars);
            if (weeklyChars != null || JSON.stringify(dailyChars) !== JSON.stringify(loadedStats.daily_chars)) {
                loadedStats.daily_chars = dailyChars;
                await store.set("daily_chars", dailyChars);
                needSave = true;
            }

            const writingStreak = getWritingStreak(dailyChars, await invoke("get_current_date"));
            if (JSON.stringify(writingStreak) !== JSON.stringify(loadedStats.writing_streak)) {
                loadedStats.writing_streak = writingStreak;
                await store.set("writing_streak", writingStreak);
                needSave = true;
            }
            if (needSave) {
                await store.save();
            }
            set((state) => ({
                stats: {
                    ...state.stats,
                    ...loadedStats,
                },
                isReady: true,
            }));
            if (weeklyChars != null) {
                await store.delete("weekly_chars");
                await store.save();
            }
        } catch (error) {
            showErrorToast(i18next.t("notice.statsLoadFailed"), error);
            console.error("Failed to load stats:", error);
            set({ isReady: true });
        }
    },

    addBookmark: (bookmark) => {
        const save = bookmarkSaveQueue.then(async () => {
            if (!get().isReady) throw new Error("Stats are not ready");
            if (get().stats.bookmarks.some((item) => bookmarkUrl(item.url) === bookmarkUrl(bookmark.url))) return;
            const bookmarks = [...get().stats.bookmarks, bookmark];
            await store.set("bookmarks", bookmarks);
            await store.save();
            set((state) => ({ stats: { ...state.stats, bookmarks } }));
        });
        bookmarkSaveQueue = save.catch(() => {});
        return save;
    },

    removeBookmark: (url) => {
        const save = bookmarkSaveQueue.then(async () => {
            if (!get().isReady) throw new Error("Stats are not ready");
            const bookmarks = get().stats.bookmarks.filter((item) => bookmarkUrl(item.url) !== bookmarkUrl(url));
            await store.set("bookmarks", bookmarks);
            await store.save();
            set((state) => ({ stats: { ...state.stats, bookmarks } }));
        });
        bookmarkSaveQueue = save.catch(() => {});
        return save;
    },

    moveBookmark: (url, targetUrl) => {
        const save = bookmarkSaveQueue.then(async () => {
            if (!get().isReady) throw new Error("Stats are not ready");
            // Resolve positions inside the queue so concurrent edits keep their changes.
            const bookmarks = [...get().stats.bookmarks];
            const from = bookmarks.findIndex((item) => bookmarkUrl(item.url) === bookmarkUrl(url));
            const to = bookmarks.findIndex((item) => bookmarkUrl(item.url) === bookmarkUrl(targetUrl));
            if (from < 0 || to < 0 || from === to) return;
            const [item] = bookmarks.splice(from, 1);
            bookmarks.splice(to, 0, item);
            await store.set("bookmarks", bookmarks);
            await store.save();
            set((state) => ({ stats: { ...state.stats, bookmarks } }));
        });
        bookmarkSaveQueue = save.catch(() => {});
        return save;
    },

    recordCharacterChange: (value) => {
        const save = characterSaveQueue.then(async () => {
            try {
                if (!get().isReady) throw new Error("Stats are not ready");
                if (!Number.isFinite(value) || value <= 0) return;
                const date = await invoke("get_current_date");
                const totalChars = get().stats.total_chars + value;
                const dailyChars = {
                    ...get().stats.daily_chars,
                    [date]: (get().stats.daily_chars[date] ?? 0) + value,
                };
                const writingStreak = getWritingStreak(dailyChars, date);
                await store.set("total_chars", totalChars);
                await store.set("daily_chars", dailyChars);
                await store.set("writing_streak", writingStreak);
                await store.save();
                set((state) => ({ stats: { ...state.stats, total_chars: totalChars, daily_chars: dailyChars, writing_streak: writingStreak } }));
            } catch (error) {
                showErrorToast(i18next.t("notice.statsSaveFailed"), error);
                console.error("Failed to save character statistics:", error);
            }
        });
        characterSaveQueue = save.catch(() => {});
        return save;
    },

    refreshWritingStreak: () => {
        const save = characterSaveQueue.then(async () => {
            try {
                if (!get().isReady) return;
                const writingStreak = getWritingStreak(get().stats.daily_chars, await invoke("get_current_date"));
                if (JSON.stringify(writingStreak) === JSON.stringify(get().stats.writing_streak)) return;
                await store.set("writing_streak", writingStreak);
                await store.save();
                set((state) => ({ stats: { ...state.stats, writing_streak: writingStreak } }));
            } catch (error) {
                showErrorToast(i18next.t("notice.statsSaveFailed"), error);
                console.error("Failed to refresh writing streak:", error);
            }
        });
        characterSaveQueue = save.catch(() => {});
        return save;
    },

    addRecentFile: async (storyName, txtName) => {
        try {
            const newRecentFile = {
                storyName,
                txtName,
                timestamp: await invoke("get_current_timestamp"),
            };

            set((state) => ({
                stats: {
                    ...state.stats,
                    recent_file: [
                        newRecentFile,
                        ...state.stats.recent_file.filter((file) => (
                            file.storyName !== storyName || file.txtName !== txtName
                        )),
                    ].slice(0, 3),
                },
            }));

            await store.set("recent_file", get().stats.recent_file);
            await store.save();
        } catch (error) {
            showErrorToast(i18next.t("notice.recentFilesSaveFailed"), error);
            console.error("Failed to save setting [recent_file]:", error);
        }
    },

    removeRecentFile: async (storyName, txtName) => {
        try {
            set((state) => ({
                stats: {
                    ...state.stats,
                    recent_file: state.stats.recent_file.filter((file) => (
                        file.storyName !== storyName || file.txtName !== txtName
                    )),
                },
            }));

            await store.set("recent_file", get().stats.recent_file);
            await store.save();
        } catch (error) {
            showErrorToast(i18next.t("notice.recentFilesSaveFailed"), error);
            console.error("Failed to remove setting [recent_file]:", error);
        }
    },

    removeRecentFilesByStory: async (storyName) => {
        try {
            set((state) => ({
                stats: {
                    ...state.stats,
                    recent_file: state.stats.recent_file.filter((file) => (
                        file.storyName !== storyName
                    )),
                },
            }));

            await store.set("recent_file", get().stats.recent_file);
            await store.save();
        } catch (error) {
            showErrorToast(i18next.t("notice.recentFilesSaveFailed"), error);
            console.error("Failed to remove story from setting [recent_file]:", error);
        }
    },

    updateRecentTabs: async (tabsList) => {
        try {
            const recentTabs = tabsList.map((tab, index) => ({
                id: tab.id,
                type: tab.type,
                title: tab.title,
                props: tab.props || {},
                index,
            }));

            set((state) => ({
                stats: {
                    ...state.stats,
                    recent_tabs: recentTabs,
                },
            }));

            await store.set("recent_tabs", get().stats.recent_tabs);
            await store.save();
        } catch (error) {
            showErrorToast(i18next.t("notice.tabsSaveFailed"), error);
            console.error("Failed to save setting [recent_tabs]:", error);
        }
    },

    updateSelectedTab: async (tab, index) => {
        try {
            const selectedTab = tab ? {
                id: tab.id,
                type: tab.type,
                title: tab.title,
                props: tab.props || {},
                index,
            } : {};

            set((state) => ({
                stats: {
                    ...state.stats,
                    selected_tab: selectedTab,
                },
            }));

            await store.set("selected_tab", get().stats.selected_tab);
            await store.save();
        } catch (error) {
            showErrorToast(i18next.t("notice.tabsSaveFailed"), error);
            console.error("Failed to save setting [selected_tab]:", error);
        }
    }
}));
