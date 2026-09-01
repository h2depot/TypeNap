use super::{atomic_file, backup_manager, file_manager, txt_info::TxtInfo};
use crate::utils::path_gate;
use serde::Serialize;
use std::fs;

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SaveDocumentError {
    Preparation {
        message: String,
    },
    AtomicWrite {
        stage: atomic_file::AtomicWriteStage,
        message: String,
    },
    Backup {
        message: String,
    },
    Metadata {
        message: String,
    },
}

// Creates a new document and its initial backup.
#[tauri::command]
pub async fn create_document_txt(app: tauri::AppHandle, txt_info: TxtInfo) -> Result<(), String> {
    let library_path = file_manager::get_library_path(&app)?;
    let text_path = path_gate::text_file(&library_path, &txt_info.story_name, &txt_info.title)?;

    if let Some(parent) = text_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::write(&text_path, "").map_err(|e| e.to_string())?;
    backup_manager::create_backup(
        app.clone(),
        txt_info.story_name.clone(),
        txt_info.title.clone(),
    )
    .await?;
    file_manager::sync_story_info(&app, &txt_info.story_name, true)?;

    Ok(())
}

// Saves document content and updates its backup.
#[tauri::command]
pub async fn save_document_content(
    app: tauri::AppHandle,
    txt_info: TxtInfo,
    content: String,
) -> Result<(), SaveDocumentError> {
    let library_path = file_manager::get_library_path(&app)
        .map_err(|message| SaveDocumentError::Preparation { message })?;
    let text_path = path_gate::text_file(&library_path, &txt_info.story_name, &txt_info.title)
        .map_err(|message| SaveDocumentError::Preparation { message })?;

    atomic_file::write_text(&text_path, &content).map_err(|error| {
        SaveDocumentError::AtomicWrite {
            stage: error.stage(),
            message: error.to_string(),
        }
    })?;
    backup_manager::increment_backup(
        app.clone(),
        txt_info.story_name.clone(),
        txt_info.title.clone(),
        content,
    )
    .map_err(|message| SaveDocumentError::Backup { message })?;
    file_manager::sync_story_info(&app, &txt_info.story_name, true)
        .map_err(|message| SaveDocumentError::Metadata { message })?;

    Ok(())
}

// Renames a document and its backup.
#[tauri::command]
pub async fn save_document_title(
    app: tauri::AppHandle,
    txt_info: TxtInfo,
    new_title: String,
) -> Result<(), String> {
    let library_path = file_manager::get_library_path(&app)?;

    let text_path = path_gate::text_file(&library_path, &txt_info.story_name, &txt_info.title)?;
    let new_text_path = path_gate::text_file(&library_path, &txt_info.story_name, &new_title)?;

    fs::rename(text_path, new_text_path).map_err(|e| e.to_string())?;
    backup_manager::rename_txt_backup(&app, &txt_info.story_name, &txt_info.title, &new_title)?;
    file_manager::sync_story_info(&app, &txt_info.story_name, true)?;

    Ok(())
}
