//! Shared backup persistence, generations, history and deleted-content recovery.
//! Format-specific delta generation and replay live in the text/JSON codecs.

use super::{
    contents_info::{ContentType, ContentsInfo},
    document_name, file_manager,
};
use crate::utils::{path_gate, time_manager};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

// Serialize content writes, renames and backup updates across IPC callers.
pub static CONTENT_WRITE_LOCK: Mutex<()> = Mutex::new(());

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
    #[serde(flatten)]
    changes: ContentDelta,
}

#[derive(Serialize, Deserialize)]
#[serde(untagged)]
enum ContentDelta {
    Json(super::json_backup_manager::JsonDelta),
    Text(super::txt_backup_manager::TextDelta),
}

impl ContentDelta {
    fn is_empty(&self) -> bool {
        match self {
            Self::Text(delta) => delta.is_empty(),
            Self::Json(delta) => delta.is_empty(),
        }
    }
    fn apply(&self, content: &mut String) -> Result<(), String> {
        match self {
            Self::Text(delta) => super::txt_backup_manager::apply(content, delta),
            Self::Json(delta) => super::json_backup_manager::apply(content, delta),
        }
    }
}

// Ensures a baseline exists before the source is overwritten.
pub fn create_backup(app: &tauri::AppHandle, contents_info: &ContentsInfo) -> Result<(), String> {
    let story_name = contents_info.story_name.clone();
    path_gate::validate_name(&story_name)?;
    let library_path = file_manager::get_library_path(&app)?;
    let file_name = resolve_info_stem(&library_path, &contents_info)?;
    let file_path = super::content_path::resolve(&library_path, &contents_info)?;
    let base_content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    write_initial_backup(&app, &story_name, &file_name, base_content)
}

