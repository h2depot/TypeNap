import React, { useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";
import Nav from "./Components/Nav/nav";
import Tabs from "./Components/Tabs/tabs";
import { useAppSettings } from "./store/saving/appSettings";
import { useFileStore } from "./store/fileStore";
import { useStatsStore } from "./store/saving/stats";
import { useTabStore } from "./store/tabStore";
import { useToastStore } from "./store/toastStore";
import KeyboardEvent from "./InputEvent/keyboardEvent";
import Trackpad from "./InputEvent/Trackpad";
import SplashScreen from "./Components/TourContents/SplashScreen";
import tourPages from "./Components/TourContents/TourPages";
import { GhostButton, GhostDialogErrorHandling, GhostToastContainer } from "./Components/GhostDesignSystem";
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

function App() {
  const { t } = useTranslation();
  const initSettings = useAppSettings((state) => state.initSettings);
  const isSettingsReady = useAppSettings((state) => state.isReady);
  const initFileStore = useFileStore((state) => state.initialize);
  const isFileStoreReady = useFileStore((state) => state.isReady);
  const fileInitializationError = useFileStore((state) => state.initializationError);
  const initStats = useStatsStore((state) => state.initStats);
  const isStatsReady = useStatsStore((state) => state.isReady);
  const initTabStore = useTabStore((state) => state.initialize);
  const themeSetting = useAppSettings((state) => state.settings.theme);
  const languageSetting = useAppSettings((state) => state.settings.language);
  const bgImagePath = useAppSettings((state) => state.settings.bgimage?.path);
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

  const [showSplash, setShowSplash] = useState(true);
  const [isInitializerReady, setIsInitializerReady] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(null);
  const [tourCompleted, setTourCompleted] = useState(null);
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

    initSettings(settingsVersion);
    initFileStore();
    initStats();
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

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  const handleTourComplete = async () => {
    try {
      await setTouredState(true);
      setTourCompleted(true);
    } catch (error) {
      console.error("Failed to save tour state:", error);
    } finally {
      setShowSplash(false);
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
    <AnimatePresence mode="wait">
      {showSplash ? (
        <motion.div
          key="splash"
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
          <SplashScreen
            theme={currentTheme}
            tourPages={tourPages}
            tourCompleted={tourCompleted}
            onComplete={handleSplashComplete}
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
            style={{
              width: '100%',
              height: '100vh',
              backgroundColor: isBgColor ? bgImagePath : undefined,
              '--app-bg-image': bgImagePath && !isBgColor ? `url("${convertFileSrc(bgImagePath)}")` : 'none',
              '--app-workspace-bg': bgImagePath ? 'var(--tb-container-bg-translucent)' : 'var(--tb-container-bg)',
            }}
          >
            <KeyboardEvent />
            <Trackpad />
            <div className="left-sidebar">
              <Nav />
            </div>
            <div className="content-workspace">
              <Tabs />
            </div>
          </motion.div>
        )
      )}
      <NomalContextMenu />
      <AppTerminateController />
      <GhostToastContainer toasts={toasts} onClose={removeToast} />
      <GhostDialogErrorHandling
        isOpen={Boolean(initializationError)}
        title={t("app.initializationError.title")}
        maxWidth="520px"
      >
        <p style={{ margin: '0 0 12px' }}>
          {initializationError?.message}
        </p>
        <p style={{ margin: '0 0 24px', color: 'var(--ghost-subtext)' }}>
          {t("app.initializationError.message")}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <GhostButton variant="danger" onClick={handleExit}>
            {t("app.exit")}
          </GhostButton>
          <GhostButton variant="primary" onClick={handleReload}>
            {t("app.reload")}
          </GhostButton>
        </div>
      </GhostDialogErrorHandling>
    </AnimatePresence>


  );

}

export default App;
