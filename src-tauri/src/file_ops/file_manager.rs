use super::{backup_manager, bgimage_manager, txt_info::TxtInfo};
use crate::utils::{path_gate, time_manager};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Serialize, Deserialize)]
pub struct StoryInfo {
    #[serde(default)]
    story_name: String,
    #[serde(default)]
    synopsis: String,
    #[serde(default, alias = "files")]
    chapters: Vec<String>,
    #[serde(default)]
    last_update: i64,
    #[serde(default)]
    created_at: i64,
    #[serde(default)]
    char_cnt: usize,
    #[serde(default)]
    cover: String,
}

pub fn get_library_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(app_data_dir.join("TypeNap_Library"))
}

pub fn get_backup_root_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(app_data_dir.join("Backup"))
}

pub fn get_backup_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(get_backup_root_path(app)?.join("Alive"))
}

pub fn get_necropolis_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(get_backup_root_path(app)?.join("Necropolis"))
}

pub fn get_bgimage_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    bgimage_manager::get_bgimage_path(app)
}

fn get_story_info_path(library_path: &Path, story_name: &str) -> Result<PathBuf, String> {
    path_gate::story_metadata(library_path, story_name)
}

fn empty_story_info(story_name: &str) -> StoryInfo {
    StoryInfo {
        story_name: story_name.to_string(),
        synopsis: String::new(),
        chapters: Vec::new(),
        last_update: time_manager::current_timestamp(),
        created_at: time_manager::current_timestamp(),
        char_cnt: 0,
        cover: String::new(),
    }
}

fn read_story_info(library_path: &Path, story_name: &str) -> StoryInfo {
    let story_info_path = match get_story_info_path(library_path, story_name) {
        Ok(path) => path,
        Err(_) => return empty_story_info(story_name),
    };
    let mut story_info = match fs::read_to_string(&story_info_path) {
        Ok(json_str) => match serde_json::from_str::<StoryInfo>(&json_str) {
            Ok(info) => info,
            Err(e) => {
                eprintln!(
                    "Failed to parse story_metadata.json for {}: {}",
                    story_name, e
                );
                // Attempt to recover partial data
                if let Ok(value) = serde_json::from_str::<serde_json::Value>(&json_str) {
                    let mut info = empty_story_info(story_name);
                    if let Some(name) = value.get("story_name").and_then(|v| v.as_str()) {
                        info.story_name = name.to_string();
                    }
                    if let Some(synopsis) = value.get("synopsis").and_then(|v| v.as_str()) {
                        info.synopsis = synopsis.to_string();
                    }
                    if let Some(chapters) = value.get("chapters").and_then(|v| v.as_array()) {
                        info.chapters = chapters
                            .iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect();
                    } else if let Some(files) = value.get("files").and_then(|v| v.as_array()) {
                        info.chapters = files
                            .iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect();
                    }
                    if let Some(last_update) = value.get("last_update").and_then(|v| v.as_i64()) {
                        info.last_update = last_update;
                    }
                    if let Some(created_at) = value.get("created_at").and_then(|v| v.as_i64()) {
                        info.created_at = created_at;
                    }
                    if let Some(char_cnt) = value.get("char_cnt").and_then(|v| v.as_u64()) {
                        info.char_cnt = char_cnt as usize;
                    }
                    if let Some(cover) = value.get("cover").and_then(|v| v.as_str()) {
                        info.cover = cover.to_string();
                    }
                    info
                } else {
                    empty_story_info(story_name)
                }
            }
        },
        Err(_) => empty_story_info(story_name),
    };

    if story_info.story_name.is_empty() || story_info.story_name != story_name {
        story_info.story_name = story_name.to_string();
    }
    if story_info.created_at == 0 {
        story_info.created_at = if story_info.last_update > 0 {
            story_info.last_update
        } else {
            time_manager::current_timestamp()
        };
    }
    if story_info.last_update == 0 {
        story_info.last_update = story_info.created_at;
    }

    story_info
}

