import { create } from "zustand";
import { LazyStore } from "@tauri-apps/plugin-store";
import { locale } from "@tauri-apps/plugin-os";
import { useToastStore } from "../toastStore";
import i18next from "../languageController";

const showErrorToast = (message, error) => {
  useToastStore.getState().addToast(i18next.t("common.errorWithDetail", { message, error: String(error) }), "error");
};

const store = new LazyStore("settings.json");

const defaultSettings = {
  settings_version: "0.1.0",
  theme: "System Theme", // "Light Theme", "Dark Theme", "System Theme"
  language: "ja", // "ja", "en"
  bgimage: {},
  fontSize: 16, // 12~24
  SavingTab: "On", // "On", "Off"
};

export const useAppSettings = create((set, get) => ({
  settings: defaultSettings,
  isReady: false,

  initSettings: async (version) => {
    try {
      const loadedSettings = {};

      if (version === "0.1.0") {
        let hasMissingSettings = false;

        for (const key of Object.keys(defaultSettings)) {
          const savedValue = await store.get(key);
          const isMissing = savedValue == null;
          const initialValue = isMissing && key === "language"
            ? (await locale())?.toLowerCase().startsWith("ja") ? "ja" : "en"
            : defaultSettings[key];
          loadedSettings[key] = isMissing ? initialValue : savedValue;

          if (isMissing) {
            await store.set(key, initialValue);
            hasMissingSettings = true;
          }
        }

        if (hasMissingSettings) {
          await store.save();
        }
      }

      set((state) => ({
        settings: {
          ...state.settings,
          ...loadedSettings
        },
        isReady: true,
      }));
    } catch (error) {
      showErrorToast(i18next.t("notice.settingsLoadFailed"), error);
      console.error("Failed to load settings:", error);
      set({ isReady: true });
    }
  },

  updateSetting: async (key, value) => {
    let stateChanged = false;
    set((state) => {
      if (state.settings[key] === value) {
        return state;
      }
      stateChanged = true;
      return {
        settings: {
          ...state.settings,
          [key]: value,
        },
      };
    });

    if (!stateChanged) return;

    try {
      await store.set(key, value);
      await store.save();
    } catch (error) {
      showErrorToast(i18next.t("notice.settingsSaveFailed"), error);
      console.error(`Failed to save setting [${key}]:`, error);
    }
  },
}));
