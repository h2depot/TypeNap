import { useHotkeys } from "react-hotkeys-hook";
import { useTxtStore } from "../store/txtStore";
import { useTabStore } from "../store/tabStore";
import { useFileStore } from "../store/fileStore";
import { useStoryStore } from "../store/storyStore";
import { shortcuts, isShortcutAvailable } from "./shortcuts";

const dispatch = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

export default function KeyboardShortcutEvent() {
    useHotkeys(shortcuts.map((shortcut) => shortcut.keys), async (event, hotkey) => {
        const shortcut = shortcuts.find((item) => item.keys === hotkey.hotkey);
        if (!shortcut) return;
        const state = useTabStore.getState();
        if (!isShortcutAvailable(shortcut, state, {
            isComposing: event.isComposing || event.keyCode === 229,
            overlayOpen: Boolean(document.querySelector('[role="dialog"], [role="menu"]')),
        })) return;
        event.preventDefault();
        if (event.repeat) return;
        const tab = state.appMode === 'workspace' ? state.tabsList[state.selectedIndex] : null;
        const workspaceID = tab && (tab.props.workspaceID || `${tab.props.story_name}/${tab.props.title}`);
        switch (shortcut.id) {
            case 'openWorkspace': state.setAppMode('workspace'); break;
            case 'openLibrary': state.setAppMode('library'); break;
            case 'openSettings': state.setAppMode('settings'); break;
            case 'addTab':
                state.setAppMode('workspace');
                dispatch('open-tab-launcher');
                break;
            case 'addSearch': state.addTab('search', 'Search'); break;
            case 'nextTab': state.setSelectedIndex((state.selectedIndex + 1) % state.tabsList.length); break;
            case 'previousTab': state.setSelectedIndex((state.selectedIndex - 1 + state.tabsList.length) % state.tabsList.length); break;
            case 'closeTab': dispatch('request-close-tab', { index: state.selectedIndex }); break;
            case 'save':
                if (tab.type === 'story') {
                    dispatch('save-story-synopsis', { storyName: tab.props.story_name });
                } else {
                    const { workspaces, saveContent } = useTxtStore.getState();
                    const workspace = workspaces[workspaceID];
                    if (!workspace?.isEdited) return;
                    try {
                        await saveContent(workspaceID);
                        const storyInfo = await useFileStore.getState().getStoryInfo(workspace.story_name);
                        useStoryStore.getState().updateStoryInfo(workspace.story_name, storyInfo);
                    } catch (error) {
                        console.error('Shortcut save failed', error);
                    }
                }
                break;
            case 'search': dispatch('open-search', { workspaceID }); break;
            case 'create':
                dispatch(state.appMode === 'library' ? 'open-add-story-dialog' : 'open-add-episode-dialog');
                break;
            case 'closeDialog': dispatch('close-dialogs'); break;
        }
    }, { enableOnFormTags: true, enableOnContentEditable: true });
    return null;
}
