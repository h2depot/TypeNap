use super::{
    atomic_file, backup_manager,
    contents_info::{ContentType, ContentsInfo, CreateContentsInput},
    document_manager::SaveDocumentError,
    document_name, file_manager,
};
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
};
#[cfg(test)]
use uuid::Uuid;

#[tauri::command]
pub async fn create_document_json(
    app: tauri::AppHandle,
    input: CreateContentsInput,
) -> Result<ContentsInfo, String> {
    let _write_guard = backup_manager::CONTENT_WRITE_LOCK.lock().map_err(|error| error.to_string())?;
    json_kind(&input.content_type)?;
    let library = file_manager::get_library_path(&app)?;
    let info = {
        let _guard = document_name::CREATION_LOCK
            .lock()
            .map_err(|e| e.to_string())?;
        let name = input.name.trim();
        crate::utils::path_gate::validate_name(name)?;
        let story = crate::utils::path_gate::story_dir(&library, &input.story_name)?;
        if super::content_path::list(&library, &input.story_name)?
            .iter()
            .any(|item| item.name.trim().to_lowercase() == name.to_lowercase())
        {
            return Err("Content already exists".into());
        }
        let info = ContentsInfo {
            story_name: input.story_name.clone(),
            name: name.into(),
            access_id: uuid::Uuid::new_v4().to_string(),
            content_type: input.content_type,
        };
        let path = story.join(super::content_path::file_name(
            info.content_type,
            &info.name,
            &info.access_id,
        )?);
        use std::io::Write;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .map_err(|e| e.to_string())?;
        let initial = match info.content_type {
            ContentType::Character => {
                serde_json::json!({"name": name, "summary": "", "imagePaths": [], "role": "", "profile": "", "personality": "", "notes": ""})
            }
            _ => {
                serde_json::json!({"name": name, "summary": "", "imagePaths": [], "properties": {}})
            }
        };
        file.write_all(
            serde_json::to_string_pretty(&initial)
                .map_err(|e| e.to_string())?
                .as_bytes(),
        )
        .map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        info
    };
    backup_manager::create_backup(&app, &info)?;
    file_manager::sync_story_info(&app, &info.story_name, true)?;
    Ok(info)
}

#[tauri::command]
pub async fn load_json(
    app: tauri::AppHandle,
    contents_info: ContentsInfo,
) -> Result<Value, String> {
    load_from_library(&file_manager::get_library_path(&app)?, &contents_info)
}

#[tauri::command]
pub async fn save_json_content(
    app: tauri::AppHandle,
    contents_info: ContentsInfo,
    mut content: Value,
) -> Result<(), SaveDocumentError> {
    let _guard =
        backup_manager::CONTENT_WRITE_LOCK
            .lock()
            .map_err(|e| SaveDocumentError::Preparation {
                message: e.to_string(),
            })?;
    let library = file_manager::get_library_path(&app)
        .map_err(|message| SaveDocumentError::Preparation { message })?;
    let app_data = library.parent().ok_or_else(|| SaveDocumentError::Preparation { message: "Invalid library root".into() })?;
    super::image_rename::recover(app_data)
        .map_err(|message| SaveDocumentError::Preparation { message })?;
    super::image_rename::normalize_object_references(app_data, &mut content)
        .map_err(|message| SaveDocumentError::Preparation { message })?;
    validate_object_images(&content).map_err(|message| SaveDocumentError::Preparation { message })?;
    let path = resolve_json(&library, &contents_info)
        .map_err(|message| SaveDocumentError::Preparation { message })?;
    let json =
        serde_json::to_string_pretty(&content).map_err(|e| SaveDocumentError::Preparation {
            message: e.to_string(),
        })?;
    backup_manager::create_backup(&app, &contents_info)
        .map_err(|message| SaveDocumentError::Preparation { message })?;
    atomic_file::write_text(&path, &json).map_err(|error| SaveDocumentError::AtomicWrite {
        stage: error.stage(),
        message: error.to_string(),
    })?;
    backup_manager::record_current(&app, &contents_info)
        .map_err(|message| SaveDocumentError::Backup { message })?;
    file_manager::sync_story_info(&app, &contents_info.story_name, true)
        .map_err(|message| SaveDocumentError::Metadata { message })?;
    Ok(())
}

