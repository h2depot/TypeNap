import { contentId, contentsInfo } from '../../../store/contentsInfo.js';
import React, { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import JSONBox from "../../JSONBox/jsonbox";
import TextBox from "../../TextBox/textbox";
import { useTxtStore } from "../../../store/txtStore";
import { useFileStore } from "../../../store/fileStore";
import { useStoryStore } from "../../../store/storyStore";
import { useTabStore } from "../../../store/tabStore";
import { useAppSettings } from "../../../store/saving/appSettings";
import { useTranslation } from "react-i18next";

const BATTERY_LOW_EVENT = "battery-low";
const AUTO_SAVE_INTERVAL = 5 * 1000 * 60;

export default function TabWork({ story_name, title, access_id, content_type = "txt", name }) {
    const { t } = useTranslation();
    const { workspaces, initWorkspace, updateContent, loadContent, saveTitle, saveContent } = useTxtStore();
    const { settings } = useAppSettings();
    const { renameWorkTabs } = useTabStore();
    const { fetchWholeTxtList, getStoryInfo } = useFileStore();
    const { updateStoryInfo } = useStoryStore();

    const workspaceId = contentId({ access_id });
    const workspace = workspaces[workspaceId];

    const [isTitleEdible, setIsTitleEdible] = useState(false);
    const charLength = workspace?.content?.length ?? 0;

    const saveWorkspaceContent = useCallback(async () => {
        const latestWorkspace = useTxtStore.getState().workspaces[workspaceId];
        if (!latestWorkspace?.isEdited) return;

        await saveContent(workspaceId);
        const storyInfo = await getStoryInfo(latestWorkspace.story_name);
        updateStoryInfo(latestWorkspace.story_name, storyInfo);
    }, [workspaceId, saveContent, getStoryInfo, updateStoryInfo]);

    useEffect(() => {
        if (!workspaces[workspaceId]) {
            const info = contentsInfo({ story_name, name: name ?? title, access_id, content_type });
            initWorkspace(info);
            void loadContent(info);
        }
    }, [workspaceId, story_name, title, access_id, content_type, name, workspaces, initWorkspace, loadContent]);

    useEffect(() => {
        const intervalId = setInterval(async () => {
            try {
                await saveWorkspaceContent();
            } catch (error) {
                console.error("Auto save failed:", error);
            }
        }, AUTO_SAVE_INTERVAL);

        return () => clearInterval(intervalId);
    }, [saveWorkspaceContent]);

    useEffect(() => {
        let isSubscribed = true;
        let unlistenBatteryLow;

        listen(BATTERY_LOW_EVENT, async (event) => {
            console.log("Battery low detected! Triggering autosave.", event.payload);

            try {
                await saveWorkspaceContent();
            } catch (error) {
                console.error("Battery-triggered auto save failed:", error);
            }
        }).then((unlisten) => {
            if (isSubscribed) {
                unlistenBatteryLow = unlisten;
                return;
            }

            unlisten();
        }).catch((error) => {
            console.error("Failed to listen for battery events:", error);
        });

        return () => {
            isSubscribed = false;
            unlistenBatteryLow?.();
        };
    }, [saveWorkspaceContent]);

    if (!workspace || workspace.isLoading) return <div>{t("common.loading")}</div>;
    if (workspace.loadError) return <div role="alert">{workspace.loadError}</div>;

    const handleChangeContent = (newText) => {
        updateContent(workspaceId, newText);
    };

    const handleRename = async (newTitle) => {
        const renamed = await saveTitle(workspaceId, newTitle);
        if (renamed) renameWorkTabs(renamed);

        try {
            await fetchWholeTxtList();
            const storyInfo = await getStoryInfo(story_name);
            updateStoryInfo(story_name, storyInfo);

            console.log("Renamed to:", newTitle);
        } catch (err) {
            // The rename already succeeded; list refresh errors must not revert
            // the editor title to a name that no longer exists on disk.
            console.error('Failed to refresh lists after renaming', err);
        }
    };

    const handleSaveClick = async () => {
        await saveWorkspaceContent();
    };

    const Editor = ["character", "world", "entity"].includes(content_type) ? JSONBox : TextBox;
    return (
        <Editor
            workspaceId={workspaceId}
            title={workspace.title}
            content={workspace.content}
            contentType={content_type}
            onChangeContent={handleChangeContent}
            isTitleEdible={isTitleEdible}
            setIsTitleEdible={setIsTitleEdible}
            onRename={handleRename}
            isSaved={!workspace.isEdited}
            onSaveClick={handleSaveClick}
            charLength={charLength}
            fontSize={settings.fontSize}
        />
    );
}
