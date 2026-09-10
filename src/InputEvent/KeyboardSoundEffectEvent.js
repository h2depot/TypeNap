import { useEffect } from "react";
import { useAppSettings } from "../store/saving/appSettings";
import { invoke } from "@tauri-apps/api/core";

export default function KeyboardSoundEffectEvent() {
    const sound_effect = useAppSettings((state) => state.settings.sound_effect);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!sound_effect || sound_effect === 'None') return;

            if (event.key === 'Enter') {
                invoke('run_enter_sound_effect').catch((err) => {
                    console.error("Failed to run enter sound effect:", err);
                });
            } else {
                invoke('run_sound_effect').catch((err) => {
                    console.error("Failed to run sound effect:", err);
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [sound_effect]);

    useEffect(() => {
        if (!sound_effect || sound_effect === 'None') return;

        invoke('load_wavfile', { seTheme: sound_effect }).catch((err) => {
            console.error("Failed to load wavfile:", err);
        });
    }, [sound_effect]);

    return null;
}