#[tauri::command]
pub async fn save_json_title(
    app: tauri::AppHandle,
    contents_info: ContentsInfo,
    new_title: String,
) -> Result<(), String> {
    let _write_guard = backup_manager::CONTENT_WRITE_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    let library = file_manager::get_library_path(&app)?;
    let _guard = document_name::CREATION_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    let old = resolve_json(&library, &contents_info)?;
    rename_in_library(&library, &contents_info, &new_title)?;
    let new = resolve_json(&library, &contents_info)?;
    if old != new {
        backup_manager::rename_backup(
            &app,
            &contents_info,
            old.file_stem()
                .and_then(|s| s.to_str())
                .ok_or("Invalid JSON file name")?,
            new.file_stem()
                .and_then(|s| s.to_str())
                .ok_or("Invalid JSON file name")?,
        )?;
    }
    file_manager::sync_story_info(&app, &contents_info.story_name, true)?;
    Ok(())
}

fn json_kind(kind: &ContentType) -> Result<&'static str, String> {
    match kind {
        ContentType::Character => Ok("character"),
        ContentType::World => Ok("world"),
        ContentType::Entity => Ok("entity"),
        ContentType::Txt => Err("Txt content must use txt_editor".into()),
    }
}

// Enforced for all three JSON content types, including saves made outside the dialog.
fn validate_object_images(content: &Value) -> Result<(), String> {
    let Some(images) = content.get("imagePaths") else {
        return Ok(());
    };
    let images = images.as_array().ok_or("imagePaths must be an array")?;
    if images.len() > 3 {
        return Err("An object can contain at most 3 images".into());
    }
    let mut seen = std::collections::HashSet::new();
    for image in images {
        let path = image
            .as_str()
            .filter(|path| !path.trim().is_empty())
            .ok_or("Image paths must be non-empty strings")?;
        if !seen.insert(path) {
            return Err("An image cannot be registered twice".into());
        }
    }
    Ok(())
}

#[cfg(test)]
fn split_json_name(path: &Path) -> Option<(&str, &str, Uuid)> {
    let info = super::content_path::inspect("", path)?;
    if info.content_type == ContentType::Txt {
        return None;
    }
    let (kind, rest) = path.file_stem()?.to_str()?.split_once('_')?;
    let (name, id) = rest.rsplit_once('_')?;
    Some((kind, name, super::content_path::parse_id(id).ok()?))
}

#[cfg(test)]
fn is_json_content_file(path: &Path) -> bool {
    split_json_name(path).is_some()
}

fn resolve_json(root: &Path, info: &ContentsInfo) -> Result<PathBuf, String> {
    json_kind(&info.content_type)?;
    super::content_path::resolve(root, info)
}

fn load_from_library(root: &Path, info: &ContentsInfo) -> Result<Value, String> {
    let content = fs::read_to_string(resolve_json(root, info)?).map_err(|e| e.to_string())?;
    let mut value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    if let Some(app_data) = root.parent() { super::image_rename::normalize_object_references(app_data, &mut value)?; }
    Ok(value)
}

#[cfg(test)]
fn save_to_library(root: &Path, info: &ContentsInfo, content: &Value) -> Result<(), String> {
    validate_object_images(content)?;
    let path = resolve_json(root, info)?;
    let json = serde_json::to_string_pretty(content).map_err(|e| e.to_string())?;
    atomic_file::write_text(&path, &json).map_err(|e| e.to_string())
}

