use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::path::BaseDirectory;
use tauri::Manager;

#[derive(Serialize)]
pub struct BgImageInfo {
    name: String,
    kind: String,
    path: String,
}

pub fn get_bgimage_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(app_data_dir.join("BgImage"))
}

pub fn init_bgimage(app: &tauri::AppHandle) -> Result<(), String> {
    let bgimage_path = get_bgimage_path(app)?;
    let preset_dir = bgimage_path.join("presets");
    let user_dir = bgimage_path.join("user");

    fs::create_dir_all(&preset_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&user_dir).map_err(|e| e.to_string())?;

    let resource_path = app
        .path()
        .resolve("bg_assets", BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;

    for entry in fs::read_dir(resource_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let source_path = entry.path();

        if !source_path.is_file() {
            continue;
        }

        let dest_path = preset_dir.join(entry.file_name());
        if !dest_path.exists() {
            fs::copy(source_path, dest_path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

// Adds an image to the user background collection.
#[tauri::command]
pub fn add_user_image(app: tauri::AppHandle, img_path: PathBuf) -> Result<(), String> {
    if !img_path.is_file() {
        return Err("Image file not found".to_string());
    }

    let img_name = img_path
        .file_name()
        .ok_or_else(|| "Image file name not found".to_string())?;
    let user_dir = get_bgimage_path(&app)?.join("user");
    let new_path = user_dir.join(img_name);

    fs::create_dir_all(&user_dir).map_err(|e| e.to_string())?;
    if !new_path.exists() {
        fs::copy(img_path, &new_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// Deletes an image from the user background collection.
#[tauri::command]
pub fn delete_user_image(app: tauri::AppHandle, img_name: &str) -> Result<(), String> {
    let img_name = Path::new(img_name)
        .file_name()
        .ok_or_else(|| "Image file name not found".to_string())?;
    let user_dir = get_bgimage_path(&app)?.join("user");
    let target_path = user_dir.join(img_name);
    if target_path.is_file() {
        fs::remove_file(target_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Returns all preset and user background images.
#[tauri::command]
pub async fn get_whole_image_list(app: tauri::AppHandle) -> Result<Vec<BgImageInfo>, String> {
    let bgimage_path = get_bgimage_path(&app)?;
    let mut image_list = Vec::new();

    collect_image_list(&bgimage_path.join("presets"), "preset", &mut image_list)?;
    collect_image_list(&bgimage_path.join("user"), "user", &mut image_list)?;

    image_list.sort_by(|a, b| a.kind.cmp(&b.kind).then_with(|| a.name.cmp(&b.name)));

    Ok(image_list)
}

fn collect_image_list(
    dir_path: &Path,
    kind: &str,
    image_list: &mut Vec<BgImageInfo>,
) -> Result<(), String> {
    if !dir_path.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(dir_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if !path.is_file() || !is_supported_image_file(&path) {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        image_list.push(BgImageInfo {
            name,
            kind: kind.to_string(),
            path: path.to_string_lossy().into_owned(),
        });
    }

    Ok(())
}

fn is_supported_image_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "png" | "jpg" | "jpeg"
            )
        })
}
