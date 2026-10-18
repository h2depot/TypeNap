use crate::utils::path_gate;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use uuid::Uuid;

// Keep the scan and creation together when commands arrive concurrently.
pub static CREATION_LOCK: Mutex<()> = Mutex::new(());

pub fn split(stem: &str) -> Option<(&str, Uuid)> {
    let (title, id) = stem.strip_prefix("text_")?.rsplit_once('_')?;
    let uuid = Uuid::parse_str(id).ok()?;
    if title.is_empty()
        || id.len() != 36
        || uuid.get_version_num() != 4
        || uuid.get_variant() != uuid::Variant::RFC4122
    {
        return None;
    }
    Some((title, uuid))
}

pub fn display_title(stem: &str) -> &str {
    split(stem).map_or(stem, |(title, _)| title)
}

pub fn validate_stem(stem: &str) -> Result<(), String> {
    path_gate::validate_name(display_title(stem))
}

pub fn renamed_stem(stem: &str, title: &str) -> Result<String, String> {
    path_gate::validate_name(title)?;
    Ok(match split(stem) {
        Some((_, id)) => format!("text_{title}_{id}"),
        None => title.to_string(),
    })
}

pub fn find_title(story: &Path, title: &str) -> Result<Option<PathBuf>, String> {
    let entries = match fs::read_dir(story) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.to_string()),
    };
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_file()
            || path.extension().and_then(|ext| ext.to_str()) != Some("txt")
        {
            continue;
        }
        if let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) {
            if display_title(stem).trim().to_lowercase() == title.trim().to_lowercase() {
                return Ok(Some(path));
            }
        }
    }
    Ok(None)
}

pub fn resolve_info_stem(
    root: &Path,
    info: &super::contents_info::ContentsInfo,
) -> Result<String, String> {
    let path = path_gate::text_file(root, info)?;
    Ok(path
        .file_stem()
        .and_then(|name| name.to_str())
        .ok_or("Invalid text file name")?
        .to_string())
}

// Upgrade legacy title-only files when exposing a library through the UUID API.
// Write the new backup first and keep the old files until it is ready.
pub fn ensure_text_ids(root: &Path, backup_root: &Path, story_name: &str) -> Result<(), String> {
    let story = path_gate::story_dir(root, story_name)?;
    let _guard = CREATION_LOCK.lock().map_err(|e| e.to_string())?;
    let entries = match fs::read_dir(&story) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e.to_string()),
    };
    let mut legacy = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if entry.file_type().map_err(|e| e.to_string())?.is_file()
            && path.extension().and_then(|ext| ext.to_str()) == Some("txt")
        {
            let stem = path
                .file_stem()
                .and_then(|s| s.to_str())
                .ok_or("Invalid text file name")?;
            if split(stem).is_none() {
                legacy.push(path);
            }
        }
    }
    if legacy.is_empty() {
        return Ok(());
    }
    let mut ids = Vec::new();
    collect_ids(root, &mut ids)?;
    collect_ids(backup_root, &mut ids)?;
    for old_path in legacy {
        let name = old_path
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or("Invalid text file name")?;
        path_gate::validate_name(name)?;
        let id = unused_id(&ids, Uuid::new_v4);
        ids.push(id);
        let new_stem = format!("text_{name}_{id}");
        let new_path = story.join(format!("{new_stem}.txt"));
        let backup_story = path_gate::story_dir(&backup_root.join("Alive"), story_name)?;
        let old_backup = backup_story.join(format!("{name}.json"));
        let new_backup = backup_story.join(format!("{new_stem}.json"));
        let mut backup: serde_json::Value = if old_backup.exists() {
            serde_json::from_slice(&fs::read(&old_backup).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?
        } else {
            serde_json::json!({"story_name": story_name, "file_name": name, "backups": [{
                "base_content": fs::read_to_string(&old_path).map_err(|e| e.to_string())?,
                "incremental_content": []
            }]})
        };
        let object = backup.as_object_mut().ok_or("Invalid legacy backup")?;
        object.insert("file_name".into(), new_stem.clone().into());
        let json = serde_json::to_vec(&backup).map_err(|e| e.to_string())?;
        fs::create_dir_all(&backup_story).map_err(|e| e.to_string())?;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&new_backup)
            .map_err(|e| e.to_string())?;
        let result = file.write_all(&json).and_then(|_| file.sync_all());
        drop(file);
        if let Err(e) = result {
            let _ = fs::remove_file(&new_backup);
            return Err(e.to_string());
        }
        if let Err(e) = fs::rename(&old_path, &new_path) {
            let _ = fs::remove_file(&new_backup);
            return Err(e.to_string());
        }
        if old_backup.exists() {
            fs::remove_file(old_backup).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn collect_ids(root: &Path, ids: &mut Vec<Uuid>) -> Result<(), String> {
    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.to_string()),
    };
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let kind = entry.file_type().map_err(|error| error.to_string())?;
        if kind.is_dir() {
            collect_ids(&entry.path(), ids)?;
        } else if kind.is_file() {
            let path = entry.path();
            if matches!(
                path.extension().and_then(|ext| ext.to_str()),
                Some("txt" | "json")
            ) {
                if let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) {
                    // Archived copies may have a timestamp/counter after the UUID.
                    let mut original = stem;
                    loop {
                        if let Some(id) = split(original).map(|(_, id)| id).or_else(|| {
                            let (prefix, rest) = original.split_once('_')?;
                            if !matches!(prefix, "character" | "world" | "entity") {
                                return None;
                            }
                            let (_, id) = rest.rsplit_once('_')?;
                            super::content_path::parse_id(id).ok()
                        }) {
                            ids.push(id);
                            break;
                        }
                        match original.rsplit_once('_') {
                            Some((prefix, suffix)) if suffix.parse::<i64>().is_ok() => {
                                original = prefix
                            }
                            _ => break,
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

fn unused_id(ids: &[Uuid], mut generate: impl FnMut() -> Uuid) -> Uuid {
    loop {
        let candidate = generate();
        // Deliberately use a linear search, including on each retry.
        if !ids.contains(&candidate) {
            return candidate;
        }
    }
}

pub fn create(
    root: &Path,
    backup_root: &Path,
    story_name: &str,
    title: &str,
) -> Result<PathBuf, String> {
    path_gate::validate_name(title)?;
    let story = path_gate::story_dir(root, story_name)?;
    if find_title(&story, title)?.is_some() {
        return Err("Text already exists".to_string());
    }
    let mut ids = Vec::new();
    collect_ids(root, &mut ids)?;
    collect_ids(backup_root, &mut ids)?;
    let id = unused_id(&ids, Uuid::new_v4);
    fs::create_dir_all(&story).map_err(|error| error.to_string())?;
    let path = story.join(format!("text_{title}_{id}.txt"));
    fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|error| error.to_string())?;
    Ok(path)
}