fn rename_in_library(root: &Path, info: &ContentsInfo, new_title: &str) -> Result<(), String> {
    json_kind(&info.content_type)?;
    let (old_path, new_path) = super::content_path::renamed_path(root, info, new_title)?;
    if old_path != new_path {
        fs::rename(old_path, new_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn all_json_object_types_reject_a_fourth_image_without_changing_saved_content() {
        let fixture = Fixture::new();
        for kind in [
            ContentType::Character,
            ContentType::World,
            ContentType::Entity,
        ] {
            let info = fixture.content(kind, "Photos");
            let accepted = serde_json::json!({"imagePaths": ["a.png", "b.png", "c.png"], "properties": {"role": "keeper"}});
            save_to_library(&fixture.0, &info, &accepted).unwrap();
            for rejected in [
                serde_json::json!({"imagePaths": ["a.png", "b.png", "c.png", "d.png"]}),
                serde_json::json!({"imagePaths": ["a.png", "a.png"]}),
                serde_json::json!({"imagePaths": [null]}),
                serde_json::json!({"imagePaths": [" "]}),
                serde_json::json!({"imagePaths": "a.png"}),
            ] {
                assert!(save_to_library(&fixture.0, &info, &rejected).is_err());
                assert_eq!(load_from_library(&fixture.0, &info).unwrap(), accepted);
            }
            save_to_library(&fixture.0, &info, &serde_json::json!({"imagePaths": []})).unwrap();
        }
    }
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!("typenap-json-test-{}", Uuid::new_v4()));
            fs::create_dir_all(root.join("Story")).unwrap();
            Self(root)
        }
        fn content(&self, kind: ContentType, name: &str) -> ContentsInfo {
            let info = ContentsInfo {
                story_name: "Story".into(),
                name: name.into(),
                access_id: Uuid::new_v4().to_string(),
                content_type: kind,
            };
            let path = self.0.join("Story").join(format!(
                "{}_{}_{}.json",
                json_kind(&info.content_type).unwrap(),
                name,
                info.access_id
            ));
            fs::write(path, r#"{"name":"original"}"#).unwrap();
            info
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            assert_eq!(self.0.parent(), Some(std::env::temp_dir().as_path()));
            fs::remove_dir_all(&self.0).unwrap();
        }
    }
    #[test]
    fn load_save_and_rename_preserve_identity_for_each_json_kind() {
        let fixture = Fixture::new();
        for kind in [
            ContentType::Character,
            ContentType::World,
            ContentType::Entity,
        ] {
            let info = fixture.content(kind, "Original_name");
            assert_eq!(
                load_from_library(&fixture.0, &info).unwrap()["name"],
                "original"
            );
            let value = serde_json::json!({"name": "日本語", "items": [1, true, null]});
            save_to_library(&fixture.0, &info, &value).unwrap();
            rename_in_library(&fixture.0, &info, "New_name").unwrap();
            let path = resolve_json(&fixture.0, &info).unwrap();
            let (_, name, id) = split_json_name(&path).unwrap();
            assert_eq!(name, "New_name");
            assert_eq!(id.to_string(), info.access_id);
            assert!(is_json_content_file(&path));
            assert_eq!(load_from_library(&fixture.0, &info).unwrap(), value);
            save_to_library(&fixture.0, &info, &serde_json::json!({"afterRename": true})).unwrap();
        }
    }
    #[test]
    fn rejects_conflicts_invalid_paths_and_non_json_content() {
        let fixture = Fixture::new();
        let mut info = fixture.content(ContentType::Character, "Original");
        fixture.content(ContentType::Character, "Taken");
        assert!(rename_in_library(&fixture.0, &info, "taken").is_err());
        assert!(rename_in_library(&fixture.0, &info, "../outside").is_err());
        fs::write(resolve_json(&fixture.0, &info).unwrap(), "invalid JSON").unwrap();
        assert!(load_from_library(&fixture.0, &info).is_err());
        assert!(!is_json_content_file(Path::new("story_metadata.json")));
        info.content_type = ContentType::Txt;
        assert!(resolve_json(&fixture.0, &info).is_err());
        info.content_type = ContentType::Character;
        info.story_name = "../outside".into();
        assert!(resolve_json(&fixture.0, &info).is_err());
        info.story_name = "Story".into();
        info.access_id = "../outside".into();
        assert!(resolve_json(&fixture.0, &info).is_err());
    }
}
