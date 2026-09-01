import { useHotkeys } from "react-hotkeys-hook";
import { useTxtStore } from "../store/txtStore";
import { useTabStore } from "../store/tabStore";
import { useFileStore } from "../store/fileStore";
import { useStoryStore } from "../store/storyStore";

export default function KeyboardEvent() {
    const { saveContent, workspaces } = useTxtStore();
    const { tabsList, selectedIndex, setSelectedIndex, addTab } = useTabStore();
    const { getStoryInfo } = useFileStore();
    const { updateStoryInfo } = useStoryStore();


    useHotkeys('ctrl+s', async (event) => {
        event.preventDefault();
        console.log("ctrl+s pressed");
        const currentTab = tabsList[selectedIndex];
        if (currentTab?.type === 'work') {
            const workspaceID = currentTab.props.workspaceID || `${currentTab.props.story_name}/${currentTab.props.title}`;
            const workspace = workspaces[workspaceID];

            if (!workspace || !workspace.isEdited) {
                return;
            }
            await saveContent(workspaceID);
            const storyInfo = await getStoryInfo(workspace.story_name);
            updateStoryInfo(workspace.story_name, storyInfo);
        } else if (currentTab?.type === 'story') {
            window.dispatchEvent(new CustomEvent('save-story-synopsis', {
                detail: { storyName: currentTab.props.story_name }
            }));
        }
    }, { enableOnFormTags: true }, [tabsList, selectedIndex, workspaces, saveContent, getStoryInfo, updateStoryInfo]);

    useHotkeys('ctrl+f', async (event) => {
        event.preventDefault();
        const currentTab = tabsList[selectedIndex];
        if (currentTab?.type === 'work') {
            const workspaceID = currentTab.props.workspaceID || `${currentTab.props.story_name}/${currentTab.props.title}`;
            const workspace = workspaces[workspaceID];
            window.dispatchEvent(new CustomEvent('open-search', { detail: { workspaceID } }));
        }
    }, { enableOnFormTags: true }, [tabsList, selectedIndex, workspaces]);

    useHotkeys('ctrl+tab', (event) => {
        event.preventDefault();
        const count = tabsList.length;
        setSelectedIndex((selectedIndex + 1) % count);
    }, { enableOnFormTags: true }, [tabsList, selectedIndex]);

    useHotkeys('ctrl+shift+tab', (event) => {
        event.preventDefault();
        const count = tabsList.length;
        setSelectedIndex((selectedIndex - 1 + count) % count);
    }, { enableOnFormTags: true }, [tabsList, selectedIndex]);

    useHotkeys('ctrl+w', (event) => {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('request-close-tab', {
            detail: { index: selectedIndex }
        }));
    }, { enableOnFormTags: true }, [tabsList, selectedIndex]);

    useHotkeys('ctrl+comma', (event) => {
        event.preventDefault();
        addTab('settings', 'Settings')
        console.log("Ctrl+comma pressed");
    }, { enableOnFormTags: true }, [tabsList, selectedIndex]);

    useHotkeys('ctrl+period', (event) => {
        event.preventDefault();
        addTab('library', 'Library')
        console.log("Ctrl+period pressed");
    }, { enableOnFormTags: true }, [tabsList, selectedIndex]);

    useHotkeys('ctrl+h', (event) => {
        event.preventDefault();
        addTab('home', 'Home');
        console.log("Ctrl+h pressed");
    }, { enableOnFormTags: true }, [tabsList, selectedIndex]);

    useHotkeys('ctrl+n', (event) => {
        event.preventDefault();
        const currentTab = tabsList[selectedIndex];
        if (currentTab?.type === 'library') {
            window.dispatchEvent(new CustomEvent('open-add-story-dialog'));
        } else if (currentTab?.type === 'story') {
            window.dispatchEvent(new CustomEvent('open-add-episode-dialog'));
        }
    }, { enableOnFormTags: true }, [tabsList, selectedIndex]);

    useHotkeys('esc', (event) => {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('close-dialogs'));
        console.log("Esc pressed: closing dialogs");
    }, { enableOnFormTags: true });

    return null;
}
