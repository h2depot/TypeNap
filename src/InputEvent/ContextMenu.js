import { useContextMenuStore } from "../store/contextMenuStore";
import { useAppSettings } from "../store/saving/appSettings";
import { useTabStore } from "../store/tabStore";
import i18next from "../store/languageController";

document.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    try {
        const x = e.clientX;
        const y = e.clientY;

        const target = e.target;
        const isEditable = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
        const hasSelection = window.getSelection().toString().length > 0;

        const options = [];

        if (isEditable) {
            const start = target.selectionStart;
            const end = target.selectionEnd;

            options.push({
                label: i18next.t("contextMenu.cut"),
                disabled: !hasSelection,
                onClick: () => {
                    target.focus();
                    target.setSelectionRange(start, end);
                    document.execCommand("cut");
                    // Trigger input event to update React/Zustand state
                    const event = new Event('input', { bubbles: true });
                    target.dispatchEvent(event);
                }
            });
            options.push({
                label: i18next.t("contextMenu.copy"),
                disabled: !hasSelection,
                onClick: () => {
                    target.focus();
                    target.setSelectionRange(start, end);
                    document.execCommand("copy");
                }
            });
            options.push({
                label: i18next.t("contextMenu.paste"),
                onClick: async () => {
                    try {
                        const text = await navigator.clipboard.readText();
                        target.focus();
                        target.setSelectionRange(start, end);

                        // Insert at cursor
                        const val = target.value;
                        target.value = val.substring(0, start) + text + val.substring(end);

                        // Trigger input event so React state updates
                        const event = new Event('input', { bubbles: true });
                        target.dispatchEvent(event);

                        // Restore cursor position
                        target.selectionStart = target.selectionEnd = start + text.length;
                        target.focus();
                    } catch (err) {
                        console.error("Failed to paste: ", err);
                    }
                }
            });
            options.push({
                label: i18next.t("contextMenu.selectAll"),
                onClick: () => {
                    target.focus();
                    target.select();
                }
            });
            options.push({ isSeparator: true });
        } else if (hasSelection) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0).cloneRange();
                options.push({
                    label: i18next.t("contextMenu.copy"),
                    onClick: () => {
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                        document.execCommand("copy");
                    }
                });
                options.push({ isSeparator: true });
            }
        }

        // Tab-specific options
        const { tabsList, selectedIndex } = useTabStore.getState();
        const currentTab = tabsList[selectedIndex];

        if (currentTab?.type === "library") {
            options.push({
                label: i18next.t("contextMenu.newStory"),
                onClick: () => {
                    window.dispatchEvent(new CustomEvent("open-add-story-dialog"));
                }
            });
            options.push({ isSeparator: true });
        } else if (currentTab?.type === "story") {
            options.push({
                label: i18next.t("contextMenu.newFile"),
                onClick: () => {
                    window.dispatchEvent(new CustomEvent("open-add-episode-dialog"));
                }
            });
            options.push({ isSeparator: true });
        }

        // Global/Workspace options
        const currentTheme = useAppSettings.getState().settings.theme;
        // Resolve system theme if theme is set to "System Theme"
        let resolvedTheme = currentTheme;
        if (currentTheme === "System Theme") {
            resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "Dark Theme" : "Light Theme";
        }
        const nextTheme = resolvedTheme === "Light Theme" ? "Dark Theme" : "Light Theme";

        options.push({
            label: i18next.t("contextMenu.switchTheme", {
                theme: i18next.t(nextTheme === "Dark Theme" ? "settings.theme.names.dark" : "settings.theme.names.light")
            }),
            onClick: () => {
                useAppSettings.getState().updateSetting("theme", nextTheme);
            }
        });

        options.push({
            label: i18next.t("contextMenu.reload"),
            onClick: () => {
                window.location.reload();
            }
        });

        useContextMenuStore.getState().showMenu(x, y, options);
    } catch (err) {
        console.error("Failed to open context menu:", err);
    }
});

// Close context menu on any click outside
document.addEventListener("mousedown", (e) => {
    const menuEl = document.getElementById("nomal-context-menu");
    if (menuEl && menuEl.contains(e.target)) {
        return;
    }
    useContextMenuStore.getState().closeMenu();
});
