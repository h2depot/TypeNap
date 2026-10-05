import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useToastStore } from "../store/toastStore";
import { useStatsStore } from "./saving/stats";
import i18next from "./languageController";

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

export const useTxtStore = create((set, get) => ({

    workspaces: {},

    initWorkspace: (workspaceId, story_name, title, initialContent = "") => {
        set((state) => {
            if (state.workspaces[workspaceId]) return state;

            return {
                workspaces: {
                    ...state.workspaces,
                    [workspaceId]: {
                        story_name,
                        title,
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
                        content: newContent,
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

    renameWorkspaceKey: (story_name, oldTitle, newTitle) => {
        set((state) => {
            const workspaceId = `${story_name}/${oldTitle}`;
            const newWorkspaceId = `${story_name}/${newTitle}`;
            const workspace = state.workspaces[workspaceId];

            if (!workspace) return state;

            const newWorkspaces = { ...state.workspaces };
            newWorkspaces[newWorkspaceId] = {
                ...workspace,
                title: newTitle,
            };
            delete newWorkspaces[workspaceId];

            return { workspaces: newWorkspaces };
        });
    },

    renameStoryInWorkspaces: (oldStoryName, newStoryName) => {
        set((state) => {
            const newWorkspaces = {};
            let hasChanges = false;

            for (const [key, workspace] of Object.entries(state.workspaces)) {
                if (workspace.story_name === oldStoryName) {
                    const newWorkspaceId = `${newStoryName}/${workspace.title}`;
                    newWorkspaces[newWorkspaceId] = {
                        ...workspace,
                        story_name: newStoryName,
                    };
                    hasChanges = true;
                } else {
                    newWorkspaces[key] = workspace;
                }
            }

            if (!hasChanges) return state;

            return { workspaces: newWorkspaces };
        });
    },

    saveTitle: async (workspaceId, newTitle) => {
        const workspace = get().workspaces[workspaceId];
        if (!workspace) return;

        try {
            await invoke("save_document_title", {
                txtInfo: {
                    story_name: workspace.story_name,
                    title: workspace.title,
                },
                newTitle: newTitle,
            });

            const newWorkspaceId = `${workspace.story_name}/${newTitle}`;

            set((state) => {
                const newWorkspaces = { ...state.workspaces };

                newWorkspaces[newWorkspaceId] = {
                    ...workspace,
                    title: newTitle,
                };

                delete newWorkspaces[workspaceId];

                return { workspaces: newWorkspaces };
            });

            console.log("Title renamed successfully from", workspaceId, "to", newWorkspaceId);
            return newWorkspaceId;
        } catch (err) {
            showErrorToast(i18next.t("notice.saveError.title"), err);
            console.error("Failed to rename title:", err);
            throw err;
        }
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
        const saveTask = previousSave.catch(() => undefined).then(async () => {
            const workspace = get().workspaces[workspaceId];
            if (!workspace?.isEdited) return;
            const contentToSave = workspace.content;

            const markContentSaved = async () => {
                const charDiff = contentToSave.length - (workspace.savedContentLength ?? 0);
                if (charDiff !== 0) {
                    await useStatsStore.getState().addTotalChars(charDiff);
                    await useStatsStore.getState().addWeeklyChars(charDiff);
                }

                get().markAsSaved(workspaceId, contentToSave);
            };

            try {
                await invoke("save_document_content", {
                    txtInfo: {
                        story_name: workspace.story_name,
                        title: workspace.title,
                    },
                    content: contentToSave,
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
        });

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

    loadContent: async (workspaceId, story_name, title) => {
        try {
            const content = await invoke("load_txt", {
                txtInfo: { story_name, title },
            });

            set((state) => ({
                workspaces: {
                    ...state.workspaces,
                    [workspaceId]: {
                        ...state.workspaces[workspaceId],
                        content: content,
                        savedContentLength: content.length,
                        isEdited: false
                    }
                }
            }));
        } catch (err) {
            showErrorToast(i18next.t("notice.loadFileFailed"), err);
            console.error("ファイルの読み込みに失敗しました:", err);
        }
    }
}));
