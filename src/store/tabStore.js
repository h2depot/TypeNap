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

const defaultTabsList = [
    { id: '1', type: 'home', title: 'Home', props: {} }
];

export const useTabStore = create((set, get) => ({

    tabsList: [

        ...defaultTabsList
    ],
    selectedIndex: 0,

    initialize: () => {
        const { settings } = useAppSettings.getState();
        const { stats } = useStatsStore.getState();
        const savedTabsList = Array.isArray(stats.recent_tabs) ? stats.recent_tabs : [];
        const selectedTab = stats.selected_tab || {};

        if (settings.SavingTab !== "On" || savedTabsList.length === 0) {
            set({ tabsList: defaultTabsList, selectedIndex: 0 });
            return;
        }

        const tabsList = savedTabsList.map((tab) => ({
            id: tab.id || crypto.randomUUID(),
            type: tab.type,
            title: tab.title,
            props: tab.props || {},
        }));
        let selectedIndex = tabsList.findIndex((tab) => tab.id === selectedTab.id);
        if (selectedIndex === -1 && Number.isInteger(selectedTab.index)) {
            selectedIndex = selectedTab.index;
        }
        if (selectedIndex < 0 || selectedIndex >= tabsList.length) {
            selectedIndex = 0;
        }

        set({
            tabsList,
            selectedIndex,
        });
    },

    setSelectedIndex: (index) => {
        set({ selectedIndex: index });
        updateSelectedTab(get().tabsList, index);
    },


    addTab: (type, title, props = {}) => {
        const state = get();
        if (state.tabsList.length >= 20) {
            useToastStore.getState().addToast(i18next.t("notice.tabLimit"), "warning");
            return;
        }

        const newId = crypto.randomUUID();
        set((state) => ({
            tabsList: [...state.tabsList, { id: newId, type, title, props }],
            selectedIndex: state.tabsList.length
        }));

        updateRecentTabs(get().tabsList);
        updateSelectedTab(get().tabsList, get().selectedIndex);

        if (type === "work" && props?.story_name && props?.title) {
            useStatsStore.getState().addRecentFile(props.story_name, props.title);
        }
    },

    closeTab: (indexToClose) => {
        const { tabsList, selectedIndex } = get();

        const newTabsList = [...tabsList];
        newTabsList.splice(indexToClose, 1);

        let newIndex = selectedIndex;
        if (indexToClose === selectedIndex) {
            newIndex = Math.max(0, indexToClose - 1);
        } else if (indexToClose < selectedIndex) {
            newIndex = selectedIndex - 1;
        }

        set({ tabsList: newTabsList, selectedIndex: newIndex });
        updateRecentTabs(newTabsList);
        updateSelectedTab(newTabsList, newIndex);
    },

    reorderTabs: (oldIndex, newIndex) => {
        const { tabsList, selectedIndex } = get();

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

    renameWorkTabs: (storyName, oldTitle, newTitle) => {
        set((state) => ({
            tabsList: state.tabsList.map((tab) => {
                const isSameWorkTab =
                    tab.type === "work" &&
                    tab.props?.story_name === storyName &&
                    tab.props?.title === oldTitle;

                if (!isSameWorkTab) return tab;

                return {
                    ...tab,
                    title: newTitle,
                    props: {
                        ...tab.props,
                        title: newTitle,
                        workspaceID: `${storyName}/${newTitle}`,
                    },
                };
            }),
        }));
        updateRecentTabs(get().tabsList);
        updateSelectedTab(get().tabsList, get().selectedIndex);
    },

    removeWorkTabs: (storyName, title) => {
        set((state) => {
            const selectedTab = state.tabsList[state.selectedIndex];
            const tabsList = state.tabsList.filter((tab) => {
                const isTargetWorkTab =
                    tab.type === "work" &&
                    tab.props?.story_name === storyName &&
                    tab.props?.title === title;

                return !isTargetWorkTab;
            });

            if (tabsList.length === state.tabsList.length) return state;

            let selectedIndex = tabsList.findIndex((tab) => tab.id === selectedTab?.id);
            if (selectedIndex === -1) {
                selectedIndex = Math.min(state.selectedIndex, tabsList.length - 1);
            }

            return {
                tabsList,
                selectedIndex: Math.max(0, selectedIndex),
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
                            workspaceID: `${newName}/${tab.props.title}`,
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
                selectedIndex: Math.max(0, selectedIndex),
            };
        });
        updateRecentTabs(get().tabsList);
        updateSelectedTab(get().tabsList, get().selectedIndex);
    }
}));