fn collect_story_chapters(story_path: &Path) -> (Vec<String>, usize) {
    let mut chapters = Vec::new();
    let mut char_cnt: usize = 0;

    if let Ok(entries) = fs::read_dir(story_path) {
        for entry in entries.flatten() {
            let path = entry.path();

            if path.is_file() {
                if let Some(name) = entry.file_name().to_str() {
                    if let Some(title) = name.strip_suffix(".txt") {
                        if let Ok(text) = fs::read_to_string(&path) {
                            char_cnt += text.chars().count();
                            chapters.push(title.to_string());
                        }
                    }
                }
            }
        }
    }

    chapters.sort();
    (chapters, char_cnt)
}

fn write_story_info(library_path: &Path, story_info: &StoryInfo) -> Result<(), String> {
    let story_info_path = get_story_info_path(library_path, &story_info.story_name)?;
    if let Some(parent) = story_info_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string(story_info).map_err(|e| e.to_string())?;
    fs::write(story_info_path, json).map_err(|e| e.to_string())
}

pub fn sync_story_info(
    app: &tauri::AppHandle,
    story_name: &str,
    touch_last_update: bool,
) -> Result<StoryInfo, String> {
    let library_path = get_library_path(app)?;
    let story_path = path_gate::story_dir(&library_path, story_name)?;
    let (chapters, char_cnt) = collect_story_chapters(&story_path);
    let mut story_info = read_story_info(&library_path, story_name);

    let changed = story_info.chapters != chapters || story_info.char_cnt != char_cnt;

    story_info.chapters = chapters;
    story_info.char_cnt = char_cnt;
    if touch_last_update {
        story_info.last_update = time_manager::current_timestamp();
    }

    if changed || touch_last_update {
        write_story_info(&library_path, &story_info)?;
    }
    Ok(story_info)
}

// Returns the app's data directory.
#[tauri::command]
pub async fn get_base_path(app: tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(app_data_dir)
}

// Returns all saved stories.
#[tauri::command]
pub async fn get_story_list(app: tauri::AppHandle) -> Result<Vec<StoryInfo>, String> {
    let library_path = get_library_path(&app)?;
    let mut story_list = Vec::new();

    if let Ok(entries) = fs::read_dir(library_path) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    story_list.push(sync_story_info(&app, name, false)?);
                }
            }
        }
    }

    Ok(story_list)
}

// Returns the content of the specified text file.
#[tauri::command]
pub async fn get_txt_content(app: tauri::AppHandle, txt_info: TxtInfo) -> Result<String, String> {
    let library_path = get_library_path(&app)?;
    let text_path = path_gate::text_file(&library_path, &txt_info.story_name, &txt_info.title)?;
    let txt_content = fs::read_to_string(text_path).map_err(|e| e.to_string())?;
    Ok(txt_content)
}

// Returns information about the specified story.
#[tauri::command]
pub async fn get_story_info(
    app: tauri::AppHandle,
    story_name: String,
) -> Result<StoryInfo, String> {
    sync_story_info(&app, &story_name, false)
}

