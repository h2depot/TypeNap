import { create } from "zustand";
import { useFileStore } from "./fileStore";

const synopsisSaveQueues = new Map();

const currentTimestamp = () => Math.floor(Date.now() / 1000);

const validTimestamp = (timestamp) => timestamp > 0;

const nonEmptyCover = (cover) => (typeof cover === "string" && cover.trim() ? cover : null);

export const useStoryStore = create((set, get) => ({
    workspaces: {},

    initWorkspace: (storyName, filesList = [], charCnt = 0, storyInfo = {}) => {
        set((state) => {
            if (state.workspaces[storyName]) return state;

            const createdAt = validTimestamp(storyInfo.created_at)
                ? storyInfo.created_at
                : validTimestamp(storyInfo.createdAt)
                    ? storyInfo.createdAt
                    : currentTimestamp();
            const lastUpdate = validTimestamp(storyInfo.last_update)
                ? storyInfo.last_update
                : validTimestamp(storyInfo.lastUpdate)
                    ? storyInfo.lastUpdate
                    : createdAt;
            const synopsis = storyInfo.synopsis ?? "";
            const cover = nonEmptyCover(storyInfo.cover) ?? "";

            return {
                workspaces: {
                    ...state.workspaces,
                    [storyName]: {
                        storyName,
                        filesList,
                        charCnt,
                        synopsis,
                        synopsisDraft: synopsis,
                        synopsisIsEdited: false,
                        synopsisIsSaving: false,
                        synopsisSaveError: null,
                        cover,
                        coverTextColor: storyInfo.cover_text_color || "",
                        lastUpdate,
                        createdAt,
                    },
                },
            };
        });
    },

    updateStoryInfo: (storyName, storyInfo) => {
        set((state) => {
            const workspace = state.workspaces[storyName];
            if (!workspace) return state;

            return {
                workspaces: {
                    ...state.workspaces,
                    [storyName]: {
                        ...workspace,
                        filesList: storyInfo.chapters ?? storyInfo.files ?? [],
                        charCnt: storyInfo.char_cnt,
                        ...(!workspace.synopsisIsEdited && !workspace.synopsisIsSaving ? {
                            synopsis: storyInfo.synopsis ?? "",
                            synopsisDraft: storyInfo.synopsis ?? "",
                        } : {}),
                        coverTextColor: storyInfo.cover_text_color || "",
                        cover: nonEmptyCover(storyInfo.cover) ?? nonEmptyCover(workspace.cover) ?? "",
                        lastUpdate: validTimestamp(storyInfo.last_update)
                            ? storyInfo.last_update
                            : validTimestamp(storyInfo.created_at)
                                ? storyInfo.created_at
                                : workspace.lastUpdate,
                        createdAt: validTimestamp(storyInfo.created_at)
                            ? storyInfo.created_at
                            : workspace.createdAt,
                    },
                },
            };
        });
    },

    markSynopsisSaved: (storyName, storyInfo = {}, content = storyInfo.synopsis) => {
        set((state) => {
            const workspace = state.workspaces[storyName];
            if (!workspace) return state;

            return {
                workspaces: {
                    ...state.workspaces,
                    [storyName]: {
                        ...workspace,
                        synopsis: content ?? workspace.synopsis,
                        synopsisIsEdited: workspace.synopsisDraft !== (content ?? workspace.synopsis),
                        synopsisSaveError: null,
                        lastUpdate: validTimestamp(storyInfo.last_update)
                            ? storyInfo.last_update
                            : workspace.lastUpdate,
                        createdAt: validTimestamp(storyInfo.created_at)
                            ? storyInfo.created_at
                            : workspace.createdAt,
                    },
                },
            };
        });
    },

    updateSynopsis: (storyName, content) => {
        set((state) => {
            const workspace = state.workspaces[storyName];
            if (!workspace || workspace.synopsisDraft === content) return state;
            return { workspaces: { ...state.workspaces, [storyName]: {
                ...workspace, synopsisDraft: content,
                synopsisIsEdited: content !== workspace.synopsis,
                synopsisSaveError: null,
            } } };
        });
    },

    saveSynopsis: (storyName) => {
        const previous = synopsisSaveQueues.get(storyName) ?? Promise.resolve();
        const task = previous.catch(() => {}).then(async () => {
            // Save once; edits made during IPC remain an unsaved shared draft.
            if (get().workspaces[storyName]?.synopsisIsEdited) {
                const content = get().workspaces[storyName].synopsisDraft;
                const updateStatus = (status) => set((state) => {
                    const workspace = state.workspaces[storyName];
                    if (!workspace) return state;
                    return { workspaces: { ...state.workspaces, [storyName]: { ...workspace, ...status } } };
                });
                updateStatus({ synopsisIsSaving: true, synopsisSaveError: null });
                try {
                    const info = await useFileStore.getState().updateStorySynopsis(storyName, content, { silent: true });
                    get().markSynopsisSaved(storyName, info, content);
                } catch (error) {
                    updateStatus({ synopsisSaveError: String(error) });
                    throw error;
                } finally {
                    updateStatus({ synopsisIsSaving: false });
                }
            }
        });
        synopsisSaveQueues.set(storyName, task);
        const clear = () => { if (synopsisSaveQueues.get(storyName) === task) synopsisSaveQueues.delete(storyName); };
        task.then(clear, clear);
        return task;
    },

    waitForSynopsisSave: (storyName) => synopsisSaveQueues.get(storyName) ?? Promise.resolve(),

    waitForSynopsisSaves: () => Promise.all([...synopsisSaveQueues.values()]),

    updateFilesList: (storyName, newFilesList) => {
        set((state) => {
            const workspace = state.workspaces[storyName];
            if (!workspace) return state;

            return {
                workspaces: {
                    ...state.workspaces,
                    [storyName]: {
                        ...workspace,
                        filesList: newFilesList,
                    },
                },
            };
        });
    },

    removeWorkspace: (storyName) => {
        set((state) => {
            const newWorkspaces = { ...state.workspaces };
            delete newWorkspaces[storyName];
            return { workspaces: newWorkspaces };
        });
    },

    renameStoryWorkspace: (oldName, newName) => {
        set((state) => {
            const workspace = state.workspaces[oldName];
            if (!workspace) return state;

            const newWorkspaces = { ...state.workspaces };
            delete newWorkspaces[oldName];

            newWorkspaces[newName] = {
                ...workspace,
                storyName: newName,
            };

            return { workspaces: newWorkspaces };
        });
    },
}));
