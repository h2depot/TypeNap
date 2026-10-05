import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { LazyStore } from "@tauri-apps/plugin-store";
import { useToastStore } from "../toastStore";
import i18next from "../languageController";

const showErrorToast = (message, error) => {
    useToastStore.getState().addToast(i18next.t("common.errorWithDetail", { message, error: String(error) }), "error");
};

const store = new LazyStore("stats.json");

const defaultStats = {
    total_chars: 0,
    weekly_chars: {
        sun: { date: 0, chars: 0 },
        mon: { date: 0, chars: 0 },
        tue: { date: 0, chars: 0 },
        wed: { date: 0, chars: 0 },
        thu: { date: 0, chars: 0 },
        fri: { date: 0, chars: 0 },
        sat: { date: 0, chars: 0 },
    },
    recent_file: [],
    recent_tabs: [],
    selected_tab: {}
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
                    savedValue = defaultStats[key];
                    await store.set(key, savedValue);
                    needSave = true;
                }

                if (key !== "weekly_chars") {
                    loadedStats[key] = savedValue;
                    continue;
                }

                const todayStr = await invoke("get_current_date");
                const todayDate = new Date(todayStr);
                const startOfWeek = new Date(todayDate);
                startOfWeek.setDate(todayDate.getDate() - todayDate.getDay());
                startOfWeek.setHours(0, 0, 0, 0);

                const currentWeeklyChars = savedValue;
                const newWeeklyChars = {};

                for (const day of Object.keys(defaultStats[key])) {
                    const dayData = currentWeeklyChars[day] || { date: 0, chars: 0 };
                    if (dayData.date === 0) {
                        newWeeklyChars[day] = { date: 0, chars: 0 };
                        continue;
                    }

                    const savedDate = new Date(dayData.date);
                    newWeeklyChars[day] = savedDate < startOfWeek ? { date: 0, chars: 0 } : dayData;
                }

                loadedStats[key] = newWeeklyChars;
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
        } catch (error) {
            showErrorToast(i18next.t("notice.statsLoadFailed"), error);
            console.error("Failed to load stats:", error);
            set({ isReady: true });
        }
    },

    addTotalChars: async (value) => {
        try {
            set((state) => ({
                stats: {
                    ...state.stats,
                    total_chars: state.stats.total_chars + value,
                },
            }));

            await store.set("total_chars", get().stats.total_chars);
            await store.save();
        } catch (error) {
            showErrorToast(i18next.t("notice.statsSaveFailed"), error);
            console.error("Failed to save setting [total_chars]:", error);
        }
    },

    addWeeklyChars: async (value) => {
        try {
            const day = await invoke("get_day_of_week");
            const date = await invoke("get_current_date");

            set((state) => {
                const dayStats = state.stats.weekly_chars[day] || { date: 0, chars: 0 };

                return {
                    stats: {
                        ...state.stats,
                        weekly_chars: {
                            ...state.stats.weekly_chars,
                            [day]: {
                                date,
                                chars: dayStats.chars + value,
                            },
                        },
                    },
                };
            });

            await store.set("weekly_chars", get().stats.weekly_chars);
            await store.save();
        } catch (error) {
            showErrorToast(i18next.t("notice.statsSaveFailed"), error);
            console.error("Failed to save setting [weekly_chars]:", error);
        }
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
