use super::{
    atomic_file, backup_manager,
    contents_info::{ContentType, ContentsInfo, CreateContentsInput},
    document_name, file_manager,
};
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
pub async fn create_document_txt(
    app: tauri::AppHandle,
    input: CreateContentsInput,
) -> Result<ContentsInfo, String> {
    let _write_guard = backup_manager::CONTENT_WRITE_LOCK.lock().map_err(|error| error.to_string())?;
    if input.content_type != ContentType::Txt {
        return Err("Expected txt content".into());
    }
    let library_path = file_manager::get_library_path(&app)?;
    let path = {
        let _guard = document_name::CREATION_LOCK
            .lock()
            .map_err(|e| e.to_string())?;
        document_name::create(
            &library_path,
            &file_manager::get_backup_root_path(&app)?,
            &input.story_name,
            &input.name,
        )?
    };
    let info = super::content_path::inspect(&input.story_name, &path)
        .ok_or("Invalid created text file")?;
    backup_manager::create_backup(&app, &info)?;
    file_manager::sync_story_info(&app, &info.story_name, true)?;
    Ok(info)
}

// Saves document content and updates its backup.
#[tauri::command]
pub async fn save_document_content(
    app: tauri::AppHandle,
    contents_info: ContentsInfo,
    content: String,
) -> Result<(), SaveDocumentError> {
    let _guard =
        backup_manager::CONTENT_WRITE_LOCK
            .lock()
            .map_err(|e| SaveDocumentError::Preparation {
                message: e.to_string(),
            })?;
    let library_path = file_manager::get_library_path(&app)
        .map_err(|message| SaveDocumentError::Preparation { message })?;
    let text_path = path_gate::text_file(&library_path, &contents_info)
        .map_err(|message| SaveDocumentError::Preparation { message })?;

    backup_manager::create_backup(&app, &contents_info)
        .map_err(|message| SaveDocumentError::Preparation { message })?;
    atomic_file::write_text(&text_path, &content).map_err(|error| {
        SaveDocumentError::AtomicWrite {
            stage: error.stage(),
            message: error.to_string(),
        }
    })?;
    backup_manager::record_current(&app, &contents_info)
        .map_err(|message| SaveDocumentError::Backup { message })?;
    file_manager::sync_story_info(&app, &contents_info.story_name, true)
        .map_err(|message| SaveDocumentError::Metadata { message })?;

    Ok(())
}

// Renames a document and its backup.
#[tauri::command]
pub async fn save_document_title(
    app: tauri::AppHandle,
    contents_info: ContentsInfo,
    new_title: String,
) -> Result<(), String> {
    let _write_guard = backup_manager::CONTENT_WRITE_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    let library_path = file_manager::get_library_path(&app)?;
    let _guard = document_name::CREATION_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    contents_info.require_type(ContentType::Txt)?;
    let (text_path, new_text_path) =
        super::content_path::renamed_path(&library_path, &contents_info, &new_title)?;
    let old_stem = text_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| "Invalid text file name".to_string())?;
    let new_stem = new_text_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or("Invalid text file name")?;
    if text_path == new_text_path {
        return Ok(());
    }
    fs::rename(&text_path, &new_text_path).map_err(|e| e.to_string())?;
    backup_manager::rename_backup(&app, &contents_info, old_stem, new_stem)?;
    file_manager::sync_story_info(&app, &contents_info.story_name, true)?;

    Ok(())
}
