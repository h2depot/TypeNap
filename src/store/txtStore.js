import { contentsInfo, contentId } from './contentsInfo.js';
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useToastStore } from "../store/toastStore";
import { useFileStore } from "./fileStore";
import { useStatsStore } from "./saving/stats";
import i18next from "./languageController";
import { withImageReferenceWrite } from './imageReferenceWrites.js';
import { normalizeImageContent } from '../utils/imagePaths.js';

const showToast = (message, type = "info") => {
    useToastStore.getState().addToast(message, type);
};

const showErrorToast = (message, error) => {
    showToast(i18next.t("common.errorWithDetail", { message, error: String(error) }), "error");
};

const normalizeSaveError = (error) => {
    if (error && typeof error === "object") return error;
    if (typeof error !== "string") return {};

    try {
        return JSON.parse(error);
    } catch {
        return {};
    }
};

const atomicWriteErrorMessage = (stage) => {
    switch (stage) {
        case "createTemporary":
            return i18next.t("notice.saveError.createTemporary");
        case "writeTemporary":
            return i18next.t("notice.saveError.writeTemporary");
        case "syncTemporary":
            return i18next.t("notice.saveError.syncTemporary");
        case "replaceDestination":
            return i18next.t("notice.saveError.replaceDestination");
        case "invalidDestination":
            return i18next.t("notice.saveError.invalidDestination");
        default:
            return i18next.t("notice.saveError.default");
    }
};

const saveQueues = new Map();
const isJson = (info) => info?.content_type && info.content_type !== "txt";

