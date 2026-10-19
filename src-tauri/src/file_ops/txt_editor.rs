use super::contents_info::ContentsInfo;
use crate::utils::path_gate;
use std::fs;
use tauri::Manager;

#[tauri::command]
pub async fn load_txt(
    app: tauri::AppHandle,
    contents_info: ContentsInfo,
) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let library_path = app_data_dir.join("TypeNap_Library");
    let text_path = path_gate::text_file(&library_path, &contents_info)?;
    let content = fs::read_to_string(text_path).map_err(|e| e.to_string())?;
    Ok(content)
}
