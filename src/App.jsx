import { TNThemeContext } from './Components/TNDesignSystem/theme';
import React, { useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import Navigation from "./Components/Nav/nav";
import WorkspaceTabs from "./Components/Workspace/WorkspaceTabs";
import Workspace from "./Components/Workspace/Workspace";
import FixedView from "./Components/FixedView";
import WindowControls from "./Components/WindowControls/WindowControls";
import { useAppSettings } from "./store/saving/appSettings";
import { useFileStore } from "./store/fileStore";
import { useStatsStore } from "./store/saving/stats";
import { useTabStore } from "./store/tabStore";
import { useToastStore } from "./store/toastStore";
import KeyboardShortcutEvent from "./InputEvent/KeyboardShortcutEvent";
import KeyboardSoundEffectEvent from "./InputEvent/KeyboardSoundEffectEvent";
import Trackpad from "./InputEvent/Trackpad";
import WelcomeTour from "./Components/TourContents/SplashScreen";
import tourPages from "./Components/TourContents/TourPages";
import { TN_Button, TN_DialogErrorHandling, TN_ToastContainer } from "./Components/TNDesignSystem";
import { AnimatePresence, motion } from "framer-motion";
import "./InputEvent/ContextMenu";
import NomalContextMenu from "./Components/ContextMenu/NomalContextMenu";
import i18next, { changeLanguage } from "./store/languageController";
import { useTranslation } from "react-i18next";
import AppTerminateController from "./store/appTerminateController";
import {
  initialize as initializeBackend,
  createDirAll,
  getSettingsState,
  getTouredState,
  setTouredState,
  initializationErrorMessage,
  normalizeInitializationError,
} from "./store/initializerInterface";

import { normalizeBackgroundPath, backgroundShellColor, backgroundContentColor } from "./Constants/colors";

function App() {
  const { t } = useTranslation();
  const initSettings = useAppSettings((state) => state.initSettings);
  const isSettingsReady = useAppSettings((state) => state.isReady);
  const initFileStore = useFileStore((state) => state.initialize);
  const isFileStoreReady = useFileStore((state) => state.isReady);
  const fileInitializationError = useFileStore((state) => state.initializationError);
  const initStats = useStatsStore((state) => state.initStats);
  const isStatsReady = useStatsStore((state) => state.isReady);
  const appMode = useTabStore((state) => state.appMode);
  const initTabStore = useTabStore((state) => state.initialize);
  const themeSetting = useAppSettings((state) => state.settings.theme);
  const languageSetting = useAppSettings((state) => state.settings.language);
  const bgImagePath = normalizeBackgroundPath(useAppSettings((state) => state.settings.bgimage?.path));
  const [systemTheme, setSystemTheme] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );

  useEffect(() => {
    if (themeSetting !== "System Theme") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    setSystemTheme(mediaQuery.matches ? "dark" : "light");

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeSetting]);

  const currentTheme = themeSetting === "System Theme"
    ? systemTheme
    : (themeSetting === "Light Theme" ? "light" : "dark");
  const isBgColor = bgImagePath?.startsWith("#") || bgImagePath?.startsWith("var(");

  const [tourDismissed, setTourDismissed] = useState(false);
  const [isInitializerReady, setIsInitializerReady] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(null);
  const [tourCompleted, setTourCompleted] = useState(null);
  const showTour = tourCompleted === false && !tourDismissed;
  const [backendInitializationError, setBackendInitializationError] = useState(null);
  const initializationError = backendInitializationError || fileInitializationError;

  useEffect(() => {
    let active = true;

    const runInitializer = async () => {
      try {
        const created = await createDirAll();
        await initializeBackend();
        const [version, hasCompletedTour] = await Promise.all([
          getSettingsState(),
          getTouredState(),
        ]);
        if (!active) return;
        if (created) {
          useToastStore.getState().addToast(i18next.t("notice.libraryCreated"), "warning");
        }
        setSettingsVersion(version);
        setTourCompleted(hasCompletedTour);
        setIsInitializerReady(true);
      } catch (error) {
        if (!active) return;
        const normalizedError = normalizeInitializationError(error);
        setBackendInitializationError({
          ...normalizedError,
          message: initializationErrorMessage(normalizedError.kind),
        });
      }
    };

    runInitializer();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isInitializerReady || settingsVersion === null) return;

    // Resolve the initial OS language before choosing the default bookmarks.
    initSettings(settingsVersion).then(() => {
      return initStats();
    });
    initFileStore();
  }, [isInitializerReady, settingsVersion, initSettings, initFileStore, initStats]);

  useEffect(() => {
    if (!isSettingsReady || !isStatsReady) return;

    initTabStore();
  }, [isSettingsReady, isStatsReady, initTabStore]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    if (!isSettingsReady) return;

    changeLanguage(languageSetting);
  }, [isSettingsReady, languageSetting]);

  const handleTourComplete = async () => {
    try {
      await setTouredState(true);
      setTourCompleted(true);
    } catch (error) {
      console.error("Failed to save tour state:", error);
    } finally {
      setTourDismissed(true);
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleExit = async () => {
    await getCurrentWindow().destroy();
  };

  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  return (
    <TNThemeContext.Provider value={currentTheme}>
    {(showTour || !isSettingsReady || !isFileStoreReady || !isStatsReady) && <WindowControls standalone />}
    <AnimatePresence mode="wait">
      {showTour ? (
        <motion.div
          key="tour"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            backgroundColor: 'var(--bg-primary)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <WelcomeTour
            tourPages={tourPages}
            onTourComplete={handleTourComplete}
          />
        </motion.div>
      ) : (
        (!isSettingsReady || !isFileStoreReady || !isStatsReady) ? null : (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="row"
            data-background={isBgColor ? "color" : bgImagePath ? "image" : "none"}
            style={{
              width: '100%',
              height: '100vh',
              backgroundColor: isBgColor ? backgroundShellColor(bgImagePath) : undefined,
              '--app-bg-image': bgImagePath && !isBgColor ? `url("${convertFileSrc(bgImagePath)}")` : 'none',
              '--app-workspace-bg': isBgColor ? backgroundContentColor(bgImagePath) : bgImagePath ? 'var(--app-glass-content)' : 'var(--app-default-content)',
            }}
          >
            <KeyboardShortcutEvent />
            <KeyboardSoundEffectEvent />
            <Trackpad />
            <div className="left-sidebar">
              <Navigation />
            </div>
            <div className="content-workspace">
              <WorkspaceTabs />
              <Workspace isActive={appMode === "workspace"} />
              {appMode !== "workspace" && <FixedView appMode={appMode} />}
            </div>
          </motion.div>
        )
      )}
      <NomalContextMenu />
      <AppTerminateController />
      <TN_ToastContainer toasts={toasts} onClose={removeToast} />
      <TN_DialogErrorHandling
        isOpen={Boolean(initializationError)}
        title={t("app.initializationError.title")}
        maxWidth="520px"
      >
        <p style={{ margin: '0 0 12px' }}>
          {initializationError?.message}
        </p>
        <p style={{ margin: '0 0 24px', color: 'var(--tn-subtext)' }}>
          {t("app.initializationError.message")}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <TN_Button variant="danger" onClick={handleExit}>
            {t("app.exit")}
          </TN_Button>
          <TN_Button variant="primary" onClick={handleReload}>
            {t("app.reload")}
          </TN_Button>
        </div>
      </TN_DialogErrorHandling>
    </AnimatePresence>
    </TNThemeContext.Provider>


  );

}

export default App;
