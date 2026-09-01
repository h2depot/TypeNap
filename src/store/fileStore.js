import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useToastStore } from "../store/toastStore";
import { useStatsStore } from "./saving/stats";
import i18next from "./languageController";
import { initializationErrorMessage, normalizeInitializationError } from "./initializerInterface";

const showErrorToast = (message, error) => {
    useToastStore.getState().addToast(i18next.t("common.errorWithDetail", { message, error: String(error) }), "error");
};
const showSuccessToast = (message) => {
    useToastStore.getState().addToast(`${message}`, "success");
};
const operationFailed = (operation) => i18next.t("notice.fileOperationFailed", {
    operation: i18next.t(`notice.operations.${operation}`),
});

const currentTimestamp = () => Math.floor(Date.now() / 1000);
const DEFAULT_COVER_COLOR = "#E9E5D8";

const validTimestamp = (timestamp) => timestamp > 0;

const normalizeStoryInfo = (storyInfo) => {
    if (!storyInfo) return storyInfo;

    const fallbackTimestamp = currentTimestamp();
    const createdAt = validTimestamp(storyInfo.created_at)
        ? storyInfo.created_at
        : validTimestamp(storyInfo.last_update)
            ? storyInfo.last_update
            : fallbackTimestamp;
    const lastUpdate = validTimestamp(storyInfo.last_update) ? storyInfo.last_update : createdAt;

    return {
        ...storyInfo,
        created_at: createdAt,
        last_update: lastUpdate,
    };
};

