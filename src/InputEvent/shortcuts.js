// Runtime bindings and Settings help share this list.
export const shortcuts = [
    { id: 'openWorkspace', keys: 'ctrl+1', label: 'Ctrl + 1', scope: 'global' },
    { id: 'openLibrary', keys: 'ctrl+2', label: 'Ctrl + 2', scope: 'global' },
    { id: 'openSettings', keys: 'ctrl+comma', label: 'Ctrl + ,', scope: 'global' },
    { id: 'addTab', keys: 'ctrl+t', label: 'Ctrl + T', scope: 'global' },
    { id: 'addSearch', keys: 'ctrl+shift+t', label: 'Ctrl + Shift + T', scope: 'global' },
    { id: 'nextTab', keys: 'ctrl+tab', label: 'Ctrl + Tab', scope: 'tab' },
    { id: 'previousTab', keys: 'ctrl+shift+tab', label: 'Ctrl + Shift + Tab', scope: 'tab' },
    { id: 'closeTab', keys: 'ctrl+w', label: 'Ctrl + W', scope: 'tab' },
    { id: 'save', keys: 'ctrl+s', label: 'Ctrl + S', scope: 'document' },
    { id: 'search', keys: 'ctrl+f', label: 'Ctrl + F', scope: 'work' },
    { id: 'create', keys: 'ctrl+n', label: 'Ctrl + N', scope: 'create' },
    { id: 'closeDialog', keys: 'esc', label: 'Esc', scope: 'global' },
];

export function isShortcutAvailable(shortcut, state, { isComposing = false, overlayOpen = false } = {}) {
    if (isComposing) return false;
    if (shortcut.id === 'closeDialog') return true;
    if (overlayOpen || state.tabLauncherOpen) return false;
    const tab = state.appMode === 'workspace' ? state.tabsList[state.selectedIndex] : null;
    switch (shortcut.scope) {
        case 'tab': return Boolean(tab);
        case 'document': return tab?.type === 'work' || tab?.type === 'story';
        case 'work': return tab?.type === 'work';
        case 'create': return state.appMode === 'library' || tab?.type === 'story';
        default: return true;
    }
}
