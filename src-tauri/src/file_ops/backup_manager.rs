use super::file_manager;
use crate::utils::{path_gate, time_manager};
use serde::{Deserialize, Serialize};
use std::fs;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};

const BACKUP_NODE_INCREMENT_LIMIT: usize = 50;
const BACKUP_FILE_SIZE_RATIO_LIMIT: u64 = 5;
const MIN_COMPARE_CONTENT_BYTES: u64 = 1024; // 1024B

#[derive(Serialize, Deserialize)]
pub struct BackupJson {
    #[serde(default)]
    story_name: String,
    #[serde(default)]
    file_name: String,
    #[serde(default, alias = "files")]
    backups: Vec<BackupNode>,
}

#[derive(Clone, Serialize, Deserialize)]
struct NecropolisManifestEntry {
    #[serde(rename = "kind")]
    backup_kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    file_name: Option<String>,
    deleted_at: i64,
    #[serde(default, alias = "original_backup_path")]
    original_source_path: String,
    #[serde(default)]
    stored_backup_paths: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct NecropolisManifest {
    story_name: String,
    updated_at: i64,
    #[serde(default)]
    entries: Vec<NecropolisManifestEntry>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum StoredNecropolisManifest {
    Current(NecropolisManifest),
    Legacy(LegacyNecropolisManifest),
}

#[derive(Deserialize)]
struct LegacyNecropolisManifest {
    #[serde(rename = "kind")]
    backup_kind: String,
    story_name: String,
    #[serde(default)]
    file_name: Option<String>,
    deleted_at: i64,
    original_backup_path: String,
}

#[derive(Serialize, Deserialize)]
pub struct BackupNode {
    #[serde(default)]
    base_content: String,
    #[serde(default)]
    incremental_content: Vec<IncrementalNode>,
}

#[derive(Serialize, Deserialize)]
pub struct IncrementalNode {
    #[serde(default)]
    timestamp: i64,
    #[serde(default)]
    diff: Vec<LinePatch>,
}

#[derive(Serialize, Deserialize)]
pub struct LinePatch {
    #[serde(default)]
    line_number: usize,
    #[serde(default)]
    base_text: String,
    #[serde(default)]
    changed_text: String,
    #[serde(default)]
    is_deleted: bool,
}

// Creates the initial backup for a text file.
#[tauri::command]
pub async fn create_backup(
    app: tauri::AppHandle,
    story_name: String,
    file_name: String,
) -> Result<(), String> {
    path_gate::validate_name(&story_name)?;
    path_gate::validate_name(&file_name)?;
    let library_path = file_manager::get_library_path(&app)?;
    let file_path = library_path
        .join(&story_name)
        .join(format!("{}.txt", file_name));
    let base_content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    write_initial_backup(&app, &story_name, &file_name, base_content)
}

fn create_backup_from_text_path(
    app: &tauri::AppHandle,
    story_name: &str,
    text_path: &Path,
) -> Result<(), String> {
    let file_name = text_path
        .file_stem()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "txt file name not found".to_string())?;
    let base_content = fs::read_to_string(text_path).map_err(|e| e.to_string())?;
    write_initial_backup(app, story_name, file_name, base_content)
}

fn write_initial_backup(
    app: &tauri::AppHandle,
    story_name: &str,
    file_name: &str,
    base_content: String,
) -> Result<(), String> {
    let backup_path = file_manager::get_backup_path(app)?
        .join(story_name)
        .join(format!("{}_backup.json", file_name));

    if let Some(parent) = backup_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let backup_node: BackupNode = BackupNode {
        base_content: base_content.clone(),
        incremental_content: Vec::new(),
    };

    let backup_json: BackupJson = BackupJson {
        story_name: story_name.to_string(),
        file_name: file_name.to_string(),
        backups: vec![backup_node],
    };

    let json = serde_json::to_string(&backup_json).map_err(|e| e.to_string())?;
    fs::write(&backup_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

// Appends the latest changes to a text file's backup.
#[tauri::command]
pub fn increment_backup(
    app: tauri::AppHandle,
    story_name: String,
    file_name: String,
    _content: String,
) -> Result<(), String> {
    path_gate::validate_name(&story_name)?;
    path_gate::validate_name(&file_name)?;
    let backup_path = file_manager::get_backup_path(&app)?;
    let backup_path = backup_path
        .join(&story_name)
        .join(format!("{}_backup.json", file_name));
    let backup_file = File::open(&backup_path).map_err(|e| e.to_string())?;
    let backup_reader = BufReader::new(backup_file);
    let mut backup_json: BackupJson =
        serde_json::from_reader(backup_reader).map_err(|e| e.to_string())?;

    let library_path = file_manager::get_library_path(&app)?;
    let story_path = library_path.join(&story_name);
    let file_path = story_path.join(format!("{}.txt", file_name));

    let new_content: String = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let old_content: String = if backup_json.backups.is_empty() {
        String::new()
    } else {
        fetch_backup_string(&backup_json)?
    };
    let inc_node: IncrementalNode = diff(old_content.clone(), new_content)?;
    if inc_node.diff.is_empty() {
        return Ok(());
    }

    if should_enqueue_backup_node(&backup_json) {
        let mut backup_node = BackupNode {
            base_content: old_content,
            incremental_content: Vec::new(),
        };
        push_incremental_node(&mut backup_node, inc_node)?;
        backup_json.backups.push(backup_node);
    } else if let Some(backup) = backup_json.backups.last_mut() {
        push_incremental_node(backup, inc_node)?;
    } else {
        let mut backup_node = BackupNode {
            base_content: String::new(),
            incremental_content: Vec::new(),
        };
        push_incremental_node(&mut backup_node, inc_node)?;
        backup_json.backups.push(backup_node);
    }

    let json = serde_json::to_string(&backup_json).map_err(|e| e.to_string())?;
    fs::write(&backup_path, json).map_err(|e| e.to_string())?;

    if should_deque_backup_node(&backup_json, &backup_path)? {
        backup_json.backups.remove(0);
        let json = serde_json::to_string(&backup_json).map_err(|e| e.to_string())?;
        fs::write(&backup_path, json).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupGeneration {
    pub generation_index: usize,
    pub generation_count: usize,
    pub timestamp: i64,
    pub content: String,
}

// Returns the revision history of a text file.
#[tauri::command]
pub fn get_backup_history(
    app: tauri::AppHandle,
    story_name: String,
    file_name: String,
) -> Result<Vec<BackupGeneration>, String> {
    path_gate::validate_name(&story_name)?;
    path_gate::validate_name(&file_name)?;
    let backup_path = file_manager::get_backup_path(&app)?;
    let backup_path = backup_path
        .join(&story_name)
        .join(format!("{}_backup.json", file_name));

    if !backup_path.exists() {
        return Ok(Vec::new());
    }

    let backup_file = File::open(&backup_path).map_err(|e| e.to_string())?;
    let backup_reader = BufReader::new(backup_file);
    let backup_json: BackupJson =
        serde_json::from_reader(backup_reader).map_err(|e| e.to_string())?;

    let mut history = Vec::new();

    let generation_count = backup_json.backups.len();

    for (generation_index, backup_node) in backup_json.backups.iter().enumerate() {
        let current_content = backup_node.base_content.clone();

        history.push(BackupGeneration {
            generation_index,
            generation_count,
            timestamp: 0,
            content: current_content.clone(),
        });

        let mut lines: Vec<String> = current_content
            .lines()
            .map(|line| line.to_string())
            .collect();

        for inc_node in &backup_node.incremental_content {
            apply_incremental_node_to_lines(&mut lines, inc_node)?;
            let new_content = lines.join("\n");
            history.push(BackupGeneration {
                generation_index,
                generation_count,
                timestamp: inc_node.timestamp,
                content: new_content.clone(),
            });
        }
    }

    Ok(history)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedFileInfo {
    pub story_name: String,
    pub updated_at: i64,
    pub directory_name: String,
    pub entries: Vec<DeletedEntryInfo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedEntryInfo {
    pub backup_kind: String,
    pub file_name: Option<String>,
    pub deleted_at: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestItem {
    pub directory_name: String,
    pub backup_kind: String,
    pub file_name: Option<String>,
}

// Restores the specified deleted stories or text files.
#[tauri::command]
pub fn restore_deleted_files(
    app: tauri::AppHandle,
    items: Vec<RequestItem>,
) -> Result<bool, String> {
    let library_path = file_manager::get_library_path(&app)?;
    let necropolis_path = file_manager::get_necropolis_path(&app)?;

    let mut success = true;

    for item in items {
        if restore_deleted_item(&app, &library_path, &necropolis_path, item).is_err() {
            success = false;
        }
    }

    Ok(success)
}

fn restore_deleted_item(
    app: &tauri::AppHandle,
    library_path: &Path,
    necropolis_path: &Path,
    item: RequestItem,
) -> Result<(), String> {
    let directory_path = checked_child_path(necropolis_path, &item.directory_name)?;
    if !directory_path.exists() {
        return Ok(());
    }
    if !directory_path.is_dir() {
        return Err("Necropolis directory not found".to_string());
    }

    let mut manifest = read_necropolis_manifest(&directory_path)?
        .ok_or_else(|| "Necropolis manifest not found".to_string())?;
    let story_name = manifest.story_name.clone();
    let entry_index = manifest
        .entries
        .iter()
        .position(|entry| {
            entry.backup_kind == item.backup_kind && entry.file_name == item.file_name
        })
        .ok_or_else(|| "Necropolis entry not found".to_string())?;
    let entry = manifest.entries.remove(entry_index);

    match entry.backup_kind.as_str() {
        "story" => restore_story_entry(app, library_path, &directory_path, &story_name, &entry)?,
        "txt" => restore_txt_entry(app, library_path, &directory_path, &story_name, &entry)?,
        _ => return Err("unsupported Necropolis entry kind".to_string()),
    }

    persist_necropolis_manifest(&directory_path, &manifest)
}

// Permanently deletes the specified retired items.
#[tauri::command]
pub fn execute_complete_deletion(
    app: tauri::AppHandle,
    items: Vec<RequestItem>,
) -> Result<bool, String> {
    let necropolis_path = file_manager::get_necropolis_path(&app)?;

    let mut success = true;

    for item in items {
        if delete_necropolis_item(&necropolis_path, item).is_err() {
            success = false;
        }
    }

    Ok(success)
}

fn delete_necropolis_item(necropolis_path: &Path, item: RequestItem) -> Result<(), String> {
    let directory_path = checked_child_path(necropolis_path, &item.directory_name)?;
    if !directory_path.is_dir() {
        return Err("Necropolis directory not found".to_string());
    }

    let mut manifest = read_necropolis_manifest(&directory_path)?
        .ok_or_else(|| "Necropolis manifest not found".to_string())?;
    let entry_index = manifest
        .entries
        .iter()
        .position(|entry| {
            entry.backup_kind == item.backup_kind && entry.file_name == item.file_name
        })
        .ok_or_else(|| "Necropolis entry not found".to_string())?;
    let entry = manifest.entries.remove(entry_index);

    match entry.backup_kind.as_str() {
        "story" => fs::remove_dir_all(&directory_path).map_err(|e| e.to_string()),
        "txt" => {
            for stored_path_str in &entry.stored_backup_paths {
                let stored_path = PathBuf::from(stored_path_str);
                let source_file = if stored_path.is_absolute() {
                    stored_path
                } else {
                    directory_path.join(stored_path)
                };

                if source_file.exists() {
                    fs::remove_file(source_file).map_err(|e| e.to_string())?;
                }
            }
            persist_necropolis_manifest(&directory_path, &manifest)
        }
        _ => Err("unsupported Necropolis entry kind".to_string()),
    }
}

fn restore_story_entry(
    app: &tauri::AppHandle,
    library_path: &Path,
    directory_path: &Path,
    story_name: &str,
    entry: &NecropolisManifestEntry,
) -> Result<(), String> {
    if entry.stored_backup_paths.is_empty() || !is_safe_path_component(story_name) {
        return Err("invalid story restore entry".to_string());
    }

    let target_story_name = available_rev_name(library_path, story_name);
    let target_story_path = library_path.join(&target_story_name);
    let staging_story_path = available_staging_story_path(library_path, &target_story_name);
    fs::create_dir_all(&staging_story_path).map_err(|e| e.to_string())?;

    let result = copy_story_sources(directory_path, &staging_story_path, entry)
        .and_then(|restored_file_names| {
            if target_story_path.exists() {
                return Err("restore target already exists".to_string());
            }
            fs::rename(&staging_story_path, &target_story_path).map_err(|e| e.to_string())?;
            for file_name in restored_file_names {
                create_backup_from_text_path(
                    app,
                    &target_story_name,
                    &target_story_path.join(file_name),
                )?;
            }
            Ok(())
        })
        .and_then(|_| file_manager::sync_story_info(app, &target_story_name, true).map(|_| ()));

    if result.is_err() {
        let _ = fs::remove_dir_all(&staging_story_path);
    }

    result
}

fn restore_txt_entry(
    app: &tauri::AppHandle,
    library_path: &Path,
    directory_path: &Path,
    story_name: &str,
    entry: &NecropolisManifestEntry,
) -> Result<(), String> {
    if entry.stored_backup_paths.is_empty() || !is_safe_path_component(story_name) {
        return Err("invalid txt restore entry".to_string());
    }

    let target_story_path = library_path.join(story_name);
    fs::create_dir_all(&target_story_path).map_err(|e| e.to_string())?;
    let original_file_name = original_source_file_name(entry)?;
    let mut restored_sources = Vec::new();

    for stored_path_str in &entry.stored_backup_paths {
        let source_file = checked_existing_necropolis_file(directory_path, stored_path_str)?;
        let target_file = available_rev_path(&target_story_path, &original_file_name);
        fs::copy(&source_file, &target_file).map_err(|e| e.to_string())?;
        create_backup_from_text_path(app, story_name, &target_file)?;
        restored_sources.push(source_file);
    }

    for source_file in restored_sources {
        fs::remove_file(source_file).map_err(|e| e.to_string())?;
    }

    file_manager::sync_story_info(app, story_name, true)?;
    Ok(())
}

fn copy_story_sources(
    directory_path: &Path,
    staging_story_path: &Path,
    entry: &NecropolisManifestEntry,
) -> Result<Vec<PathBuf>, String> {
    let mut restored_file_names = Vec::new();

    for stored_path_str in &entry.stored_backup_paths {
        let source_file = checked_existing_necropolis_file(directory_path, stored_path_str)?;
        let original_file_name = source_file
            .file_name()
            .ok_or_else(|| "source file name not found".to_string())?;
        if !is_safe_path_component(original_file_name.to_string_lossy().as_ref()) {
            return Err("invalid source file name".to_string());
        }

        let target_file = staging_story_path.join(original_file_name);
        fs::copy(&source_file, &target_file).map_err(|e| e.to_string())?;
        restored_file_names.push(PathBuf::from(original_file_name));
    }

    Ok(restored_file_names)
}

fn available_rev_name(parent: &Path, name: &str) -> String {
    if !parent.join(name).exists() {
        return name.to_string();
    }

    let mut rev_count = 1;
    loop {
        let candidate = if rev_count == 1 {
            format!("{}_rev", name)
        } else {
            format!("{}_rev_{}", name, rev_count)
        };
        if !parent.join(&candidate).exists() {
            return candidate;
        }
        rev_count += 1;
    }
}

fn available_rev_path(parent: &Path, file_name: &str) -> PathBuf {
    let mut target_file = parent.join(file_name);
    if !target_file.exists() {
        return target_file;
    }

    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(file_name);
    let ext = path.extension().and_then(|extension| extension.to_str());
    let mut rev_count = 1;

    loop {
        let candidate = match (rev_count, ext) {
            (1, Some(ext)) => format!("{}_rev.{}", stem, ext),
            (_, Some(ext)) => format!("{}_rev_{}.{}", stem, rev_count, ext),
            (1, None) => format!("{}_rev", stem),
            (_, None) => format!("{}_rev_{}", stem, rev_count),
        };
        target_file = parent.join(candidate);
        if !target_file.exists() {
            return target_file;
        }
        rev_count += 1;
    }
}

fn available_staging_story_path(library_path: &Path, story_name: &str) -> PathBuf {
    let timestamp = time_manager::current_timestamp();
    let mut staging_story_path =
        library_path.join(format!("{}_restoring_{}", story_name, timestamp));
    let mut staging_index = 2;

    while staging_story_path.exists() {
        staging_story_path = library_path.join(format!(
            "{}_restoring_{}_{}",
            story_name, timestamp, staging_index
        ));
        staging_index += 1;
    }

    staging_story_path
}

fn original_source_file_name(entry: &NecropolisManifestEntry) -> Result<String, String> {
    let file_name = PathBuf::from(&entry.original_source_path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_string())
        .ok_or_else(|| "original source file name not found".to_string())?;

    if is_safe_path_component(&file_name) {
        Ok(file_name)
    } else {
        Err("invalid original source file name".to_string())
    }
}

fn checked_child_path(parent: &Path, child_name: &str) -> Result<PathBuf, String> {
    if !is_safe_path_component(child_name) {
        return Err("invalid path component".to_string());
    }

    Ok(parent.join(child_name))
}

fn checked_existing_necropolis_file(
    necropolis_dir: &Path,
    stored_path_str: &str,
) -> Result<PathBuf, String> {
    let source_file = PathBuf::from(stored_path_str);
    let source_file = if source_file.is_absolute() {
        source_file
    } else {
        necropolis_dir.join(source_file)
    };
    let canonical_source = source_file.canonicalize().map_err(|e| e.to_string())?;
    let canonical_dir = necropolis_dir.canonicalize().map_err(|e| e.to_string())?;

    if !canonical_source.is_file() || !canonical_source.starts_with(&canonical_dir) {
        return Err("stored backup path is outside Necropolis".to_string());
    }

    Ok(canonical_source)
}

fn persist_necropolis_manifest(
    necropolis_dir: &Path,
    manifest: &NecropolisManifest,
) -> Result<(), String> {
    if manifest.entries.is_empty() {
        fs::remove_dir_all(necropolis_dir).map_err(|e| e.to_string())
    } else {
        let json = serde_json::to_string(manifest).map_err(|e| e.to_string())?;
        fs::write(necropolis_dir.join("manifest.json"), json).map_err(|e| e.to_string())
    }
}

fn is_safe_path_component(name: &str) -> bool {
    let mut components = Path::new(name).components();
    matches!(components.next(), Some(std::path::Component::Normal(_)))
        && components.next().is_none()
}

// Returns all restorable deleted items.
#[tauri::command]
pub fn get_deleted_files(app: tauri::AppHandle) -> Result<Vec<DeletedFileInfo>, String> {
    let necropolis_path = file_manager::get_necropolis_path(&app)?;
    if !necropolis_path.exists() {
        return Ok(Vec::new());
    }

    let mut deleted_files = Vec::new();

    if let Ok(entries) = fs::read_dir(necropolis_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            if let Ok(Some(manifest)) = read_necropolis_manifest(&path) {
                let directory_name = entry.file_name().to_string_lossy().into_owned();
                let mut entries_info = Vec::new();
                for manifest_entry in manifest.entries {
                    entries_info.push(DeletedEntryInfo {
                        backup_kind: manifest_entry.backup_kind,
                        file_name: manifest_entry.file_name,
                        deleted_at: manifest_entry.deleted_at,
                    });
                }
                deleted_files.push(DeletedFileInfo {
                    story_name: manifest.story_name,
                    updated_at: manifest.updated_at,
                    directory_name,
                    entries: entries_info,
                });
            }
        }
    }

    deleted_files.sort_by_key(|a| std::cmp::Reverse(a.updated_at));
    Ok(deleted_files)
}

pub fn retire_story_backup(app: &tauri::AppHandle, story_name: &str) -> Result<(), String> {
    path_gate::validate_name(story_name)?;
    let alive_story_path = file_manager::get_backup_path(app)?.join(story_name);
    let library_story_path = file_manager::get_library_path(app)?.join(story_name);
    if !library_story_path.exists() {
        return Ok(());
    }

    let deleted_at = time_manager::current_timestamp();
    let necropolis_dir = prepare_necropolis_dir(app, story_name, deleted_at)?;
    fs::create_dir_all(&necropolis_dir).map_err(|e| e.to_string())?;

    let stored_backup_paths =
        snapshot_story_texts(&library_story_path, &necropolis_dir, deleted_at)?;
    if alive_story_path.exists() {
        fs::remove_dir_all(&alive_story_path).map_err(|e| e.to_string())?;
    }

    append_necropolis_manifest(
        &necropolis_dir,
        story_name,
        deleted_at,
        NecropolisManifestEntry {
            backup_kind: "story".to_string(),
            file_name: None,
            deleted_at,
            original_source_path: library_story_path.to_string_lossy().into_owned(),
            stored_backup_paths,
        },
    )
}

pub fn retire_txt_backup(
    app: &tauri::AppHandle,
    story_name: &str,
    file_name: &str,
) -> Result<(), String> {
    path_gate::validate_name(story_name)?;
    path_gate::validate_name(file_name)?;
    let alive_backup_path = file_manager::get_backup_path(app)?
        .join(story_name)
        .join(format!("{}_backup.json", file_name));
    let library_text_path = file_manager::get_library_path(app)?
        .join(story_name)
        .join(format!("{}.txt", file_name));
    if !library_text_path.exists() {
        return Ok(());
    }

    let deleted_at = time_manager::current_timestamp();
    let necropolis_dir = prepare_necropolis_dir(app, story_name, deleted_at)?;
    fs::create_dir_all(&necropolis_dir).map_err(|e| e.to_string())?;

    let necropolis_text_path = snapshot_txt(&library_text_path, &necropolis_dir, deleted_at)?;
    if alive_backup_path.exists() {
        fs::remove_file(&alive_backup_path).map_err(|e| e.to_string())?;
        remove_empty_parent_dir(&alive_backup_path)?;
    }

    append_necropolis_manifest(
        &necropolis_dir,
        story_name,
        deleted_at,
        NecropolisManifestEntry {
            backup_kind: "txt".to_string(),
            file_name: Some(file_name.to_string()),
            deleted_at,
            original_source_path: library_text_path.to_string_lossy().into_owned(),
            stored_backup_paths: vec![necropolis_text_path.to_string_lossy().into_owned()],
        },
    )
}

pub fn rename_txt_backup(
    app: &tauri::AppHandle,
    story_name: &str,
    old_file_name: &str,
    new_file_name: &str,
) -> Result<(), String> {
    path_gate::validate_name(story_name)?;
    path_gate::validate_name(old_file_name)?;
    path_gate::validate_name(new_file_name)?;
    let alive_story_path = file_manager::get_backup_path(app)?.join(story_name);
    let old_backup_path = alive_story_path.join(format!("{}_backup.json", old_file_name));
    let new_backup_path = alive_story_path.join(format!("{}_backup.json", new_file_name));

    if old_backup_path.exists() {
        fs::rename(old_backup_path, new_backup_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn prepare_necropolis_dir(
    app: &tauri::AppHandle,
    story_name: &str,
    deleted_at: i64,
) -> Result<PathBuf, String> {
    let necropolis_path = file_manager::get_necropolis_path(app)?;
    fs::create_dir_all(&necropolis_path).map_err(|e| e.to_string())?;
    let current_dir = find_necropolis_story_dir(&necropolis_path, story_name)?;
    let candidate = unique_necropolis_dir(
        &necropolis_path,
        story_name,
        deleted_at,
        current_dir.as_ref(),
    );

    if let Some(current_dir) = current_dir {
        if current_dir != candidate {
            fs::rename(current_dir, &candidate).map_err(|e| e.to_string())?;
        }
    }

    Ok(candidate)
}

fn unique_necropolis_dir(
    necropolis_path: &Path,
    story_name: &str,
    deleted_at: i64,
    current_dir: Option<&PathBuf>,
) -> PathBuf {
    let base_name = format!("{}_{}", story_name, deleted_at);
    let mut candidate = necropolis_path.join(&base_name);
    let mut index = 2;

    while candidate.exists() && current_dir != Some(&candidate) {
        candidate = necropolis_path.join(format!("{}_{}", base_name, index));
        index += 1;
    }

    candidate
}

fn find_necropolis_story_dir(
    necropolis_path: &Path,
    story_name: &str,
) -> Result<Option<PathBuf>, String> {
    if let Ok(entries) = fs::read_dir(necropolis_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            if read_necropolis_manifest(&path)?
                .is_some_and(|manifest| manifest.story_name == story_name)
                || entry
                    .file_name()
                    .to_str()
                    .and_then(|name| name.rsplit_once('_'))
                    .is_some_and(|(prefix, _)| prefix == story_name)
            {
                return Ok(Some(path));
            }
        }
    }

    Ok(None)
}

fn append_necropolis_manifest(
    necropolis_dir: &Path,
    story_name: &str,
    updated_at: i64,
    entry: NecropolisManifestEntry,
) -> Result<(), String> {
    let mut manifest =
        read_necropolis_manifest(necropolis_dir)?.unwrap_or_else(|| NecropolisManifest {
            story_name: story_name.to_string(),
            updated_at,
            entries: Vec::new(),
        });

    manifest.story_name = story_name.to_string();
    manifest.updated_at = updated_at;
    manifest.entries.push(entry);

    let json = serde_json::to_string(&manifest).map_err(|e| e.to_string())?;
    fs::write(necropolis_dir.join("manifest.json"), json).map_err(|e| e.to_string())
}

fn read_necropolis_manifest(necropolis_dir: &Path) -> Result<Option<NecropolisManifest>, String> {
    let manifest_path = necropolis_dir.join("manifest.json");
    if !manifest_path.exists() {
        return Ok(None);
    }

    let json = fs::read_to_string(manifest_path).map_err(|e| e.to_string())?;
    let stored: StoredNecropolisManifest =
        serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(Some(match stored {
        StoredNecropolisManifest::Current(manifest) => manifest,
        StoredNecropolisManifest::Legacy(manifest) => NecropolisManifest {
            story_name: manifest.story_name,
            updated_at: manifest.deleted_at,
            entries: vec![NecropolisManifestEntry {
                backup_kind: manifest.backup_kind,
                file_name: manifest.file_name,
                deleted_at: manifest.deleted_at,
                original_source_path: manifest.original_backup_path,
                stored_backup_paths: Vec::new(),
            }],
        },
    }))
}

fn snapshot_story_texts(
    library_story_path: &Path,
    necropolis_dir: &Path,
    deleted_at: i64,
) -> Result<Vec<String>, String> {
    let mut stored_backup_paths = Vec::new();

    for entry in fs::read_dir(library_story_path)
        .map_err(|e| e.to_string())?
        .flatten()
    {
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("txt") {
            continue;
        }

        let file_name = entry.file_name().to_string_lossy().into_owned();
        let target_path = unique_child_path(necropolis_dir, &file_name, deleted_at);
        fs::copy(&path, &target_path).map_err(|e| e.to_string())?;
        stored_backup_paths.push(target_path.to_string_lossy().into_owned());
    }

    Ok(stored_backup_paths)
}

fn snapshot_txt(
    library_text_path: &Path,
    necropolis_dir: &Path,
    deleted_at: i64,
) -> Result<PathBuf, String> {
    let file_name = library_text_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "txt file name not found".to_string())?;
    let target_path = unique_child_path(necropolis_dir, file_name, deleted_at);
    fs::copy(library_text_path, &target_path).map_err(|e| e.to_string())?;
    Ok(target_path)
}

fn remove_empty_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if fs::read_dir(parent)
            .map_err(|e| e.to_string())?
            .next()
            .is_none()
        {
            fs::remove_dir(parent).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn unique_child_path(parent: &Path, file_name: &str, deleted_at: i64) -> PathBuf {
    let mut candidate = parent.join(file_name);
    if !candidate.exists() {
        return candidate;
    }

    let source = Path::new(file_name);
    let stem = source
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(file_name);
    let extension = source.extension().and_then(|extension| extension.to_str());
    let mut index = 2;

    loop {
        let next_name = match extension {
            Some(extension) => format!("{}_{}.{}", stem, deleted_at, extension),
            None => format!("{}_{}", stem, deleted_at),
        };
        candidate = parent.join(&next_name);
        if !candidate.exists() {
            return candidate;
        }

        let next_name = match extension {
            Some(extension) => format!("{}_{}_{}.{}", stem, deleted_at, index, extension),
            None => format!("{}_{}_{}", stem, deleted_at, index),
        };
        candidate = parent.join(next_name);
        if !candidate.exists() {
            return candidate;
        }
        index += 1;
    }
}

fn push_incremental_node(
    backup: &mut BackupNode,
    incremental_node: IncrementalNode,
) -> Result<(), String> {
    if backup.incremental_content.is_empty() && is_append_only_incremental_node(&incremental_node) {
        apply_incremental_node(&mut backup.base_content, &incremental_node)?;
    } else {
        backup.incremental_content.push(incremental_node);
    }

    Ok(())
}

fn is_append_only_incremental_node(incremental_node: &IncrementalNode) -> bool {
    !incremental_node.diff.is_empty()
        && incremental_node.diff.iter().all(|line_patch| {
            !line_patch.is_deleted
                && line_patch.base_text.is_empty()
                && !line_patch.changed_text.is_empty()
        })
}

fn diff(old_content: String, new_content: String) -> Result<IncrementalNode, String> {
    let old_lines: Vec<&str> = old_content.lines().collect();
    let new_lines: Vec<&str> = new_content.lines().collect();
    let line_count = old_lines.len().max(new_lines.len());
    let mut line_patches: Vec<LinePatch> = Vec::new();

    for index in 0..line_count {
        let base_line = old_lines.get(index).copied();
        let changed_line = new_lines.get(index).copied();

        if base_line != changed_line {
            line_patches.push(LinePatch {
                line_number: index + 1,
                base_text: base_line.unwrap_or("").to_string(),
                changed_text: changed_line.unwrap_or("").to_string(),
                is_deleted: changed_line.is_none(),
            });
        }
    }

    Ok(IncrementalNode {
        timestamp: time_manager::current_timestamp(),
        diff: line_patches,
    })
}

fn fetch_backup_string(backup_json: &BackupJson) -> Result<String, String> {
    let backup = backup_json
        .backups
        .last()
        .ok_or_else(|| "backup node not found".to_string())?;

    let mut lines: Vec<String> = backup
        .base_content
        .lines()
        .map(|line| line.to_string())
        .collect();

    for incremental_node in &backup.incremental_content {
        apply_incremental_node_to_lines(&mut lines, incremental_node)?;
    }

    Ok(lines.join("\n"))
}

fn apply_incremental_node(
    base_content: &mut String,
    incremental_node: &IncrementalNode,
) -> Result<(), String> {
    let mut lines: Vec<String> = base_content.lines().map(|line| line.to_string()).collect();

    apply_incremental_node_to_lines(&mut lines, incremental_node)?;
    *base_content = lines.join("\n");

    Ok(())
}

fn apply_incremental_node_to_lines(
    lines: &mut Vec<String>,
    incremental_node: &IncrementalNode,
) -> Result<(), String> {
    for line_patch in incremental_node.diff.iter().rev() {
        if line_patch.line_number == 0 {
            return Err("line_number must be greater than 0".to_string());
        }

        let line_index = line_patch.line_number - 1;

        if line_patch.is_deleted {
            if line_index < lines.len() {
                lines.remove(line_index);
            }
            continue;
        }

        if line_index >= lines.len() {
            lines.resize(line_index + 1, String::new());
        }
        lines[line_index] = line_patch.changed_text.clone();
    }

    Ok(())
}

fn should_enqueue_backup_node(backup_json: &BackupJson) -> bool {
    backup_json
        .backups
        .last()
        .is_some_and(|backup| backup.incremental_content.len() >= BACKUP_NODE_INCREMENT_LIMIT)
}

fn should_deque_backup_node(backup_json: &BackupJson, backup_path: &Path) -> Result<bool, String> {
    if backup_json.backups.len() <= 1 {
        return Ok(false);
    }

    let backup_file_size = fs::metadata(backup_path).map_err(|e| e.to_string())?.len();
    let compare_content_size =
        (fetch_backup_string(backup_json)?.len() as u64).max(MIN_COMPARE_CONTENT_BYTES);

    Ok(backup_file_size > compare_content_size.saturating_mul(BACKUP_FILE_SIZE_RATIO_LIMIT))
}
