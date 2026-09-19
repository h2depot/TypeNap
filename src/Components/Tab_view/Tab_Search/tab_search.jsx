import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Webview } from '@tauri-apps/api/webview';
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi';
import { isTauri } from '@tauri-apps/api/core';
import {
    ChevronLeft,
    ChevronRight,
    RotateCw,
    MoreVertical,
    Globe,
    Search,
    Plus,
    Bookmark
} from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { GhostButton, GhostDialog, GhostIconButton, GhostTextField } from "../../GhostDesignSystem";
import { useTabStore } from "../../../store/tabStore";
import { useBrowserStore } from "../../../store/webbrowser/browserStore";
import { useAppSettings } from "../../../store/saving/appSettings";
import { useStatsStore } from "../../../store/saving/stats";
import styles from "./tab_search.module.css";
import { ShortcutIcon } from "./SiteIcon";
import SearchSuggestField from "./SearchSuggestField";
import { bookmarkUrl } from "../../../store/webbrowser/bookmarkUrl";
import { useToastStore } from "../../../store/toastStore";
import BookmarkDialog from "./BookmarkDialog";

const normalizeUrl = (value) => {
    const input = value.trim();
    if (!input) return "";
    const target = new URL(/^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`);
    if (target.protocol !== "https:") {
        throw new Error("HTTPS のURLを入力してください。");
    }
    return target.href;
};

export default function Tab_Search({ tabId, url: savedUrl = "", isActive = true }) {
    const { t } = useTranslation();
    const shortcuts = useStatsStore((state) => state.stats.bookmarks);
    const statsReady = useStatsStore((state) => state.isReady);
    const [menuOpen, setMenuOpen] = useState(false);
    const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);
    const menuRef = useRef(null);
    const menuItemRef = useRef(null);
    const menuId = React.useId();
    const closeBookmarkDialog = () => {
        setBookmarkDialogOpen(false);
        menuRef.current?.querySelector("button")?.focus();
    };
    const [shortcutDialogOpen, setShortcutDialogOpen] = useState(false);
    const [shortcutName, setShortcutName] = useState("");
    const [shortcutUrl, setShortcutUrl] = useState("");
    const [shortcutError, setShortcutError] = useState("");
    const [savingShortcut, setSavingShortcut] = useState(false);
    const savingShortcutRef = useRef(false);
    const [savingBookmark, setSavingBookmark] = useState(false);
    const savingBookmarkRef = useRef(false);

    useEffect(() => {
        if (!isActive) {
            setMenuOpen(false);
            setBookmarkDialogOpen(false);
        }
    }, [isActive]);

    useEffect(() => {
        if (!menuOpen) return;
        menuItemRef.current?.focus();
        const dismiss = (event) => {
            if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
        };
        const close = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setMenuOpen(false);
                menuRef.current?.querySelector("button")?.focus();
            }
        };
        document.addEventListener("pointerdown", dismiss);
        document.addEventListener("keydown", close);
        return () => {
            document.removeEventListener("pointerdown", dismiss);
            document.removeEventListener("keydown", close);
        };
    }, [menuOpen]);

    const closeShortcutDialog = () => {
        if (!savingShortcutRef.current) setShortcutDialogOpen(false);
    };

    const addShortcut = async (event) => {
        event.preventDefault();
        if (savingShortcutRef.current || !statsReady) return;
        const label = shortcutName.trim();
        if (!label) {
            setShortcutError(t("search.shortcutNameRequired", "名前を入力してください。"));
            return;
        }
        savingShortcutRef.current = true;
        setSavingShortcut(true);
        setShortcutError("");
        try {
            const browser = useBrowserStore.getState();
            if (!await browser.validateShortcutUrl(shortcutUrl)) {
                setShortcutError(t("search.shortcutInvalidUrl", "登録できるURLを入力してください。"));
                return;
            }
            const targetUrl = await browser.resolveUrl(shortcutUrl, useAppSettings.getState().settings.SearchingEngine);
            await useStatsStore.getState().addBookmark({ label, url: targetUrl });
            useToastStore.getState().addToast(t("search.bookmarkSaved"), "success");
            setShortcutDialogOpen(false);
        } catch (err) {
            setShortcutError(t("search.shortcutSaveFailed", "ショートカットを保存できませんでした。") + ` ${String(err)}`);
            useToastStore.getState().addToast(t("search.bookmarkSaveFailed"), "error");
        } finally {
            savingShortcutRef.current = false;
            setSavingShortcut(false);
        }
    };
    const updateTabPropsById = useTabStore((state) => state.updateTabPropsById);
    const webviewLabel = useBrowserStore((state) => state.webviews[tabId]);
    const registerWebview = useBrowserStore((state) => state.registerWebview);
    const unregisterWebview = useBrowserStore((state) => state.unregisterWebview);
    const [page, setPage] = useState(() => {
        try {
            const restoredUrl = normalizeUrl(savedUrl);
            return restoredUrl ? { url: restoredUrl } : null;
        } catch {
            return null;
        }
    });
    const [url, setUrl] = useState(page?.url || "");
    // The start screen is a virtual history entry before the native history.
    // Keep the Webview alive while showing it so Forward can restore the page.
    const [showHome, setShowHome] = useState(!page);
    const [centerSearch, setCenterSearch] = useState(page?.url || "");
    const [hasBeenActive, setHasBeenActive] = useState(isActive);
    const [error, setError] = useState("");
    const [navigation, setNavigation] = useState(null);
    const observedUrlRef = useRef(null);
    const requestRef = useRef(0);
    const viewportRef = useRef(null);
    const activeRef = useRef(isActive);
    const syncWebviewRef = useRef(null);
    const editingSearchRef = useRef(false);
    const currentBookmarkUrl = showHome ? "" : savedUrl;
    const isBookmarked = !!currentBookmarkUrl && shortcuts.some((item) => bookmarkUrl(item.url) === bookmarkUrl(currentBookmarkUrl));

    const toggleBookmark = async (nextBookmarked) => {
        if (savingBookmarkRef.current || !statsReady || !currentBookmarkUrl || !webviewLabel) return;
        // Capture the committed page URL, not an unfinished edit in the URL field.
        const targetUrl = currentBookmarkUrl;
        savingBookmarkRef.current = true;
        setSavingBookmark(true);
        try {
            if (nextBookmarked) {
                const tab = useTabStore.getState().tabsList.find((item) => item.id === tabId);
                const liveTitle = tab?.props.liveTitleUrl === targetUrl ? tab.title?.trim() : "";
                const info = await useBrowserStore.getState().getSiteInfo(targetUrl);
                const label = liveTitle || info.title || targetUrl;
                await useStatsStore.getState().addBookmark({ url: targetUrl, label });
                useToastStore.getState().addToast(
                    t(info.success ? "search.bookmarkSaved" : "search.bookmarkSavedPartially"),
                    info.success ? "success" : "warning",
                );
            } else {
                await useStatsStore.getState().removeBookmark(targetUrl);
            }
        } catch (err) {
            useToastStore.getState().addToast(t("common.errorWithDetail", {
                message: t("search.bookmarkSaveFailed", "ブックマークを保存できませんでした。"),
                error: String(err),
            }), "error");
        } finally {
            savingBookmarkRef.current = false;
            setSavingBookmark(false);
        }
    };

    useEffect(() => {
        const currentUrl = showHome ? "" : savedUrl;
        if (!currentUrl) {
            useTabStore.getState().updateSearchTabInfo(tabId, "", { title: "Search", icon: "Search" });
            return;
        }
        if (!hasBeenActive || !isTauri()) return;
        let disposed = false;
        useBrowserStore.getState().getSiteInfo(currentUrl).then((info) => {
            if (!disposed) useTabStore.getState().updateSearchTabInfo(tabId, currentUrl, info);
        });
        return () => { disposed = true; };
    }, [tabId, savedUrl, showHome, hasBeenActive]);

    useLayoutEffect(() => {
        // Native child Webviews cover HTML overlays; hide them while managing bookmarks.
        activeRef.current = isActive && !showHome && !menuOpen && !bookmarkDialogOpen;
        if (isActive) setHasBeenActive(true);
        syncWebviewRef.current?.();
    }, [isActive, showHome, menuOpen, bookmarkDialogOpen]);

    const openUrl = async (value) => {
        const request = ++requestRef.current;
        const input = value.trim();
        if (!input) {
            setPage(null);
            setShowHome(true);
            setError("");
            setUrl("");
            setCenterSearch("");
            updateTabPropsById(tabId, { url: "" });
            return;
        }
        try {
            if (!isTauri()) throw new Error("URLの表示はTauriアプリ内で利用できます。");
            const targetUrl = await useBrowserStore.getState().resolveUrl(
                input, useAppSettings.getState().settings.SearchingEngine
            );
            if (request !== requestRef.current) return;
            if (!showHome && useBrowserStore.getState().webviews[tabId]) {
                await useBrowserStore.getState().navigate(tabId, targetUrl);
            } else {
                // Searching from Home starts a new branch and discards Forward history.
                setPage({ url: targetUrl });
            }
            if (request !== requestRef.current) return;
            setShowHome(false);
            setError("");
            setUrl(targetUrl);
            setCenterSearch(targetUrl);
            updateTabPropsById(tabId, { url: targetUrl });
        } catch (err) {
            if (request === requestRef.current) setError(String(err));
        }
    };

    useEffect(() => {
        setNavigation(null);
        observedUrlRef.current = null;
        if (!webviewLabel || !isActive || showHome) return;
        let disposed = false;
        let timer;
        const syncNavigation = async () => {
            try {
                const state = await useBrowserStore.getState().navigationState(tabId);
                if (disposed) return;
                setNavigation(state);
                if (state.url !== observedUrlRef.current) {
                    observedUrlRef.current = state.url;
                    if (!editingSearchRef.current) {
                        setUrl(state.url);
                        setCenterSearch(state.url);
                    }
                    updateTabPropsById(tabId, { url: state.url });
                }
                // A page can update its document title without changing its URL.
                useTabStore.getState().updateSearchTabTitle(tabId, state.url, state.title);
            } catch (err) {
                if (!disposed) setError(String(err));
            } finally {
                if (!disposed) timer = setTimeout(syncNavigation, 500);
            }
        };
        void syncNavigation();
        return () => {
            disposed = true;
            clearTimeout(timer);
        };
    }, [tabId, webviewLabel, isActive, showHome, updateTabPropsById]);

    useEffect(() => () => { requestRef.current += 1; }, []);

    const handleNavigation = async (action) => {
        const request = ++requestRef.current;
        try {
            if (action === "forward" && showHome) {
                setShowHome(false);
                setError("");
                return;
            }
            if (showHome) return;
            if (action === "back") {
                // Query live history: the most recent poll may predate a navigation.
                const state = await useBrowserStore.getState().navigationState(tabId);
                if (request !== requestRef.current) return;
                if (state.canGoBack === false) {
                    setShowHome(true);
                    setUrl("");
                    setCenterSearch("");
                    updateTabPropsById(tabId, { url: "" });
                    setError("");
                    return;
                }
            }
            await useBrowserStore.getState()[action](tabId);
            if (request === requestRef.current) setError("");
        } catch (err) {
            if (request === requestRef.current) setError(String(err));
        }
    };

    useEffect(() => {
        // Restored background tabs load on first selection, then keep their Webview alive.
        if (!page || !hasBeenActive || !isTauri()) return;
        const viewport = viewportRef.current;
        const bounds = viewport.getBoundingClientRect();
        let disposed = false;
        let ready = false;
        const webview = new Webview(getCurrentWindow(), `search-${crypto.randomUUID()}`, {
            url: page.url,
            x: bounds.x,
            y: bounds.y,
            width: Math.max(1, bounds.width),
            height: Math.max(1, bounds.height),
            dragDropEnabled: false,
            focus: false,
        });
        const reportError = (err) => {
            if (!disposed) setError(String(err));
        };
        // Serialize native operations so rapid tab switches cannot leave a stale show pending.
        let pending = Promise.resolve();
        const close = () => {
            pending = pending.then(() => webview.close()).catch(console.error);
        };
        const resize = () => {
            if (!ready || disposed) return;
            pending = pending.then(async () => {
                if (disposed) return;
                if (!activeRef.current) {
                    await webview.hide();
                    return;
                }
                const rect = viewport.getBoundingClientRect();
                // Native webviews cover HTML toasts. Leave room beneath the page
                // while notifications (including their exit animation) are visible.
                const toastRect = document.querySelector('[data-toast-container]')?.getBoundingClientRect();
                const height = toastRect?.height > 0
                    ? Math.min(rect.height, toastRect.top - rect.top - 12)
                    : rect.height;
                await webview.setPosition(new LogicalPosition(rect.x, rect.y));
                await webview.setSize(new LogicalSize(Math.max(1, rect.width), Math.max(1, height)));
                if (disposed) return;
                if (activeRef.current) await webview.show();
                else await webview.hide();
            }).catch(reportError);
        };
        syncWebviewRef.current = resize;
        // Creation may finish after switching away or closing the tab.
        void webview.once("tauri://created", () => {
            ready = true;
            if (disposed) void close();
            else {
                registerWebview(tabId, webview.label);
                resize();
            }
        });
        void webview.once("tauri://error", ({ payload }) => reportError(payload));
        const observer = new ResizeObserver(resize);
        observer.observe(viewport);
        const toastContainer = document.querySelector('[data-toast-container]');
        if (toastContainer) observer.observe(toastContainer);
        window.addEventListener("resize", resize);
        return () => {
            disposed = true;
            unregisterWebview(tabId, webview.label);
            syncWebviewRef.current = null;
            observer.disconnect();
            window.removeEventListener("resize", resize);
            if (ready) void close();
        };
    }, [page, hasBeenActive, tabId, registerWebview, unregisterWebview]);

    const handleUrlChange = (e) => {
        setUrl(e.target.value);
        setCenterSearch(e.target.value);
    };

    return (
        <div className={styles.container}>
            {/* Frameless Slim Navigation Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.navGroup}>
                    <GhostIconButton
                        icon={<ChevronLeft size={17} />}
                        size="small"
                        variant="ghost"
                        aria-label="Back"
                        disabled={!webviewLabel || !navigation || showHome}
                        onClick={() => handleNavigation("back")}
                    />
                    <GhostIconButton
                        icon={<ChevronRight size={17} />}
                        size="small"
                        variant="ghost"
                        aria-label="Forward"
                        disabled={!webviewLabel || (!showHome && (!navigation || navigation.canGoForward === false))}
                        onClick={() => handleNavigation("forward")}
                    />
                    <GhostIconButton
                        icon={<RotateCw size={15} />}
                        size="small"
                        variant="ghost"
                        aria-label="Reload"
                        disabled={!webviewLabel || showHome}
                        onClick={() => handleNavigation("reload")}
                    />
                </div>

                {/* URL Input Bar */}
                <div className={styles.urlBarWrapper}>
                    <SearchSuggestField
                        toolbar
                        isBookmarked={isBookmarked}
                        onBookmarkToggle={toggleBookmark}
                        bookmarkDisabled={!statsReady || !currentBookmarkUrl || !webviewLabel || savingBookmark}
                        enabled={isActive && !shortcutDialogOpen && !menuOpen && !bookmarkDialogOpen}
                        value={url}
                        onChange={handleUrlChange}
                        onSubmit={openUrl}
                        onFocusChange={(focused) => { editingSearchRef.current = focused; }}
                        placeholder={t("search.placeholder", "URLを入力するか検索...")}
                        icon={<Globe size={15} />}
                        borderRadius="12px"
                    />
                </div>

                {/* Action Buttons */}
                <div className={styles.actionGroup} ref={menuRef} onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
                }}>
                    <GhostIconButton
                        icon={<MoreVertical size={16} />}
                        size="small"
                        variant="ghost"
                        aria-label={t("search.more")}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        aria-controls={menuOpen ? menuId : undefined}
                        onClick={() => setMenuOpen((open) => !open)}
                        onKeyDown={(event) => {
                            if (event.key === "ArrowDown") { event.preventDefault(); setMenuOpen(true); }
                        }}
                    />
                    {menuOpen && <div id={menuId} role="menu" aria-label={t("search.more")} className={styles.browserMenu}>
                        <button ref={menuItemRef} type="button" role="menuitem" className={styles.browserMenuItem}
                            onClick={() => { setMenuOpen(false); setBookmarkDialogOpen(true); }}>
                            <Bookmark size={17} />
                            {t("search.bookmarks")}
                        </button>
                    </div>}
                </div>
            </div>

            {/* Translucent Viewport with Chrome-like Center Search */}
            {error && <div role="alert">{error}</div>}
            <div ref={viewportRef} className={styles.viewportContainer}>
                <div className={styles.emptyView} style={{ visibility: showHome ? "visible" : "hidden" }}>
                    <div className={styles.ambientGlow} />

                    <motion.div
                        className={styles.centerContent}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                    >
                        {/* Chrome-like Center Search Box */}
                        <div className={styles.centerSearchWrapper}>
                            <SearchSuggestField
                                enabled={isActive && showHome && !shortcutDialogOpen && !menuOpen && !bookmarkDialogOpen}
                                value={centerSearch}
                                onChange={handleUrlChange}
                                onSubmit={openUrl}
                                onFocusChange={(focused) => { editingSearchRef.current = focused; }}
                                placeholder={t("search.centerPlaceholder", "Web を検索、または URL を入力")}
                                icon={<Search size={18} />}
                                borderRadius="24px"
                            />
                        </div>

                        {/* Shortcuts Grid */}
                        <div className={styles.shortcutsContainer}>
                            {shortcuts.map((item, index) => (
                                <button
                                    key={`${item.url}-${index}`}
                                    type="button"
                                    className={styles.shortcutItem}
                                    data-search-shortcut-url={item.url}
                                    onClick={() => openUrl(item.url)}
                                >
                                    <div className={styles.shortcutIconWrapper}>
                                        <ShortcutIcon url={item.url} enabled={isActive && showHome} />
                                    </div>
                                    <span className={styles.shortcutLabel}>{item.label}</span>
                                </button>
                            ))}
                            <div className={styles.shortcutItem}>
                                <GhostIconButton
                                    icon={<Plus size={20} />}
                                    disabled={!statsReady}

                                    onClick={() => {
                                        setShortcutName("");
                                        setShortcutUrl("");
                                        setShortcutError("");
                                        setShortcutDialogOpen(true);
                                    }}
                                />
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
            <BookmarkDialog isOpen={bookmarkDialogOpen && isActive} onClose={closeBookmarkDialog} />
            <GhostDialog isOpen={shortcutDialogOpen && isActive && showHome} onClose={closeShortcutDialog} title={t("search.addShortcut", "ショートカットを追加")}>
                <form className={styles.shortcutForm} onSubmit={addShortcut} onKeyDown={(event) => {
                    if (event.key === "Escape") closeShortcutDialog();
                    if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
                }}>
                    <label className={styles.shortcutField}>
                        {t("search.shortcutName", "名前")}
                        <GhostTextField value={shortcutName} onChange={(event) => setShortcutName(event.target.value)} disabled={savingShortcut} autoFocus />
                    </label>
                    <label className={styles.shortcutField}>
                        URL
                        <GhostTextField value={shortcutUrl} onChange={(event) => setShortcutUrl(event.target.value)} disabled={savingShortcut} placeholder="https://example.com" />
                    </label>
                    {shortcutError && <div role="alert">{shortcutError}</div>}
                    <div className={styles.shortcutActions}>
                        <GhostButton variant="secondary" onClick={closeShortcutDialog} disabled={savingShortcut}>{t("common.cancel", "キャンセル")}</GhostButton>
                        <GhostButton type="submit" disabled={savingShortcut || !statsReady}>OK</GhostButton>
                    </div>
                </form>
            </GhostDialog>
        </div>
    );
}