fn create_backup_from_path(
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
    let backup_path =
        backup_path_for_stem(&file_manager::get_backup_path(app)?, story_name, file_name)?;

    if backup_path.exists() {
        let _: BackupJson =
            serde_json::from_slice(&fs::read(&backup_path).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
        return Ok(());
    }
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
    super::atomic_file::write_text_or_create(&backup_path, &json).map_err(|e| e.to_string())?;

    Ok(())
}

// Appends the latest changes using the content type's delta codec.
#[tauri::command]
pub fn increment_backup(app: tauri::AppHandle, contents_info: ContentsInfo) -> Result<(), String> {
    let _guard = CONTENT_WRITE_LOCK.lock().map_err(|e| e.to_string())?;
    record_current(&app, &contents_info)
}

pub fn record_current(app: &tauri::AppHandle, contents_info: &ContentsInfo) -> Result<(), String> {
    let story_name = contents_info.story_name.clone();
    path_gate::validate_name(&story_name)?;
    let file_name = resolve_info_stem(&file_manager::get_library_path(&app)?, &contents_info)?;
    let backup_path = file_manager::get_backup_path(&app)?;
    let backup_path = backup_path_for_stem(&backup_path, &story_name, &file_name)?;
    let library_path = file_manager::get_library_path(&app)?;
    let file_path = super::content_path::resolve(&library_path, &contents_info)?;
    let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    record_revision(
        &backup_path,
        &story_name,
        &file_name,
        contents_info.content_type,
        content,
    )
}

fn record_revision(
    path: &Path,
    story: &str,
    stem: &str,
    kind: ContentType,
    content: String,
) -> Result<(), String> {
    let mut backup = if path.exists() {
        serde_json::from_slice::<BackupJson>(&fs::read(path).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?
    } else {
        BackupJson {
            story_name: story.into(),
            file_name: stem.into(),
            backups: vec![],
        }
    };
    if backup.backups.is_empty() {
        backup.backups.push(BackupNode {
            base_content: content,
            incremental_content: vec![],
        });
    } else {
        let old = fetch_backup_string(&backup)?;
        let node = diff_content(kind, old.clone(), content)?;
        if node.changes.is_empty() {
            return Ok(());
        }
        if should_enqueue_backup_node(&backup) {
            backup.backups.push(BackupNode {
                base_content: old,
                incremental_content: vec![],
            });
        }
        push_incremental_node(backup.backups.last_mut().unwrap(), node)?;
    }
    // Prune only complete generations; every remaining generation has its own baseline.
    while backup.backups.len() > 1 {
        let size = serde_json::to_vec(&backup)
            .map_err(|e| e.to_string())?
            .len() as u64;
        let content_size =
            (fetch_backup_string(&backup)?.len() as u64).max(MIN_COMPARE_CONTENT_BYTES);
        if size <= content_size.saturating_mul(BACKUP_FILE_SIZE_RATIO_LIMIT) {
            break;
        }
        backup.backups.remove(0);
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string(&backup).map_err(|e| e.to_string())?;
    super::atomic_file::write_text_or_create(path, &json).map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupGeneration {
    pub generation_index: usize,
    pub generation_count: usize,
    pub timestamp: i64,
    pub content: String,
}

// Returns replayed revisions for text or JSON content.
#[tauri::command]
pub fn get_backup_history(
    app: tauri::AppHandle,
    contents_info: ContentsInfo,
) -> Result<Vec<BackupGeneration>, String> {
    let story_name = contents_info.story_name.clone();
    path_gate::validate_name(&story_name)?;
    let file_name = resolve_info_stem(&file_manager::get_library_path(&app)?, &contents_info)?;
    let backup_path = file_manager::get_backup_path(&app)?;
    let backup_path = backup_path_for_stem(&backup_path, &story_name, &file_name)?;

    if !backup_path.exists() {
        return Ok(Vec::new());
    }

    let backup_reader = fs::read(&backup_path).map_err(|e| e.to_string())?;
    let backup_json: BackupJson =
        serde_json::from_slice(&backup_reader).map_err(|e| e.to_string())?;

    history_from_backup(&backup_json)
}

fn history_from_backup(backup_json: &BackupJson) -> Result<Vec<BackupGeneration>, String> {
    let mut history = Vec::new();

    let generation_count = backup_json.backups.len();

    for (generation_index, backup_node) in backup_json.backups.iter().enumerate() {
        let mut current_content = backup_node.base_content.clone();

        history.push(BackupGeneration {
            generation_index,
            generation_count,
            timestamp: 0,
            content: current_content.clone(),
        });

        for inc_node in &backup_node.incremental_content {
            apply_incremental_node(&mut current_content, inc_node)?;
            history.push(BackupGeneration {
                generation_index,
                generation_count,
                timestamp: inc_node.timestamp,
                content: current_content.clone(),
            });
        }
    }

    Ok(history)
}

// Rebuild deltas from every original revision after remapping only image fields.
// Keeping timestamps, generation boundaries and empty revisions preserves history.
pub(super) fn remap_image_history(
    stored: &serde_json::Value,
    remap: impl Fn(&mut serde_json::Value) -> bool,
) -> Result<serde_json::Value, String> {
    let original: BackupJson = serde_json::from_value(stored.clone()).map_err(|error| error.to_string())?;
    let mut output = stored.clone();
    let key = if output.get("backups").is_some() { "backups" } else { "files" };
    let nodes = output.get_mut(key).and_then(serde_json::Value::as_array_mut).ok_or("Invalid backup generations")?;
    for (node, original_node) in nodes.iter_mut().zip(original.backups.iter()) {
        let mut current = original_node.base_content.clone();
        let mut value: serde_json::Value = serde_json::from_str(&current).map_err(|error| error.to_string())?;
        remap(&mut value);
        let mut previous = serde_json::to_string_pretty(&value).map_err(|error| error.to_string())?;
        node["base_content"] = serde_json::Value::String(previous.clone());
        if original_node.incremental_content.is_empty() { continue; }
        let increments = node.get_mut("incremental_content").and_then(serde_json::Value::as_array_mut).ok_or("Invalid backup increments")?;
        for (increment, original_increment) in increments.iter_mut().zip(original_node.incremental_content.iter()) {
            original_increment.changes.apply(&mut current)?;
            let mut value: serde_json::Value = serde_json::from_str(&current).map_err(|error| error.to_string())?;
            remap(&mut value);
            let next = serde_json::to_string_pretty(&value).map_err(|error| error.to_string())?;
            let delta = super::json_backup_manager::diff(previous, next.clone())?;
            let object = increment.as_object_mut().ok_or("Invalid backup increment")?;
            object.remove("diff");
            object.insert("json_patch".into(), serde_json::to_value(delta).map_err(|error| error.to_string())?["json_patch"].clone());
            previous = next;
        }
    }
    // Validate replay before any file is published.
    let verified: BackupJson = serde_json::from_value(output.clone()).map_err(|error| error.to_string())?;
    let before = history_from_backup(&original)?;
    let after = history_from_backup(&verified)?;
    if before.len() != after.len() { return Err("Image rename changed backup history length".into()); }
    for (old, new) in before.iter().zip(after.iter()) {
        let mut expected: serde_json::Value = serde_json::from_str(&old.content).map_err(|error| error.to_string())?;
        remap(&mut expected);
        let actual: serde_json::Value = serde_json::from_str(&new.content).map_err(|error| error.to_string())?;
        if expected != actual || old.timestamp != new.timestamp || old.generation_index != new.generation_index {
            return Err("Image rename failed backup replay validation".into());
        }
    }
    Ok(output)
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
    pub display_name: Option<String>,
    pub deleted_at: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRequestItem {
    pub directory_name: String,
    pub backup_kind: String,
    pub file_name: Option<String>,
}

// Restores the specified deleted stories or content files.
#[tauri::command]
pub fn restore_deleted_files(
    app: tauri::AppHandle,
    items: Vec<BackupRequestItem>,
) -> Result<bool, String> {
    let _guard = CONTENT_WRITE_LOCK.lock().map_err(|e| e.to_string())?;
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
    item: BackupRequestItem,
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
        "txt" | "json" => restore_entry(app, library_path, &directory_path, &story_name, &entry)?,
        _ => return Err("unsupported Necropolis entry kind".to_string()),
    }

    persist_necropolis_manifest(&directory_path, &manifest)
}

// Permanently deletes the specified retired items.
#[tauri::command]
pub fn execute_complete_deletion(
    app: tauri::AppHandle,
    items: Vec<BackupRequestItem>,
) -> Result<bool, String> {
    let _guard = CONTENT_WRITE_LOCK.lock().map_err(|e| e.to_string())?;
    let necropolis_path = file_manager::get_necropolis_path(&app)?;

    let mut success = true;

    for item in items {
        if delete_necropolis_item(&necropolis_path, item).is_err() {
            success = false;
        }
    }

    Ok(success)
}

fn delete_necropolis_item(necropolis_path: &Path, item: BackupRequestItem) -> Result<(), String> {
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
        "txt" | "json" => {
            for stored_path_str in &entry.stored_backup_paths {
                let source_file =
                    checked_existing_necropolis_file(&directory_path, stored_path_str)?;
                fs::remove_file(source_file).map_err(|e| e.to_string())?;
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
    let staging_story_path = available_restore_staging_story_path(library_path, &target_story_name);
    fs::create_dir_all(&staging_story_path).map_err(|e| e.to_string())?;

    let result = copy_story_sources(directory_path, &staging_story_path, entry)
        .and_then(|restored_file_names| {
            if target_story_path.exists() {
                return Err("restore target already exists".to_string());
            }
            fs::rename(&staging_story_path, &target_story_path).map_err(|e| e.to_string())?;
            for file_name in restored_file_names {
                create_backup_from_path(
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

fn restore_entry(
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
        let target_file = available_rev_path(&target_story_path, &original_file_name)?;
        fs::copy(&source_file, &target_file).map_err(|e| e.to_string())?;
        create_backup_from_path(app, story_name, &target_file)?;
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

fn available_rev_path(parent: &Path, file_name: &str) -> Result<PathBuf, String> {
    if let Some(mut info) = super::content_path::inspect("", Path::new(file_name)) {
        if info.content_type != ContentType::Txt {
            let original_title = info.name.clone();
            let mut count = 0;
            loop {
                let suffix = match count {
                    0 => String::new(),
                    1 => "_rev".into(),
                    _ => format!("_rev_{count}"),
                };
                let mut title = original_title.clone();
                while title.encode_utf16().count() + suffix.len() > 100 {
                    title.pop();
                }
                info.name = format!("{title}{suffix}");
                let mut collision = false;
                for entry in fs::read_dir(parent).map_err(|e| e.to_string())? {
                    let entry = entry.map_err(|e| e.to_string())?;
                    if let Some(existing) = super::content_path::inspect("", &entry.path()) {
                        if existing.access_id == info.access_id {
                            info.access_id = uuid::Uuid::new_v4().to_string();
                        }
                        if existing.content_type == info.content_type
                            && existing.name.to_lowercase() == info.name.to_lowercase()
                        {
                            collision = true;
                        }
                    }
                }
                if !collision {
                    return Ok(parent.join(super::content_path::file_name(
                        info.content_type,
                        &info.name,
                        &info.access_id,
                    )?));
                }
                count += 1;
            }
        }
    }
    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(file_name);
    let title = document_name::display_title(stem);
    let mut rev_count = 0;
    loop {
        let suffix = match rev_count {
            0 => String::new(),
            1 => "_rev".to_string(),
            _ => format!("_rev_{rev_count}"),
        };
        let mut shortened = title.to_string();
        while shortened.encode_utf16().count() + suffix.len() > 100 {
            shortened.pop();
        }
        let candidate_title = format!("{shortened}{suffix}");
        if document_name::find_title(parent, &candidate_title)?.is_none() {
            let candidate_stem = document_name::renamed_stem(stem, &candidate_title)?;
            return Ok(parent.join(format!("{candidate_stem}.txt")));
        }
        rev_count += 1;
    }
}

#[cfg(test)]
mod naming_tests {
    use super::*;

    #[test]
    fn backup_rename_preserves_history_after_text_rename() {
        let root = std::env::temp_dir().join(format!(
            "typenap-backup-rename-test-{}",
            uuid::Uuid::new_v4()
        ));
        let backup_root = root.join("Backup/Alive");
        let story_path = root.join("Library/Story");
        fs::create_dir_all(backup_root.join("Story")).unwrap();
        fs::create_dir_all(&story_path).unwrap();

        // Cover both UUID names and legacy title-only files.
        for old_stem in [
            format!("text_Chapter_{}", uuid::Uuid::new_v4()),
            "Legacy".into(),
        ] {
            let contents_info = ContentsInfo {
                story_name: "Story".into(),
                name: document_name::display_title(&old_stem).into(),
                access_id: document_name::split(&old_stem)
                    .map(|(_, id)| id.to_string())
                    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
                content_type: ContentType::Txt,
            };
            let new_title = format!("{}_renamed", contents_info.name);
            let new_stem = document_name::renamed_stem(&old_stem, &new_title).unwrap();
            let old_text_path = story_path.join(format!("{old_stem}.txt"));
            let new_text_path = story_path.join(format!("{new_stem}.txt"));
            fs::write(&old_text_path, "latest content").unwrap();
            let old_backup_path = backup_root.join("Story").join(format!("{old_stem}.json"));
            let backup = serde_json::json!({
                "story_name": "Story",
                "file_name": old_stem,
                "backups": [{
                    "base_content": "original content",
                    "incremental_content": [{
                        "timestamp": 123,
                        "diff": [{
                            "line_number": 1,
                            "base_text": "original content",
                            "changed_text": "latest content",
                            "is_deleted": false
                        }]
                    }]
                }]
            });
            fs::write(&old_backup_path, serde_json::to_vec(&backup).unwrap()).unwrap();
            fs::rename(&old_text_path, &new_text_path).unwrap();

            rename_backup_files(&backup_root, &contents_info, &old_stem, &new_stem).unwrap();

            assert!(!old_backup_path.exists());
            let renamed: serde_json::Value = serde_json::from_slice(
                &fs::read(backup_root.join("Story").join(format!("{new_stem}.json"))).unwrap(),
            )
            .unwrap();
            assert_eq!(renamed["file_name"], new_stem);
            assert_eq!(renamed["backups"], backup["backups"]);
            assert_eq!(renamed["story_name"], "Story");
            assert_eq!(
                fs::read_to_string(&new_text_path).unwrap(),
                "latest content"
            );
        }

        assert_eq!(root.parent(), Some(std::env::temp_dir().as_path()));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn restore_detects_display_title_conflicts_and_preserves_uuid_suffix() {
        let parent =
            std::env::temp_dir().join(format!("typenap-restore-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&parent).unwrap();
        let original_id = uuid::Uuid::new_v4();
        let original_name = format!("text_Chapter_part_1_{original_id}.txt");
        assert_eq!(
            available_rev_path(&parent, &original_name).unwrap(),
            parent.join(&original_name)
        );
        let existing = parent.join(format!("text_Chapter_part_1_{}.txt", uuid::Uuid::new_v4()));
        fs::write(&existing, "existing document").unwrap();
        let restored = available_rev_path(&parent, &original_name).unwrap();
        assert_eq!(
            restored.file_name().unwrap().to_str().unwrap(),
            format!("text_Chapter_part_1_rev_{original_id}.txt")
        );
        fs::write(&restored, "restored document").unwrap();
        assert_eq!(
            available_rev_path(&parent, &original_name)
                .unwrap()
                .file_name()
                .unwrap()
                .to_str()
                .unwrap(),
            format!("text_Chapter_part_1_rev_2_{original_id}.txt")
        );
        assert_eq!(fs::read_to_string(&existing).unwrap(), "existing document");
        assert_eq!(parent.parent(), Some(std::env::temp_dir().as_path()));
        fs::remove_dir_all(parent).unwrap();
    }
}

fn available_restore_staging_story_path(library_path: &Path, story_name: &str) -> PathBuf {
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
        super::atomic_file::write_text_or_create(&necropolis_dir.join("manifest.json"), &json)
            .map_err(|e| e.to_string())
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
                        display_name: manifest_entry
                            .file_name
                            .as_deref()
                            .map(content_display_title),
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
        snapshot_story_contents(&library_story_path, &necropolis_dir, deleted_at)?;
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

pub fn retire_backup(app: &tauri::AppHandle, contents_info: &ContentsInfo) -> Result<(), String> {
    let story_name = contents_info.story_name.as_str();
    path_gate::validate_name(story_name)?;
    let file_name = resolve_info_stem(&file_manager::get_library_path(app)?, contents_info)?;
    let alive_backup_path =
        backup_path_for_stem(&file_manager::get_backup_path(app)?, story_name, &file_name)?;
    let library_text_path =
        super::content_path::resolve(&file_manager::get_library_path(app)?, contents_info)?;
    if !library_text_path.exists() {
        return Ok(());
    }

    let deleted_at = time_manager::current_timestamp();
    let necropolis_dir = prepare_necropolis_dir(app, story_name, deleted_at)?;
    fs::create_dir_all(&necropolis_dir).map_err(|e| e.to_string())?;

    let necropolis_text_path = snapshot_content(&library_text_path, &necropolis_dir, deleted_at)?;
    if alive_backup_path.exists() {
        fs::remove_file(&alive_backup_path).map_err(|e| e.to_string())?;
        remove_empty_parent_dir(&alive_backup_path)?;
    }

    append_necropolis_manifest(
        &necropolis_dir,
        story_name,
        deleted_at,
        NecropolisManifestEntry {
            backup_kind: contents_info.content_type.extension().to_string(),
            file_name: Some(file_name.to_string()),
            deleted_at,
            original_source_path: library_text_path.to_string_lossy().into_owned(),
            stored_backup_paths: vec![necropolis_text_path.to_string_lossy().into_owned()],
        },
    )
}

pub fn rename_backup(
    app: &tauri::AppHandle,
    contents_info: &ContentsInfo,
    old_file_name: &str,
    new_file_name: &str,
) -> Result<(), String> {
    // The text file has already been renamed; keep the resolved stems rather
    // than looking up its old display title again.
    rename_backup_files(
        &file_manager::get_backup_path(app)?,
        contents_info,
        old_file_name,
        new_file_name,
    )
}

fn rename_backup_files(
    backup_root: &Path,
    contents_info: &ContentsInfo,
    old_file_name: &str,
    new_file_name: &str,
) -> Result<(), String> {
    let story_name = contents_info.story_name.as_str();
    path_gate::validate_name(story_name)?;
    validate_backup_stem(old_file_name)?;
    validate_backup_stem(new_file_name)?;
    let alive_story_path = backup_root.join(story_name);
    let old_backup_path = alive_story_path.join(format!("{}.json", old_file_name));
    let new_backup_path = alive_story_path.join(format!("{}.json", new_file_name));

    if old_backup_path.exists() {
        let mut backup: BackupJson =
            serde_json::from_str(&fs::read_to_string(&old_backup_path).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
        backup.file_name = new_file_name.to_string();
        let json = serde_json::to_string(&backup).map_err(|e| e.to_string())?;
        super::atomic_file::write_text_or_create(&old_backup_path, &json)
            .map_err(|e| e.to_string())?;
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
    super::atomic_file::write_text_or_create(&necropolis_dir.join("manifest.json"), &json)
        .map_err(|e| e.to_string())
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

fn snapshot_story_contents(
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
        if !path.is_file()
            || (path.extension().and_then(|extension| extension.to_str()) != Some("txt")
                && super::content_path::inspect("", &path).is_none())
        {
            continue;
        }

        let target_path = snapshot_content(&path, necropolis_dir, deleted_at)?;
        stored_backup_paths.push(target_path.to_string_lossy().into_owned());
    }

    Ok(stored_backup_paths)
}

fn snapshot_content(
    library_text_path: &Path,
    necropolis_dir: &Path,
    deleted_at: i64,
) -> Result<PathBuf, String> {
    let file_name = library_text_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "txt file name not found".to_string())?;
    let snapshot_dir =
        necropolis_dir.join(format!("snapshot_{}_{}", deleted_at, uuid::Uuid::new_v4()));
    fs::create_dir_all(&snapshot_dir).map_err(|e| e.to_string())?;
    let target_path = snapshot_dir.join(file_name);
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

fn push_incremental_node(
    backup: &mut BackupNode,
    incremental_node: IncrementalNode,
) -> Result<(), String> {
    // Keep every revision, including append-only edits.
    backup.incremental_content.push(incremental_node);
    Ok(())
}

fn diff_content(kind: ContentType, old: String, new: String) -> Result<IncrementalNode, String> {
    let changes = match kind {
        ContentType::Txt => ContentDelta::Text(super::txt_backup_manager::diff(old, new)?),
        _ => ContentDelta::Json(super::json_backup_manager::diff(old, new)?),
    };
    Ok(IncrementalNode {
        timestamp: time_manager::current_timestamp(),
        changes,
    })
}

fn fetch_backup_string(backup_json: &BackupJson) -> Result<String, String> {
    let backup = backup_json
        .backups
        .last()
        .ok_or_else(|| "backup node not found".to_string())?;

    let mut content = backup.base_content.clone();
    for incremental_node in &backup.incremental_content {
        apply_incremental_node(&mut content, incremental_node)?;
    }
    Ok(content)
}

fn apply_incremental_node(content: &mut String, node: &IncrementalNode) -> Result<(), String> {
    node.changes.apply(content)
}

fn should_enqueue_backup_node(backup_json: &BackupJson) -> bool {
    backup_json
        .backups
        .last()
        .is_some_and(|backup| backup.incremental_content.len() >= BACKUP_NODE_INCREMENT_LIMIT)
}

fn resolve_info_stem(root: &Path, info: &ContentsInfo) -> Result<String, String> {
    super::content_path::resolve(root, info)?
        .file_stem()
        .and_then(|s| s.to_str())
        .map(str::to_string)
        .ok_or_else(|| "Invalid content file name".into())
}

fn backup_path_for_stem(root: &Path, story: &str, stem: &str) -> Result<PathBuf, String> {
    validate_backup_stem(stem)?;
    Ok(path_gate::story_dir(root, story)?.join(format!("{stem}.json")))
}

fn validate_backup_stem(stem: &str) -> Result<(), String> {
    if super::content_path::inspect("", &PathBuf::from(format!("{stem}.json"))).is_some() {
        return Ok(());
    }
    document_name::validate_stem(stem)
}

fn content_display_title(stem: &str) -> String {
    super::content_path::inspect("", &PathBuf::from(format!("{stem}.json")))
        .map(|info| info.name)
        .unwrap_or_else(|| document_name::display_title(stem).to_string())
}

#[cfg(test)]
mod lifecycle_tests {
    use super::*;

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("typenap-backup-test-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(root.join("Alive/Story")).unwrap();
            Self(root)
        }
        fn read(&self, path: &Path) -> BackupJson {
            serde_json::from_slice(&fs::read(path).unwrap()).unwrap()
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            assert_eq!(self.0.parent(), Some(std::env::temp_dir().as_path()));
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn json_history_survives_save_rename_and_restore_for_every_kind() {
        let fixture = Fixture::new();
        for kind in [
            ContentType::Character,
            ContentType::World,
            ContentType::Entity,
        ] {
            let info = ContentsInfo {
                story_name: "Story".into(),
                name: "Original".into(),
                access_id: uuid::Uuid::new_v4().to_string(),
                content_type: kind,
            };
            let stem = format!("{}_{}_{}", kind.prefix(), info.name, info.access_id);
            let path = backup_path_for_stem(&fixture.0.join("Alive"), "Story", &stem).unwrap();
            let old =
                serde_json::json!({"name":"original", "nested":{"items":[1,2,3]}, "remove": true});
            let new =
                serde_json::json!({"name":"changed", "nested":{"items":[2,4]}, "added": null});
            record_revision(&path, "Story", &stem, kind, old.to_string()).unwrap();
            record_revision(&path, "Story", &stem, kind, new.to_string()).unwrap();
            record_revision(
                &path,
                "Story",
                &stem,
                kind,
                serde_json::to_string_pretty(&new).unwrap(),
            )
            .unwrap();
            let stored: serde_json::Value =
                serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
            assert!(stored["backups"][0]["incremental_content"][0]["json_patch"].is_array());
            assert!(stored["backups"][0]["incremental_content"][0]
                .get("diff")
                .is_none());
            let history = history_from_backup(&fixture.read(&path)).unwrap();
            assert_eq!(
                history.len(),
                2,
                "formatting-only saves must not add a revision"
            );
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(&history[0].content).unwrap(),
                old
            );
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(&history[1].content).unwrap(),
                new
            );
            let renamed = format!("{}_Renamed_{}", kind.prefix(), info.access_id);
            rename_backup_files(&fixture.0.join("Alive"), &info, &stem, &renamed).unwrap();
            let new_path = path.with_file_name(format!("{renamed}.json"));
            assert!(!path.exists());
            record_revision(
                &new_path,
                "Story",
                &renamed,
                kind,
                history[0].content.clone(),
            )
            .unwrap();
            let history = history_from_backup(&fixture.read(&new_path)).unwrap();
            assert_eq!(history.len(), 3);
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(&history[2].content).unwrap(),
                old
            );
        }
    }

    #[test]
    fn rollover_and_pruning_keep_json_generations_independently_replayable() {
        let fixture = Fixture::new();
        let stem = format!("character_History_{}", uuid::Uuid::new_v4());
        let path = backup_path_for_stem(&fixture.0.join("Alive"), "Story", &stem).unwrap();
        // An unchanged large field permits multiple complete generations to remain.
        for index in 0..105 {
            let value = serde_json::json!({"stable":"x".repeat(20_000), "counter":index});
            record_revision(
                &path,
                "Story",
                &stem,
                ContentType::Character,
                value.to_string(),
            )
            .unwrap();
        }
        let backup = fixture.read(&path);
        assert!(backup.backups.len() > 1);
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&fetch_backup_string(&backup).unwrap())
                .unwrap()["counter"],
            104
        );
        // Shrinking the document triggers pruning of old complete generations.
        record_revision(&path, "Story", &stem, ContentType::Character, "{}".into()).unwrap();
        let backup = fixture.read(&path);
        assert_eq!(backup.backups.len(), 1);
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&fetch_backup_string(&backup).unwrap())
                .unwrap(),
            serde_json::json!({})
        );
        assert!(!history_from_backup(&backup).unwrap().is_empty());
    }

    #[test]
    fn legacy_text_and_textdiff_histories_can_be_extended() {
        let fixture = Fixture::new();
        let path = fixture.0.join("Alive/Story/Legacy.json");
        fs::write(&path, r#"{"files":[{"base_content":"old","incremental_content":[{"timestamp":1,"diff":[{"line_number":1,"base_text":"old","changed_text":"new"}]}]}]}"#).unwrap();
        record_revision(
            &path,
            "Story",
            "Legacy",
            ContentType::Txt,
            "new\n羊🐑\r\n".into(),
        )
        .unwrap();
        let history = history_from_backup(&fixture.read(&path)).unwrap();
        assert_eq!(
            history
                .iter()
                .map(|h| h.content.as_str())
                .collect::<Vec<_>>(),
            vec!["old", "new", "new\n羊🐑\r\n"]
        );
        assert!(serde_json::from_str::<IncrementalNode>(r#"{"json_patch":"broken"}"#).is_err());
        assert!(backup_path_for_stem(&fixture.0, "../outside", "Legacy").is_err());
    }

    #[test]
    fn story_snapshots_include_managed_json_and_preserve_file_identity() {
        let fixture = Fixture::new();
        let library = fixture.0.join("Library");
        let story = library.join("Story");
        let retired = fixture.0.join("Necropolis");
        let restored = library.join("Restored");
        fs::create_dir_all(&story).unwrap();
        fs::create_dir_all(&retired).unwrap();
        fs::create_dir_all(&restored).unwrap();
        let json_name = super::super::content_path::file_name(
            ContentType::Character,
            "Sheep",
            &uuid::Uuid::new_v4().to_string(),
        )
        .unwrap();
        fs::write(story.join(&json_name), "{\"name\":\"sheep\"}").unwrap();
        fs::write(story.join("Legacy.txt"), "body\n").unwrap();
        fs::write(story.join("story_metadata.json"), "{}").unwrap();
        let paths = snapshot_story_contents(&story, &retired, 1).unwrap();
        let entry = NecropolisManifestEntry {
            backup_kind: "story".into(),
            file_name: None,
            deleted_at: 1,
            original_source_path: story.to_string_lossy().into_owned(),
            stored_backup_paths: paths,
        };
        let names = copy_story_sources(&retired, &restored, &entry).unwrap();
        assert_eq!(names.len(), 2);
        assert_eq!(
            fs::read_to_string(restored.join(&json_name)).unwrap(),
            "{\"name\":\"sheep\"}"
        );
        assert!(!restored.join("story_metadata.json").exists());
        let conflict = available_rev_path(&restored, &json_name).unwrap();
        let restored_info = super::super::content_path::inspect("Restored", &conflict).unwrap();
        assert_eq!(restored_info.name, "Sheep_rev");
        assert_ne!(conflict.file_name(), Path::new(&json_name).file_name());
    }
}
