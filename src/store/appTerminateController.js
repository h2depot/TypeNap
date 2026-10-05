import React, { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import TerminateAppDialog from "../Components/Dialog/TerminateAppDialog";
import { useTabStore } from "./tabStore";
import { useTxtStore } from "./txtStore";
import { useStoryStore } from "./storyStore";
import i18next from "./languageController";

const unsavedWorkFiles = () => {
    const { tabsList } = useTabStore.getState();
    const { workspaces } = useTxtStore.getState();
    return tabsList.filter(tab => tab.type === 'work')
        .map(tab => workspaces[tab.props?.workspaceID ?? `${tab.props?.story_name}/${tab.props?.title}`])
        .filter(workspace => workspace?.isEdited)
        .map(workspace => `${workspace.story_name} / ${workspace.title}`);
};

export default function AppTerminateController() {
    const [isOpen, setIsOpen] = useState(false);
    const [files, setFiles] = useState([]);
    useEffect(() => {
        const appWindow = getCurrentWindow();
        let unlisten;
        let active = true;
        let flushing = false;

        appWindow.onCloseRequested(async (event) => {
            if (flushing) { event.preventDefault(); return; }
            const pendingSynopsis = Object.values(useStoryStore.getState().workspaces)
                .some(workspace => workspace.synopsisIsSaving);
            if (pendingSynopsis) {
                event.preventDefault();
                flushing = true;
                try {
                    await useStoryStore.getState().waitForSynopsisSaves();
                } catch (error) {
                    console.error('Failed to finish synopsis saves before closing', error);
                } finally { flushing = false; }
                if (active) await appWindow.close();
                return;
            }
            const synopses = Object.entries(useStoryStore.getState().workspaces)
                .filter(([, workspace]) => workspace.synopsisIsEdited)
                .map(([name]) => `${name} / ${i18next.t('story.summary.synopsis')}`);
            const unsavedFiles = [...unsavedWorkFiles(), ...synopses];
            if (unsavedFiles.length) {
                event.preventDefault();
                setFiles(unsavedFiles);
                setIsOpen(true);
            }
        }).then((dispose) => {
            if (active) unlisten = dispose;
            else dispose();
        });

        return () => {
            active = false;
            unlisten?.();
        };
    }, []);

    const terminate = async () => {
        setIsOpen(false);
        await getCurrentWindow().destroy();
    };

    return React.createElement(TerminateAppDialog, {
        isOpen,
        files,
        onCancel: () => setIsOpen(false),
        onTerminate: terminate,
    });
}
