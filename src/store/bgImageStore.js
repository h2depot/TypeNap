import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useToastStore } from "../store/toastStore";
import i18next from "./languageController";

const showErrorToast = (message, error) => {
    useToastStore.getState().addToast(i18next.t("common.errorWithDetail", { message, error: String(error) }), "error");
};


export const useBgImageStore = create((set, get) => ({
    wholeImageList: [],

    addUserImage: async (imgPath) => {
        try {
            await invoke("add_user_image", { imgPath });
        } catch (error) {
            showErrorToast(i18next.t("notice.imageAddFailed"), error);
            console.error("Failed to add user image:", error);
            throw error;
        }
    },

    deleteUserImage: async (imgName) => {
        try {
            await invoke("delete_user_image", { imgName });
        } catch (error) {
            showErrorToast(i18next.t("notice.imageDeleteFailed"), error);
            console.error("Failed to delete user image:", error);
            throw error;
        }
    },

    fetchImageList: async () => {
        try {
            const wholeImageList = await invoke("get_whole_image_list");
            set({ wholeImageList });
            return wholeImageList;
        } catch (error) {
            showErrorToast(i18next.t("notice.imageListFailed"), error);
            console.error("Failed to fetch image list:", error);
            throw error;
        }
    }
}));
