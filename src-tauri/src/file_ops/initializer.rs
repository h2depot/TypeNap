use super::{bgimage_manager, file_manager};
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;

#[derive(Serialize, Deserialize)]
pub struct InitializerState {
    pub integrated_version: String,
    pub settings_version: String,
    pub story_assets_version: String,
    pub image_assets_version: String,
    pub toured: bool,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum InitializationError {
    AppDataPath { message: String },
    BackupDirectory { message: String },
    AliveBackupDirectory { message: String },
    NecropolisDirectory { message: String },
    LibraryDirectory { message: String },
    BackgroundDirectory { message: String },
    BackgroundAssets { message: String },
    StoryAssets { message: String },
    JSONFile { message: String },
}

fn load_state(app: &tauri::AppHandle) -> Result<InitializerState, InitializationError> {
    let app_data_dir =
        app.path()
            .app_data_dir()
            .map_err(|error| InitializationError::AppDataPath {
                message: error.to_string(),
            })?;
    let json_path = app_data_dir.join("initializer.json");
    if json_path.exists() {
        let json_data =
            fs::read_to_string(json_path).map_err(|error| InitializationError::JSONFile {
                message: error.to_string(),
            })?;
        return serde_json::from_str(&json_data).map_err(|error| InitializationError::JSONFile {
            message: error.to_string(),
        });
    }

    Ok(InitializerState {
        integrated_version: String::new(),
        settings_version: String::from("1.0.1"),
        story_assets_version: String::new(),
        image_assets_version: String::new(),
        toured: false,
    })
}

fn save_state(app: &tauri::AppHandle, state: &InitializerState) -> Result<(), InitializationError> {
    let app_data_dir =
        app.path()
            .app_data_dir()
            .map_err(|error| InitializationError::AppDataPath {
                message: error.to_string(),
            })?;
    let json_data =
        serde_json::to_string_pretty(state).map_err(|error| InitializationError::JSONFile {
            message: error.to_string(),
        })?;
    fs::write(app_data_dir.join("initializer.json"), json_data).map_err(|error| {
        InitializationError::JSONFile {
            message: error.to_string(),
        }
    })
}

#[tauri::command]
pub fn create_dir_all(app: tauri::AppHandle) -> Result<bool, InitializationError> {
    let mut state = load_state(&app)?;
    let is_first_initialization = state.integrated_version.is_empty();
    let mut created = false;
    let backup_path = file_manager::get_backup_root_path(&app)
        .map_err(|message| InitializationError::BackupDirectory { message })?;
    let alive_backup_path = file_manager::get_backup_path(&app)
        .map_err(|message| InitializationError::AliveBackupDirectory { message })?;
    let necropolis_path = file_manager::get_necropolis_path(&app)
        .map_err(|message| InitializationError::NecropolisDirectory { message })?;
    let library_path = file_manager::get_library_path(&app)
        .map_err(|message| InitializationError::LibraryDirectory { message })?;

    if !backup_path.exists() {
        fs::create_dir_all(&backup_path).map_err(|error| InitializationError::BackupDirectory {
            message: error.to_string(),
        })?;
        created = true;
    }
    if !alive_backup_path.exists() {
        fs::create_dir_all(&alive_backup_path).map_err(|error| {
            InitializationError::AliveBackupDirectory {
                message: error.to_string(),
            }
        })?;
        created = true;
    }
    if !necropolis_path.exists() {
        fs::create_dir_all(&necropolis_path).map_err(|error| {
            InitializationError::NecropolisDirectory {
                message: error.to_string(),
            }
        })?;
        created = true;
    }
    if !library_path.exists() {
        fs::create_dir_all(&library_path).map_err(|error| {
            InitializationError::LibraryDirectory {
                message: error.to_string(),
            }
        })?;
        created = true;
    }

    if state.integrated_version != "1.0.1" {
        state.integrated_version = String::from("1.0.1");
    }

    save_state(&app, &state)?;

    Ok(created && !is_first_initialization)
}

#[tauri::command]
pub async fn initialize(app: tauri::AppHandle) -> Result<bool, InitializationError> {
    let mut state = load_state(&app)?;

    if state.image_assets_version != "1.0.1" {
        bgimage_manager::init_bgimage(&app)
            .map_err(|message| InitializationError::BackgroundAssets { message })?;
        state.image_assets_version = String::from("1.0.1");
    }

    if state.story_assets_version != "1.0.1" {
        let library_path = file_manager::get_library_path(&app)
            .map_err(|message| InitializationError::LibraryDirectory { message })?;
        let story_path = library_path.join("Hello World!");

        if !story_path.exists() {
            file_manager::create_story(
                app.clone(),
                String::from("Hello World!"),
                String::from("#101426"),
            )
            .await
            .map_err(|message| InitializationError::StoryAssets { message })?;
        }

        state.story_assets_version = String::from("1.0.1");
    }

    save_state(&app, &state)?;

    Ok(false)
}

#[tauri::command]
pub fn get_settings_state(app: tauri::AppHandle) -> Result<String, InitializationError> {
    Ok(load_state(&app)?.settings_version)
}

#[tauri::command]
pub fn get_toured_state(app: tauri::AppHandle) -> Result<bool, InitializationError> {
    Ok(load_state(&app)?.toured)
}

#[tauri::command]
pub fn set_toured_state(app: tauri::AppHandle, toured: bool) -> Result<(), InitializationError> {
    let mut state = load_state(&app)?;
    state.toured = toured;
    save_state(&app, &state)
}
