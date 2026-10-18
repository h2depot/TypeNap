import { contentId, sameContent, contentTabProps } from './contentsInfo.js';
import { useFileStore } from './fileStore';
import { create } from "zustand";
import { arrayMove } from "@dnd-kit/sortable";
import { useToastStore } from "./toastStore";
import { useStatsStore } from "./saving/stats";
import { useAppSettings } from "./saving/appSettings";
import i18next from "./languageController";

const updateRecentTabs = (tabsList) => {
    if (useAppSettings.getState().settings.SavingTab !== "On") return;
    useStatsStore.getState().updateRecentTabs(tabsList);
};

const updateSelectedTab = (tabsList, selectedIndex) => {
    if (useAppSettings.getState().settings.SavingTab !== "On") return;
    useStatsStore.getState().updateSelectedTab(tabsList[selectedIndex], selectedIndex);
};

// Tab instance IDs belong to the UI; Work resources are identified only by UUID.
const sameResource = (a, b) => a.type === b.type && (
    a.type === 'work' ? sameContent(a.props, b.props) : a.id === b.id
);
const fixedTypes = ["home", "library", "settings"];
const normalizeTab = tab => {
    const props = tab.type === 'work' ? contentTabProps(tab.props) : tab.props || {};
    return { ...tab, id: tab.id || crypto.randomUUID(), props,
        ...(tab.type === 'work' ? { title: props.name } : {}) };
};