export const useTxtStore = create((set, get) => ({

    workspaces: {},

    initWorkspace: (value, initialContent = "") => {
        const info = contentsInfo(value);
        const workspaceId = contentId(info);
        set((state) => {
            if (state.workspaces[workspaceId]) return state;

            return {
                workspaces: {
                    ...state.workspaces,
                    [workspaceId]: {
                        story_name: info.story_name,
                        title: info.name,
                        contentsInfo: info,
                        isLoading: true,
                        loadError: null,
                        content: initialContent,
                        savedContentLength: initialContent.length,
                        isEdited: false,
                        isSaving: false
                    }
                }
            };
        });
    },


    updateContent: (workspaceId, newContent) => {
        set((state) => {
            const workspace = state.workspaces[workspaceId];
            if (!workspace) return state;

            return {
                workspaces: {
                    ...state.workspaces,
                    [workspaceId]: {
                        ...workspace,
                        content: isJson(workspace.contentsInfo) ? normalizeImageContent(newContent) : newContent,
                        isEdited: true
                    }
                }
            };
        });
    },

    markAsSaved: (workspaceId, savedContent) => {
        set((state) => {
            const workspace = state.workspaces[workspaceId];
            if (!workspace) return state;
            const savedLength = (savedContent ?? workspace.content).length;

            return {
                workspaces: {
                    ...state.workspaces,
                    [workspaceId]: {
                        ...workspace,
                        savedContentLength: savedLength,
                        isEdited: savedContent === undefined ? false : workspace.content !== savedContent
                    }
                }
            };
        });
    },

    removeWorkspace: (workspaceId) => {
        set((state) => {
            const newWorkspaces = { ...state.workspaces };
            delete newWorkspaces[workspaceId];
            return { workspaces: newWorkspaces };
        });
    },

    removeStoryWorkspaces: (storyName) => {
        set((state) => {
            const newWorkspaces = {};
            let hasChanges = false;

            for (const [workspaceId, workspace] of Object.entries(state.workspaces)) {
                if (workspace.story_name === storyName) {
                    hasChanges = true;
                    continue;
                }

                newWorkspaces[workspaceId] = workspace;
            }

            if (!hasChanges) return state;

            return { workspaces: newWorkspaces };
        });
    },

    updateContentsInfo: (value) => {
        const info = contentsInfo(value);
        const id = contentId(info);
        set(state => {
            const workspace = state.workspaces[id];
            if (!workspace) return state;
            return { workspaces: { ...state.workspaces, [id]: {
                ...workspace, contentsInfo: info, story_name: info.story_name, title: info.name,
            } } };
        });
    },

    renameStoryInWorkspaces: (oldStoryName, newStoryName) => {
        set(state => ({ workspaces: Object.fromEntries(Object.entries(state.workspaces).map(([id, workspace]) =>
            [id, workspace.story_name === oldStoryName ? { ...workspace, story_name: newStoryName,
                contentsInfo: { ...workspace.contentsInfo, story_name: newStoryName } } : workspace])) }));
    },

    renameContent: async (info, newTitle) => {
        const renamed = await useFileStore.getState().updateTxtName(info, newTitle);
        // Merge metadata into the latest draft, including edits made during IPC.
        get().updateContentsInfo(renamed);
        return renamed;
    },

    saveTitle: async (workspaceId, newTitle) => {
        const workspace = get().workspaces[workspaceId];
        if (!workspace) return;
        return get().renameContent(workspace.contentsInfo, newTitle);
    },

    saveContent: async (workspaceId) => {
        if (!get().workspaces[workspaceId]) return;

        set((state) => ({
            workspaces: {
                ...state.workspaces,
                [workspaceId]: {
                    ...state.workspaces[workspaceId],
                    isSaving: true,
                },
            },
        }));

        const previousSave = saveQueues.get(workspaceId) ?? Promise.resolve();
        const saveTask = previousSave.catch(() => undefined).then(() => withImageReferenceWrite(async () => {
            const workspace = get().workspaces[workspaceId];
            if (!workspace?.isEdited || workspace.isLoading) return;
            const contentToSave = workspace.content;

            const markContentSaved = async () => {
                const charDiff = contentToSave.length - (workspace.savedContentLength ?? 0);
                if (charDiff > 0 && !isJson(workspace.contentsInfo)) {
                    await useStatsStore.getState().recordCharacterChange(charDiff);
                }

                get().markAsSaved(workspaceId, contentToSave);
            };

            try {
                await invoke(isJson(workspace.contentsInfo) ? "save_json_content" : "save_document_content", {
                    contentsInfo: contentsInfo(workspace.contentsInfo),
                    content: isJson(workspace.contentsInfo) ? JSON.parse(contentToSave) : contentToSave,
                });

                await markContentSaved();
                showToast(i18next.t("notice.saved", { title: workspace.title }), "success");
                console.log("saved content!");
            } catch (err) {
                const saveError = normalizeSaveError(err);

                if (saveError.kind === "backup" || saveError.kind === "metadata") {
                    await markContentSaved();
                    const target = i18next.t(saveError.kind === "backup" ? "notice.backup" : "notice.storyInfo");
                    showToast(i18next.t("notice.partialSave", { target }), "warning");
                    console.error("Partially failed to save content:", err);
                    return;
                }

                if (saveError.kind === "atomicWrite") {
                    showToast(atomicWriteErrorMessage(saveError.stage), "error");
                } else if (saveError.kind === "preparation") {
                    showToast(i18next.t("notice.savePathFailed"), "error");
                } else {
                    showErrorToast(i18next.t("notice.saveError.document", { title: workspace.title }), err);
                }
                console.error("Failed to save content:", err);
                throw err;
            }
        }));

        saveQueues.set(workspaceId, saveTask);

        try {
            await saveTask;
        } finally {
            if (saveQueues.get(workspaceId) === saveTask) {
                saveQueues.delete(workspaceId);
                set((state) => {
                    const workspace = state.workspaces[workspaceId];
                    if (!workspace) return state;
                    return {
                        workspaces: {
                            ...state.workspaces,
                            [workspaceId]: { ...workspace, isSaving: false },
                        },
                    };
                });
            }
        }
    },

    loadContent: async (info) => {
        const workspaceId = contentId(info);
        const before = get().workspaces[workspaceId];
        if (!before) return;
        try {
            const descriptor = contentsInfo(info);
            const loaded = await invoke(isJson(descriptor) ? "load_json" : "load_txt", { contentsInfo: descriptor });
            const content = isJson(descriptor) ? normalizeImageContent(JSON.stringify(loaded, null, 2)) : loaded;

            set(state => {
                const current = state.workspaces[workspaceId];
                if (!current) return state;
                // An asynchronous reload must not erase edits made while it ran.
                const changed = current.content !== before.content || current.isEdited !== before.isEdited;
                return { workspaces: { ...state.workspaces, [workspaceId]: {
                    ...current, isLoading: false, loadError: null,
                    ...(changed ? {} : { content, savedContentLength: content.length, isEdited: false }),
                } } };
            });
        } catch (err) {
            set(state => state.workspaces[workspaceId] ? { workspaces: { ...state.workspaces,
                [workspaceId]: { ...state.workspaces[workspaceId], isLoading: false, loadError: String(err) } } } : state);
            showErrorToast(i18next.t("notice.loadFileFailed"), err);
            console.error("ファイルの読み込みに失敗しました:", err);
        }
    }
}));
