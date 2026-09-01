use super::{atomic_file, file_manager, txt_info::TxtInfo};
use crate::utils::path_gate;
use std::fs;
use tauri::Manager;

#[tauri::command]
pub async fn load_txt(app: tauri::AppHandle, txt_info: TxtInfo) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let library_path = app_data_dir.join("TypeNap_Library");
    let text_path = path_gate::text_file(&library_path, &txt_info.story_name, &txt_info.title)?;
    let content = fs::read_to_string(text_path).map_err(|e| e.to_string())?;
    Ok(content)
}

#[tauri::command]
pub async fn save_content(
    app: tauri::AppHandle,
    txt_info: TxtInfo,
    content: String,
) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let library_path = app_data_dir.join("TypeNap_Library");
    let text_path = path_gate::text_file(&library_path, &txt_info.story_name, &txt_info.title)?;
    atomic_file::write_text(&text_path, &content).map_err(|error| error.to_string())?;
    file_manager::sync_story_info(&app, &txt_info.story_name, true)?;
    Ok(())
}

#[tauri::command]
pub async fn save_title(
    app: tauri::AppHandle,
    txt_info: TxtInfo,
    new_title: String,
) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let library_path = app_data_dir.join("TypeNap_Library");
    let text_path = path_gate::text_file(&library_path, &txt_info.story_name, &txt_info.title)?;
    let new_text_path = path_gate::text_file(&library_path, &txt_info.story_name, &new_title)?;
    fs::rename(text_path, new_text_path).map_err(|e| e.to_string())?;
    file_manager::sync_story_info(&app, &txt_info.story_name, true)?;
    Ok(())
}