// Returns all text files across every story.
#[tauri::command]
pub async fn get_whole_txt_list(app: tauri::AppHandle) -> Result<Vec<TxtInfo>, String> {
    let library_path = get_library_path(&app)?;
    let mut whole_txt_list = Vec::new();

    if let Ok(stories) = fs::read_dir(&library_path) {
        for story in stories.flatten() {
            if story.path().is_dir() {
                let story_name = story.file_name().to_string_lossy().to_string();

                if let Ok(files) = fs::read_dir(story.path()) {
                    for file in files.flatten() {
                        let path = file.path();
                        if path.is_file()
                            && path.extension().and_then(|e| e.to_str()) == Some("txt")
                        {
                            let title = path
                                .file_stem()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string();

                            whole_txt_list.push(TxtInfo {
                                story_name: story_name.clone(),
                                title,
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(whole_txt_list)
}

// Creates a new story and its backup directory.
#[tauri::command]
pub async fn create_story(
    app: tauri::AppHandle,
    story_name: String,
    cover_color: String,
) -> Result<(), String> {
    let library_path = get_library_path(&app)?;
    let backup_path = get_backup_path(&app)?;

    let story_path = path_gate::story_dir(&library_path, &story_name)?;
    let story_backup_path = path_gate::story_dir(&backup_path, &story_name)?;

    fs::create_dir_all(story_path).map_err(|e| e.to_string())?;
    fs::create_dir_all(story_backup_path).map_err(|e| e.to_string())?;

    let mut story_info = empty_story_info(&story_name);
    story_info.cover = cover_color;
    write_story_info(&library_path, &story_info)?;

    Ok(())
}

// Deletes the specified story.
#[tauri::command]
pub async fn delete_story(app: tauri::AppHandle, story_name: String) -> Result<(), String> {
    let library_path = get_library_path(&app)?;
    let story_path = path_gate::story_dir(&library_path, &story_name)?;
    if story_path.is_dir() {
        backup_manager::retire_story_backup(&app, &story_name)?;
        fs::remove_dir_all(story_path).map_err(|e| e.to_string())?;
    } else {
        return Err("Story not found".to_string());
    }

    Ok(())
}

// Renames the specified story.
#[tauri::command]
pub async fn rename_story(
    app: tauri::AppHandle,
    old_story_name: String,
    new_story_name: String,
) -> Result<(), String> {
    let library_path = get_library_path(&app)?;
    let backup_path = get_backup_path(&app)?;

    let new_story_path = path_gate::story_dir(&library_path, &new_story_name)?;
    let old_story_path = path_gate::story_dir(&library_path, &old_story_name)?;
    let new_story_backup_path = path_gate::story_dir(&backup_path, &new_story_name)?;
    let old_story_backup_path = path_gate::story_dir(&backup_path, &old_story_name)?;

    if !old_story_path.exists() {
        return Err("Story not found".to_string());
    }
    if new_story_path.exists() {
        return Err("Story already exists".to_string());
    }
    fs::rename(old_story_path, new_story_path).map_err(|e| e.to_string())?;
    fs::rename(old_story_backup_path, new_story_backup_path).map_err(|e| e.to_string())?;

    sync_story_info(&app, &new_story_name, true)?;
    Ok(())
}

// Creates a new text file and its backup.
#[tauri::command]
pub async fn create_txt(app: tauri::AppHandle, txt_info: TxtInfo) -> Result<(), String> {
    let library_path = get_library_path(&app)?;
    let backup_path = get_backup_path(&app)?;

    let text_path = path_gate::text_file(&library_path, &txt_info.story_name, &txt_info.title)?;
    let text_backup_path =
        path_gate::text_backup(&backup_path, &txt_info.story_name, &txt_info.title)?;

    fs::write(text_path, "").map_err(|e| e.to_string())?;
    fs::write(text_backup_path, "{}").map_err(|e| e.to_string())?;

    sync_story_info(&app, &txt_info.story_name, true)?;
    Ok(())
}

// Deletes the specified text file.
#[tauri::command]
pub async fn delete_txt(app: tauri::AppHandle, txt_info: TxtInfo) -> Result<(), String> {
    let library_path = get_library_path(&app)?;
    let text_path = path_gate::text_file(&library_path, &txt_info.story_name, &txt_info.title)?;
    backup_manager::retire_txt_backup(&app, &txt_info.story_name, &txt_info.title)?;
    fs::remove_file(text_path).map_err(|e| e.to_string())?;
    sync_story_info(&app, &txt_info.story_name, true)?;
    Ok(())
}

// Finds files not managed by the app.
#[tauri::command]
pub async fn scan(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let library_path = get_library_path(&app)?;
    let alive_backup_path = get_backup_path(&app)?;
    let necropolis_path = get_necropolis_path(&app)?;
    let bgimage_path = get_bgimage_path(&app)?;
    let mut path_list = Vec::new();

    scan_dir(
        &app_data_dir,
        &app_data_dir,
        &library_path,
        &alive_backup_path,
        &necropolis_path,
        &bgimage_path,
        &mut path_list,
    );

    Ok(path_list)
}

fn scan_dir(
    dir_path: &Path,
    app_data_dir: &Path,
    library_path: &Path,
    alive_backup_path: &Path,
    necropolis_path: &Path,
    bgimage_path: &Path,
    path_list: &mut Vec<String>,
) {
    if let Ok(entries) = fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let path = entry.path();

            if path.is_dir() {
                scan_dir(
                    &path,
                    app_data_dir,
                    library_path,
                    alive_backup_path,
                    necropolis_path,
                    bgimage_path,
                    path_list,
                );
                continue;
            }

            if !is_expected_scan_file(
                &path,
                app_data_dir,
                library_path,
                alive_backup_path,
                necropolis_path,
                bgimage_path,
            ) {
                path_list.push(path.to_string_lossy().into_owned());
            }
        }
    }
}

fn is_expected_scan_file(
    path: &Path,
    app_data_dir: &Path,
    library_path: &Path,
    alive_backup_path: &Path,
    necropolis_path: &Path,
    bgimage_path: &Path,
) -> bool {
    if path == app_data_dir.join("settings.json")
        || path == app_data_dir.join("stats.json")
        || path == app_data_dir.join("initializer.json")
    {
        return true;
    }

    if path.starts_with(library_path) {
        if path
            .strip_prefix(library_path)
            .ok()
            .is_some_and(|relative_path| relative_path.components().count() < 2)
        {
            return false;
        }

        return path.file_name().and_then(|name| name.to_str()) == Some("story_metadata.json")
            || path.extension().and_then(|extension| extension.to_str()) == Some("txt");
    }

    if path.starts_with(alive_backup_path) {
        let is_backup_file = path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.ends_with("_backup.json"));
        let is_story_backup_file = path
            .strip_prefix(alive_backup_path)
            .ok()
            .is_some_and(|relative_path| relative_path.components().count() == 2);

        return is_backup_file && is_story_backup_file;
    }

    if path.starts_with(necropolis_path) {
        return path.extension().and_then(|extension| extension.to_str()) == Some("txt")
            || path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name == "metadata.json" || name == "manifest.json");
    }

    if path.starts_with(bgimage_path) {
        return path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| {
                matches!(
                    extension.to_ascii_lowercase().as_str(),
                    "jpg" | "jpeg" | "png"
                )
            });
    }

    false
}

// Deletes the specified unmanaged files and directories.
#[tauri::command]
pub async fn delete_non_txt_files(paths: Vec<String>) -> Result<(), String> {
    for path in paths {
        let path_buf = PathBuf::from(&path);
        if path_buf.is_dir() {
            let _ = fs::remove_dir_all(path_buf);
        } else {
            let _ = fs::remove_file(path_buf);
        }
    }
    Ok(())
}

// Updates the synopsis of the specified story.
#[tauri::command]
pub async fn update_story_synopsis(
    app: tauri::AppHandle,
    story_name: &str,
    content: &str,
    touch_last_update: Option<bool>,
) -> Result<StoryInfo, String> {
    let library_path = get_library_path(&app)?;
    let mut story_info = read_story_info(&library_path, story_name);

    story_info.synopsis = content.to_string();
    if touch_last_update.unwrap_or(true) {
        story_info.last_update = time_manager::current_timestamp();
    }
    write_story_info(&library_path, &story_info)?;

    Ok(story_info)
}

// Updates the cover of the specified story.
#[tauri::command]
pub async fn update_story_cover(
    app: tauri::AppHandle,
    story_name: &str,
    cover: &str,
    touch_last_update: Option<bool>,
) -> Result<StoryInfo, String> {
    let library_path = get_library_path(&app)?;
    let mut story_info = read_story_info(&library_path, story_name);

    story_info.cover = cover.to_string();
    if touch_last_update.unwrap_or(true) {
        story_info.last_update = time_manager::current_timestamp();
    }
    write_story_info(&library_path, &story_info)?;

    Ok(story_info)
}
