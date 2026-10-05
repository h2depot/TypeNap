import React, { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import TerminateAppDialog from "../Components/Dialog/TerminateAppDialog";
import { useTabStore } from "./tabStore";
import { useTxtStore } from "./txtStore";

export default function AppTerminateController() {
    const [isOpen, setIsOpen] = useState(false);
    const [files, setFiles] = useState([]);
    useEffect(() => {
        const appWindow = getCurrentWindow();
        let unlisten;
        let active = true;

        appWindow.onCloseRequested((event) => {
            const tabsList = useTabStore.getState().tabsList;
            if (tabsList.length === 0) return;

            const workspaces = useTxtStore.getState().workspaces;
            const unsavedFiles = tabsList
                .filter((tab) => tab.type === "work")
                .map((tab) => {
                    const storyName = tab.props?.story_name;
                    const title = tab.props?.title;
                    const workspaceId = tab.props?.workspaceID ?? `${storyName}/${title}`;
                    return workspaces[workspaceId];
                })
                .filter((workspace) => workspace?.isEdited)
                .map((workspace) => `${workspace.story_name} / ${workspace.title}`);

            if (unsavedFiles.length === 0) return;

            event.preventDefault();
            setFiles(unsavedFiles);
            setIsOpen(true);
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
