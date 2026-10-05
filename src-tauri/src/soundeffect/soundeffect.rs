use super::sound_loader;
use super::sound_runner;

#[tauri::command]
pub async fn run_sound_effect() -> Result<(), String> {
    sound_runner::play_sound()
}

#[tauri::command]
pub async fn run_enter_sound_effect() -> Result<(), String> {
    sound_runner::play_enter_sound()
}

#[tauri::command]
pub async fn load_wavfile(se_theme: String) -> Result<(), String> {
    let data = sound_loader::load_wavfile(se_theme)?;
    sound_runner::set_sound_data(data)
}
