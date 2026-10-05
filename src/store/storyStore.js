import { create } from "zustand";

const currentTimestamp = () => Math.floor(Date.now() / 1000);

const validTimestamp = (timestamp) => timestamp > 0;

const nonEmptyCover = (cover) => (typeof cover === "string" && cover.trim() ? cover : null);

export const useStoryStore = create((set) => ({
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
                        cover,
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
                        synopsis: storyInfo.synopsis ?? "",
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

    markSynopsisSaved: (storyName, storyInfo = {}) => {
        set((state) => {
            const workspace = state.workspaces[storyName];
            if (!workspace) return state;

            return {
                workspaces: {
                    ...state.workspaces,
                    [storyName]: {
                        ...workspace,
                        synopsis: storyInfo.synopsis ?? workspace.synopsis,
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