export const useTabStore = create((set, get) => ({

    appMode: "workspace",
    tabLauncherOpen: false,
    setTabLauncherOpen: (tabLauncherOpen) => set({ tabLauncherOpen }),
    setAppMode: (appMode) => {
        if (["workspace", "library", "template", "images", "settings"].includes(appMode)) set({ appMode });
    },
    // Dynamic tabs only. Retain these names for editor/search consumers.
    tabsList: [],
    selectedIndex: -1,

    isReady: false,
    initialize: async () => {
        const { settings } = useAppSettings.getState();
        const { stats } = useStatsStore.getState();
        const savedTabsList = Array.isArray(stats.recent_tabs) ? stats.recent_tabs : [];
        const selectedTab = stats.selected_tab || {};

        if (settings.SavingTab !== "On" || savedTabsList.length === 0) {
            set({ tabsList: [], selectedIndex: -1, isReady: true });
            return;
        }

        const normalizedTabs = await Promise.all(savedTabsList.map(async tab => {
            if (!tab) return null;
            if (tab.type !== 'work') return normalizeTab(tab);
            try {
                const info = await useFileStore.getState().resolveContentsInfo(tab.props || {});
                return normalizeTab({ ...tab, props: info });
            } catch (error) {
                console.error('Could not restore content tab', error);
                return null;
            }
        }));
        const tabsList = normalizedTabs
            .filter((tab) => tab && !fixedTypes.includes(tab.type))
            .filter((tab, index, tabs) => tabs.findIndex((other) => sameResource(tab, other)) === index);
        const savedActive = normalizedTabs.find((tab) => tab && selectedTab.id && tab.id === selectedTab.id)
            || normalizedTabs[selectedTab.index];
        let selectedIndex = savedActive && !fixedTypes.includes(savedActive.type)
            ? tabsList.findIndex((tab) => sameResource(tab, savedActive)) : -1;
        if (selectedIndex === -1) selectedIndex = tabsList.length ? 0 : -1;

        set({
            tabsList,
            selectedIndex,
            isReady: true,
        });
        updateRecentTabs(tabsList);
        updateSelectedTab(tabsList, selectedIndex);
    },

    setSelectedIndex: (index) => {
        if (!Number.isInteger(index) || !get().tabsList[index]) return;
        set({ selectedIndex: index });
        updateSelectedTab(get().tabsList, index);
    },


    addTab: (type, title, props = {}) => {
        if (fixedTypes.includes(type)) return;
        const state = get();
        const candidate = normalizeTab({ type, title, props });
        const existingIndex = state.tabsList.findIndex((tab) => sameResource(tab, candidate));
        if (existingIndex !== -1) {
            set({ appMode: "workspace", selectedIndex: existingIndex });
            updateSelectedTab(state.tabsList, existingIndex);
            return;
        }
        if (state.tabsList.length >= 20) {
            useToastStore.getState().addToast(i18next.t("notice.tabLimit"), "warning");
            return;
        }

        set((state) => ({
            appMode: "workspace",
            tabsList: [...state.tabsList, candidate],
            selectedIndex: state.tabsList.length
        }));

        updateRecentTabs(get().tabsList);
        updateSelectedTab(get().tabsList, get().selectedIndex);

        if (type === "work" && props?.story_name && props?.title) {
            useStatsStore.getState().addRecentFile(candidate.props);
        }
    },

    closeTab: (indexToClose) => {
        const { tabsList, selectedIndex } = get();

        if (!Number.isInteger(indexToClose) || !tabsList[indexToClose]) return;
        const newTabsList = [...tabsList];
        newTabsList.splice(indexToClose, 1);

        let newIndex = selectedIndex;
        if (indexToClose === selectedIndex) {
            newIndex = Math.max(0, indexToClose - 1);
        } else if (indexToClose < selectedIndex) {
            newIndex = selectedIndex - 1;
        }

        set({ tabsList: newTabsList, selectedIndex: newTabsList.length ? newIndex : -1 });
        updateRecentTabs(newTabsList);
        updateSelectedTab(newTabsList, get().selectedIndex);
    },

    reorderTabs: (oldIndex, newIndex) => {
        const { tabsList, selectedIndex } = get();

        if (!tabsList[oldIndex] || !tabsList[newIndex]) return;
        let nextSelectedIndex = selectedIndex;
        if (selectedIndex === oldIndex) {
            nextSelectedIndex = newIndex;
        } else if (oldIndex < selectedIndex && selectedIndex <= newIndex) {
            nextSelectedIndex = selectedIndex - 1;
        } else if (oldIndex > selectedIndex && selectedIndex >= newIndex) {
            nextSelectedIndex = selectedIndex + 1;
        }

        const newTabsList = arrayMove(tabsList, oldIndex, newIndex);

        set({
            tabsList: newTabsList,
            selectedIndex: nextSelectedIndex
        });
        updateRecentTabs(newTabsList);
        updateSelectedTab(newTabsList, nextSelectedIndex);
    },

    updateSearchTabInfo: (id, expectedUrl, info) => {
        const index = get().tabsList.findIndex((tab) => tab.id === id);
        const tab = get().tabsList[index];
        // Ignore results for closed tabs or URLs that have since changed.
        if (!tab || tab.type !== "search" || (tab.props.url || "") !== expectedUrl) return;
        const title = expectedUrl && tab.props.liveTitleUrl === expectedUrl ? tab.title : info.title;
        if (tab.title === title && tab.props.siteIcon === info.icon && tab.props.siteInfoUrl === expectedUrl) return;
        get().updateTabProps(index, title, { siteIcon: info.icon, siteInfoUrl: expectedUrl });
    },

    updateSearchTabTitle: (id, expectedUrl, title) => {
        if (!title?.trim() || !expectedUrl) return;
        const index = get().tabsList.findIndex((tab) => tab.id === id);
        const tab = get().tabsList[index];
        if (!tab || tab.type !== "search" || tab.props.url !== expectedUrl) return;
        if (tab.title === title && tab.props.liveTitleUrl === expectedUrl) return;
        get().updateTabProps(index, title, { liveTitleUrl: expectedUrl });
    },

    updateTabPropsById: (id, newProps) => {
        const index = get().tabsList.findIndex((tab) => tab.id === id);
        if (index === -1) return;
        get().updateTabProps(index, undefined, newProps);
    },

    updateTabProps: (index, newTitle, newProps) => {
        set((state) => {
            const newTabsList = [...state.tabsList];
            if (newTabsList[index]) {
                newTabsList[index] = {
                    ...newTabsList[index],
                    title: newTitle || newTabsList[index].title,
                    props: {
                        ...newTabsList[index].props,
                        ...newProps
                    }
                };
            }
            return { tabsList: newTabsList };
        });
        updateRecentTabs(get().tabsList);
        updateSelectedTab(get().tabsList, get().selectedIndex);
    },

    renameWorkTabs: (info) => {
        set(state => ({ tabsList: state.tabsList.map(tab =>
            tab.type === 'work' && sameContent(tab.props, info)
                ? { ...tab, title: info.name, props: contentTabProps(info) } : tab) }));
        updateRecentTabs(get().tabsList);
        updateSelectedTab(get().tabsList, get().selectedIndex);
    },

    removeWorkTabs: (info) => {
        set((state) => {
            const selectedTab = state.tabsList[state.selectedIndex];
            const tabsList = state.tabsList.filter((tab) => {
                const isTargetWorkTab =
                    tab.type === "work" &&
                    sameContent(tab.props, info);

                return !isTargetWorkTab;
            });

            if (tabsList.length === state.tabsList.length) return state;

            let selectedIndex = tabsList.findIndex((tab) => tab.id === selectedTab?.id);
            if (selectedIndex === -1) {
                selectedIndex = Math.min(state.selectedIndex, tabsList.length - 1);
            }

            return {
                tabsList,
                selectedIndex: tabsList.length ? Math.max(0, selectedIndex) : -1,
            };
        });
        updateRecentTabs(get().tabsList);
        updateSelectedTab(get().tabsList, get().selectedIndex);
    },

    renameStoryTabs: (oldName, newName) => {
        set((state) => ({
            tabsList: state.tabsList.map((tab) => {
                if (tab.type === "story" && tab.props?.story_name === oldName) {
                    return {
                        ...tab,
                        title: newName,
                        props: {
                            ...tab.props,
                            story_name: newName,
                        },
                    };
                }

                if (tab.type === "work" && tab.props?.story_name === oldName) {
                    return {
                        ...tab,
                        props: {
                            ...tab.props,
                            story_name: newName,
                            workspaceID: contentId(tab.props),
                        },
                    };
                }

                return tab;
            }),
        }));
        updateRecentTabs(get().tabsList);
        updateSelectedTab(get().tabsList, get().selectedIndex);
    },

    removeStoryTabs: (storyName) => {
        set((state) => {
            const selectedTab = state.tabsList[state.selectedIndex];
            const tabsList = state.tabsList.filter((tab) => {
                const isTargetStoryTab =
                    tab.type === "story" && tab.props?.story_name === storyName;
                const isTargetWorkTab =
                    tab.type === "work" && tab.props?.story_name === storyName;

                return !isTargetStoryTab && !isTargetWorkTab;
            });

            if (tabsList.length === state.tabsList.length) return state;

            let selectedIndex = tabsList.findIndex((tab) => tab.id === selectedTab?.id);
            if (selectedIndex === -1) {
                selectedIndex = Math.min(state.selectedIndex, tabsList.length - 1);
            }

            return {
                tabsList,
                selectedIndex: tabsList.length ? Math.max(0, selectedIndex) : -1,
            };
        });
        updateRecentTabs(get().tabsList);
        updateSelectedTab(get().tabsList, get().selectedIndex);
    }
}));
