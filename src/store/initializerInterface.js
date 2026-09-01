import { invoke } from "@tauri-apps/api/core";
import i18next from "./languageController";

let initializationPromise;
let directoryPromise;

export const createDirAll = () => {
    directoryPromise ??= invoke("create_dir_all");
    return directoryPromise;
};

export const initialize = () => {
    initializationPromise ??= invoke("initialize");
    return initializationPromise;
};

export const getSettingsState = () => invoke("get_settings_state");

export const getTouredState = () => invoke("get_toured_state");

export const setTouredState = (toured) => invoke("set_toured_state", { toured });

export const normalizeInitializationError = (error) => {
    if (error && typeof error === "object") return error;
    if (typeof error !== "string") return {};

    try {
        return JSON.parse(error);
    } catch {
        return {};
    }
};

export const initializationErrorMessage = (kind) => {
    switch (kind) {
        case "appDataPath":
            return i18next.t("initialization.appDataPath");
        case "backupDirectory":
        case "aliveBackupDirectory":
        case "necropolisDirectory":
            return i18next.t("initialization.backupDirectory");
        case "libraryDirectory":
            return i18next.t("initialization.libraryDirectory");
        case "backgroundDirectory":
            return i18next.t("initialization.backgroundDirectory");
        case "backgroundAssets":
            return i18next.t("initialization.backgroundAssets");
        case "storyAssets":
            return i18next.t("initialization.storyAssets");
        case "jSONFile":
            return i18next.t("initialization.jsonFile");
        default:
            return i18next.t("initialization.default");
    }
};
