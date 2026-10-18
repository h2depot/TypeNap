import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useToastStore } from "../store/toastStore";
import i18next from "./languageController";
import { blockImageReferenceWrites, withImageReferenceWrite } from './imageReferenceWrites.js';
import { applyImageRename } from './applyImageRename.js';
import { normalizeImagePath, registerImageRenames } from '../utils/imagePaths.js';

const showErrorToast = (message, error) => {
    useToastStore.getState().addToast(i18next.t("common.errorWithDetail", { message, error: String(error) }), "error");
};


export const useImageStore = create((set, get) => ({
    wholeImageList: [],
    loadImageRenames: async () => {
        const renames = await invoke('get_image_renames');
        registerImageRenames(renames);
    },

    renameUserImage: (image, newName) => withImageReferenceWrite(async () => {
        if (image.kind !== 'user') throw new Error(i18next.t('imageLibrary.presetProtected'));
        let result;
        try { result = await invoke('rename_user_image', { imgName: image.name, newName }); }
        catch (error) {
            if (String(error).includes('Image recovery is pending')) blockImageReferenceWrites(error);
            throw error;
        }
        applyImageRename(result);
        set(state => ({ wholeImageList: state.wholeImageList.map(item => item.kind === 'user' && normalizeImagePath(item.path) === normalizeImagePath(result.old_path)
            ? { ...item, path: result.new_path, name: result.new_path.split(/[\\/]/).at(-1) } : item) }));
        return result;
    }),

    addUserImage: (imgPath) => withImageReferenceWrite(async () => {
        try {
            return await invoke("add_user_image", { imgPath });
        } catch (error) {
            showErrorToast(i18next.t("notice.imageAddFailed"), error);
            console.error("Failed to add user image:", error);
            throw error;
        }
    }),

    deleteUserImage: (imgName) => withImageReferenceWrite(async () => {
        const image = get().wholeImageList.find(image => image.kind === 'user' && image.name === imgName);
        const currentName = image ? normalizeImagePath(image.path).split(/[\\/]/).at(-1) : imgName;
        try {
            await invoke("delete_user_image", { imgName: currentName });
            set(state => ({ wholeImageList: state.wholeImageList.filter(image => image.kind !== 'user' || image.name !== currentName) }));
        } catch (error) {
            showErrorToast(i18next.t("notice.imageDeleteFailed"), error);
            console.error("Failed to delete user image:", error);
            throw error;
        }
    }),

    fetchImageList: () => withImageReferenceWrite(async () => {
        try {
            const wholeImageList = await invoke("get_whole_image_list");
            set({ wholeImageList });
            return wholeImageList;
        } catch (error) {
            showErrorToast(i18next.t("notice.imageListFailed"), error);
            console.error("Failed to fetch image list:", error);
            throw error;
        }
    })
}));