export const useFileStore = create((set, get) => ({
    basePath: "",
    storyList: [],
    wholeTxtList: [],
    isReady: false,
    initializationError: null,

    fetchBasePath: async () => {
        try {
            const basePath = await invoke("get_base_path");
            set({ basePath });
        } catch (error) {
            showErrorToast(operationFailed("getBasePath"), error);
            console.error("Failed to fetch base path:", error);
            throw error;
        }
    },

    fetchStoryList: async () => {
        try {
            const storyList = await invoke("get_story_list");
            set({ storyList: storyList.map(normalizeStoryInfo) });
        } catch (error) {
            showErrorToast(operationFailed("loadStories"), error);
            console.error("Failed to fetch story list:", error);
            throw error;
        }
    },

    fetchWholeTxtList: async () => {
        try {
            const wholeTxtList = await invoke("get_whole_txt_list");
            set({ wholeTxtList });
        } catch (error) {
            showErrorToast(operationFailed("loadTexts"), error);
            console.error("Failed to fetch whole txt list:", error);
            throw error;
        }
    },

    getTxtContent: async (txtInfo) => {
        try {
            const txtContent = await invoke("get_txt_content", { txtInfo });
            return txtContent;
        } catch (error) {
            showErrorToast(operationFailed("loadText"), error);
            console.error("Failed to get txt content:", error);
            throw error;
        }
    },

    getStoryInfo: async (storyName) => {
        try {
            const storyInfo = await invoke("get_story_info", { storyName });
            return normalizeStoryInfo(storyInfo);
        } catch (error) {
            showErrorToast(operationFailed("loadStory"), error);
            console.error("Failed to get story info:", error);
            throw error;
        }
    },

    updateStorySynopsis: async (storyName, content) => {
        try {
            const storyInfo = await invoke("update_story_synopsis", { storyName, content });
            const normalized = normalizeStoryInfo(storyInfo);
            set((state) => {
                const index = state.storyList.findIndex((story) => story.story_name === storyName);
                if (index !== -1) {
                    const newStoryList = [...state.storyList];
                    newStoryList[index] = normalized;
                    return { storyList: newStoryList };
                }
                return {};
            });
            showSuccessToast(i18next.t("notice.synopsisUpdated"));
            return normalized;
        } catch (error) {
            showErrorToast(operationFailed("updateSynopsis"), error);
            console.error("Failed to update story synopsis:", error);
            throw error;
        }
    },

    updateStoryCover: async (storyName, cover, touchLastUpdate = true) => {
        try {
            const storyInfo = await invoke("update_story_cover", { storyName, cover, touchLastUpdate });
            const normalized = normalizeStoryInfo(storyInfo);
            set((state) => {
                const index = state.storyList.findIndex((story) => story.story_name === storyName);
                if (index !== -1) {
                    const newStoryList = [...state.storyList];
                    newStoryList[index] = normalized;
                    return { storyList: newStoryList };
                }
                return {};
            });
            showSuccessToast(i18next.t("notice.coverUpdated"));
            return normalized;
        } catch (error) {
            showErrorToast(operationFailed("updateCover"), error);
            console.error("Failed to update story cover:", error);
            throw error;
        }
    },

    createStory: async (storyName, coverColor) => {
        try {
            await invoke("create_story", { storyName, coverColor: coverColor || DEFAULT_COVER_COLOR });
            await get().fetchStoryList();
        } catch (error) {
            showErrorToast(operationFailed("createStory"), error);
            console.error("Failed to create story:", error);
            throw error;
        }
    },

    deleteStory: async (storyName) => {
        try {
            await invoke("delete_story", { storyName });
            await useStatsStore.getState().removeRecentFilesByStory(storyName);
            await get().fetchStoryList();
        } catch (error) {
            showErrorToast(operationFailed("deleteStory"), error);
            console.error("Failed to delete story:", error);
            throw error;
        }
    },

    renameStory: async (oldStoryName, newStoryName) => {
        try {
            await invoke("rename_story", { oldStoryName, newStoryName });
            await get().fetchStoryList();
            await get().fetchWholeTxtList();
        } catch (error) {
            showErrorToast(operationFailed("renameStory"), error);
            console.error("Failed to rename story:", error);
            throw error;
        }
    },

    createTxt: async (txtInfo) => {
        try {
            await invoke("create_document_txt", { txtInfo });
            await get().fetchStoryList();
            await get().fetchWholeTxtList();
        } catch (error) {
            showErrorToast(operationFailed("createText"), error);
            console.error("Failed to create txt:", error);
            throw error;
        }
    },

    deleteTxt: async (txtInfo) => {
        try {
            await invoke("delete_txt", { txtInfo });
            await useStatsStore.getState().removeRecentFile(txtInfo.story_name, txtInfo.title);
            await get().fetchStoryList();
            await get().fetchWholeTxtList();
        } catch (error) {
            showErrorToast(operationFailed("deleteText"), error);
            console.error("Failed to delete txt:", error);
            throw error;
        }
    },

    updateTxtName: async (txtInfo, newTitle) => {
        try {
            await invoke("save_document_title", { txtInfo, newTitle });
            await get().fetchStoryList();
            await get().fetchWholeTxtList();
        } catch (error) {
            showErrorToast(operationFailed("renameText"), error);
            console.error("Failed to update txt name:", error);
            throw error;
        }
    },

    scan: async () => {
        try {
            let scan_list = await invoke("scan");
            return scan_list;
        } catch (error) {
            showErrorToast(operationFailed("scan"), error);
            console.error("Failed to scan:", error);
            throw error;
        }
    },

    fetchDeletedFiles: async () => {
        try {
            const deletedFiles = await invoke("get_deleted_files");
            return deletedFiles;
        } catch (error) {
            showErrorToast(operationFailed("loadDeleted"), error);
            console.error("Failed to fetch deleted files:", error);
            throw error;
        }
    },

    restoreDeletedFiles: async (items) => {
        try {
            const success = await invoke("restore_deleted_files", { items });
            if (success) {
                await get().fetchStoryList();
                await get().fetchWholeTxtList();
            }
            return success;
        } catch (error) {
            showErrorToast(operationFailed("restoreDeleted"), error);
            console.error("Failed to restore deleted files:", error);
            throw error;
        }
    },

    executeCompleteDeletion: async (items) => {
        try {
            const success = await invoke("execute_complete_deletion", { items });
            if (success) {
                await get().fetchDeletedFiles();
                await get().fetchStoryList();
                await get().fetchWholeTxtList();
            }
            return success;
        } catch (error) {
            showErrorToast(operationFailed("deletePermanently"), error);
            console.error("Failed to execute complete deletion:", error);
            throw error;
        }
    },

    deleteNonTxtFiles: async (paths) => {
        try {
            await invoke("delete_non_txt_files", { paths });
        } catch (error) {
            showErrorToast(operationFailed("deleteUnwanted"), error);
            console.error("Failed to delete non-txt files:", error);
            throw error;
        }
    },

    initialize: async () => {
        try {
            set({ initializationError: null });
            await get().fetchBasePath();
            await get().fetchStoryList();
            await get().fetchWholeTxtList();
            set({ isReady: true });
        } catch (error) {
            const initializationError = normalizeInitializationError(error);
            const message = initializationErrorMessage(initializationError.kind);
            console.error("Failed to initialize file store:", error);
            set({
                isReady: false,
                initializationError: {
                    ...initializationError,
                    message,
                },
            });
        }
    },

}));
