import React, { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import TextBox from "../../TextBox/textbox";
import { useTxtStore } from "../../../store/txtStore";
import { useFileStore } from "../../../store/fileStore";
import { useStoryStore } from "../../../store/storyStore";
import { useTabStore } from "../../../store/tabStore";
import { useAppSettings } from "../../../store/saving/appSettings";
import { useTranslation } from "react-i18next";

const BATTERY_LOW_EVENT = "battery-low";
const AUTO_SAVE_INTERVAL = 5 * 1000 * 60;

export default function TabWork({ story_name, title }) {
    const { t } = useTranslation();
    const { workspaces, initWorkspace, updateContent, loadContent, saveTitle, saveContent } = useTxtStore();
    const { settings } = useAppSettings();
    const { renameWorkTabs } = useTabStore();
    const { fetchWholeTxtList, getStoryInfo } = useFileStore();
    const { updateStoryInfo } = useStoryStore();

    const workspaceId = `${story_name}/${title}`;
    const workspace = workspaces[workspaceId];

    const [isTitleEdible, setIsTitleEdible] = useState(false);
    const [charLength, setCharLength] = useState(workspace?.content?.length || 0);

    const saveWorkspaceContent = useCallback(async () => {
        const latestWorkspace = useTxtStore.getState().workspaces[workspaceId];
        if (!latestWorkspace?.isEdited) return;

        await saveContent(workspaceId);
        const storyInfo = await getStoryInfo(latestWorkspace.story_name);
        updateStoryInfo(latestWorkspace.story_name, storyInfo);
    }, [workspaceId, saveContent, getStoryInfo, updateStoryInfo]);

    useEffect(() => {
        if (!workspaces[workspaceId]) {
            initWorkspace(workspaceId, story_name, title);

            loadContent(workspaceId, story_name, title);
        }
    }, [workspaceId, story_name, title, workspaces, initWorkspace, loadContent]);

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

    if (!workspace) return <div>{t("common.loading")}</div>;

    const handleChangeContent = (newText) => {
        updateContent(workspaceId, newText);
        setCharLength(newText.length);
    };

    const handleRename = async (newTitle) => {
        try {
            await saveTitle(workspaceId, newTitle);
            renameWorkTabs(story_name, title, newTitle);

            await fetchWholeTxtList();
            const storyInfo = await getStoryInfo(story_name);
            updateStoryInfo(story_name, storyInfo);

            console.log("Renamed to:", newTitle);
        } catch (err) {
            alert(t("work.renameFailed"));
        }
    };

    const handleSaveClick = async () => {
        await saveWorkspaceContent();
    };

    return (
        <TextBox
            workspaceId={workspaceId}
            title={workspace.title}
            content={workspace.content}
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
