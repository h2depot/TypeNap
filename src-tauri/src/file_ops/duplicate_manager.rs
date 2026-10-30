//! Duplication creates independent identities and fresh backup baselines.
//! Callers of the path-based helpers must hold CONTENT_WRITE_LOCK.
use super::{
    atomic_file, backup_manager, content_path,
    contents_info::{ContentType, ContentsInfo},
    document_name, file_manager,
};
use crate::utils::path_gate;
use std::{
    collections::HashSet,
    fs,
    io::Write,
    path::{Path, PathBuf},
};
use uuid::Uuid;

#[tauri::command]
pub fn duplicate_content(
    app: tauri::AppHandle,
    contents_info: ContentsInfo,
) -> Result<ContentsInfo, String> {
    let _guard = backup_manager::CONTENT_WRITE_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    let library = file_manager::get_library_path(&app)?;
    super::image_rename::recover(library.parent().ok_or("Invalid library root")?)?;
    document_name::ensure_text_ids(
        &library,
        &file_manager::get_backup_root_path(&app)?,
        &contents_info.story_name,
    )?;
    duplicate_content_at(
        &library,
        &file_manager::get_backup_path(&app)?,
        &contents_info,
    )
}

#[tauri::command]
pub fn duplicate_story(
    app: tauri::AppHandle,
    story_name: String,
) -> Result<file_manager::StoryInfo, String> {
    let _guard = backup_manager::CONTENT_WRITE_LOCK
        .lock()
        .map_err(|e| e.to_string())?;
    let library = file_manager::get_library_path(&app)?;
    super::image_rename::recover(library.parent().ok_or("Invalid library root")?)?;
    document_name::ensure_text_ids(
        &library,
        &file_manager::get_backup_root_path(&app)?,
        &story_name,
    )?;
    duplicate_story_at(&library, &file_manager::get_backup_path(&app)?, &story_name)
}

fn normalized(name: &str) -> String {
    name.trim().to_lowercase()
}

// Copying a copy continues the same sequence. Reserve room for the suffix even
// when the original already uses the full Windows name length allowance.
fn next_name(original: &str, occupied: &HashSet<String>) -> Result<String, String> {
    path_gate::validate_name(original)?;
    let base = original
        .strip_suffix(')')
        .and_then(|s| s.rsplit_once(" ("))
        .filter(|(_, n)| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()))
        .map_or(original, |(base, _)| base);
    for number in 1..=u32::MAX {
        let suffix = format!(" ({number})");
        let mut length = 0;
        let prefix: String = base
            .chars()
            .take_while(|ch| {
                length += ch.len_utf16();
                length <= 100 - suffix.len()
            })
            .collect();
        let candidate = format!("{prefix}{suffix}");
        path_gate::validate_name(&candidate)?;
        if !occupied.contains(&normalized(&candidate)) {
            return Ok(candidate);
        }
    }
    Err("No duplicate name available".into())
}

// Only traverse ordinary directories/files; never follow links outside a Story.
fn copy_tree(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir(destination).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let kind = entry.file_type().map_err(|e| e.to_string())?;
        let target = destination.join(entry.file_name());
        if kind.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else if kind.is_file() {
            fs::copy(entry.path(), target).map_err(|e| e.to_string())?;
        } else {
            return Err("Story contains an unsupported link or special file".into());
        }
    }
    Ok(())
}

struct Staging(PathBuf);
impl Staging {
    fn new(library: &Path) -> Result<Self, String> {
        // Keep interrupted staging directories out of the Library story list.
        let path = library
            .parent()
            .ok_or("Invalid library root")?
            .join(format!(".duplicate-{}", Uuid::new_v4()));
        fs::create_dir(&path).map_err(|e| e.to_string())?;
        Ok(Self(path))
    }
}
impl Drop for Staging {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn write_new(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())
}

fn baseline(backup: &Path, info: &ContentsInfo, path: &Path) -> Result<(), String> {
    let body = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if info.content_type != ContentType::Txt {
        let value: serde_json::Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
        if !value.is_object() {
            return Err("JSON content must be an object".into());
        }
    }
    backup_manager::write_initial_backup_at(
        backup,
        &info.story_name,
        path.file_stem()
            .and_then(|s| s.to_str())
            .ok_or("Invalid content filename")?,
        body,
    )
}

fn duplicate_content_at(
    library: &Path,
    backup: &Path,
    input: &ContentsInfo,
) -> Result<ContentsInfo, String> {
    if !fs::symlink_metadata(path_gate::story_dir(library, &input.story_name)?)
        .map_err(|e| e.to_string())?
        .file_type()
        .is_dir()
    {
        return Err("Story not found or is a link".into());
    }
    let source = content_path::resolve(library, input)?;
    let actual =
        content_path::inspect(&input.story_name, &source).ok_or("Invalid source content")?;
    let names = content_path::list(library, &input.story_name)?
        .iter()
        .map(|info| normalized(&info.name))
        .collect();
    let info = ContentsInfo {
        name: next_name(&actual.name, &names)?,
        access_id: Uuid::new_v4().to_string(),
        ..actual
    };
    let stage = Staging::new(library)?;
    let filename = content_path::file_name(info.content_type, &info.name, &info.access_id)?;
    let staged = stage.0.join(&filename);
    let bytes = fs::read(&source).map_err(|e| e.to_string())?;
    let bytes = if info.content_type == ContentType::Txt {
        bytes
    } else {
        let mut value: serde_json::Value =
            serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        value
            .as_object_mut()
            .ok_or("JSON content must be an object")?
            .insert("name".into(), info.name.clone().into());
        serde_json::to_vec_pretty(&value).map_err(|e| e.to_string())?
    };
    write_new(&staged, &bytes)?;
    let staged_backup_root = stage.0.join("Backup");
    baseline(&staged_backup_root, &info, &staged)?;
    let destination = path_gate::story_dir(library, &info.story_name)?.join(&filename);
    let backup_dir = path_gate::story_dir(backup, &info.story_name)?;
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    let backup_name = staged
        .with_extension("json")
        .file_name()
        .unwrap()
        .to_owned();
    let destination_backup = backup_dir.join(&backup_name);
    let metadata = path_gate::story_metadata(library, &info.story_name)?;
    let previous_metadata = match fs::read(&metadata) {
        Ok(bytes) => Some(String::from_utf8(bytes).map_err(|e| e.to_string())?),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(e.to_string()),
    };
    atomic_file::move_no_replace(
        &staged_backup_root.join(&info.story_name).join(backup_name),
        &destination_backup,
    )
    .map_err(|e| e.to_string())?;
    if let Err(e) = atomic_file::move_no_replace(&staged, &destination) {
        fs::remove_file(&destination_backup)
            .map_err(|cleanup| format!("{e}; rollback failed: {cleanup}"))?;
        return Err(e.to_string());
    }
    if let Err(e) = file_manager::sync_story_info_in_library(library, &info.story_name, true) {
        fs::remove_file(&destination)
            .map_err(|cleanup| format!("{e}; rollback failed: {cleanup}"))?;
        fs::remove_file(&destination_backup)
            .map_err(|cleanup| format!("{e}; rollback failed: {cleanup}"))?;
        if let Some(previous) = previous_metadata {
            atomic_file::write_text_or_create(&metadata, &previous)
                .map_err(|cleanup| format!("{e}; metadata rollback failed: {cleanup}"))?;
        } else if metadata.exists() {
            fs::remove_file(metadata)
                .map_err(|cleanup| format!("{e}; metadata rollback failed: {cleanup}"))?;
        }
        return Err(e);
    }
    Ok(info)
}

fn duplicate_story_at(
    library: &Path,
    backup: &Path,
    original: &str,
) -> Result<file_manager::StoryInfo, String> {
    let source = path_gate::story_dir(library, original)?;
    if !fs::symlink_metadata(&source)
        .map_err(|e| e.to_string())?
        .file_type()
        .is_dir()
    {
        return Err("Story not found or is a link".into());
    }
    match fs::read(source.join("story_metadata.json")) {
        Ok(bytes) => {
            serde_json::from_slice::<file_manager::StoryInfo>(&bytes).map_err(|e| e.to_string())?;
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e.to_string()),
    }
    let mut occupied = HashSet::new();
    for root in [library, backup] {
        if root.exists() {
            for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
                occupied.insert(normalized(
                    &entry
                        .map_err(|e| e.to_string())?
                        .file_name()
                        .to_string_lossy(),
                ));
            }
        }
    }
    let name = next_name(original, &occupied)?;
    let stage = Staging::new(library)?;
    let staged_story = stage.0.join(&name);
    copy_tree(&source, &staged_story)?;
    let staged_backup = stage.0.join("Backup");
    fs::create_dir_all(staged_backup.join(&name)).map_err(|e| e.to_string())?;
    for old in content_path::list(library, original)? {
        let old_path = content_path::resolve(library, &old)?;
        let info = ContentsInfo {
            story_name: name.clone(),
            access_id: Uuid::new_v4().to_string(),
            ..old
        };
        let old_staged = staged_story.join(old_path.file_name().ok_or("Invalid source filename")?);
        let new_staged = staged_story.join(content_path::file_name(
            info.content_type,
            &info.name,
            &info.access_id,
        )?);
        fs::rename(old_staged, &new_staged).map_err(|e| e.to_string())?;
        baseline(&staged_backup, &info, &new_staged)?;
    }
    file_manager::prepare_duplicate_story_info(library, original, &stage.0, &name)?;
    // Read the completed metadata before publishing anything.
    let result = serde_json::from_slice(
        &fs::read(staged_story.join("story_metadata.json")).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::create_dir_all(backup).map_err(|e| e.to_string())?;
    let destination_backup = backup.join(&name);
    atomic_file::move_no_replace(&staged_backup.join(&name), &destination_backup)
        .map_err(|e| e.to_string())?;
    if let Err(e) = atomic_file::move_no_replace(&staged_story, &library.join(&name)) {
        fs::remove_dir_all(&destination_backup)
            .map_err(|cleanup| format!("{e}; rollback failed: {cleanup}"))?;
        return Err(e.to_string());
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("typenap-duplicate-test-{}", Uuid::new_v4()));
            fs::create_dir_all(root.join("Library/Story")).unwrap();
            Self(root)
        }
        fn library(&self) -> PathBuf {
            self.0.join("Library")
        }
        fn backup(&self) -> PathBuf {
            self.0.join("Backup/Alive")
        }
        fn content(&self, kind: ContentType) -> ContentsInfo {
            let info = ContentsInfo {
                story_name: "Story".into(),
                name: "Original".into(),
                content_type: kind,
                access_id: Uuid::new_v4().to_string(),
            };
            let path = self
                .library()
                .join("Story")
                .join(content_path::file_name(kind, &info.name, &info.access_id).unwrap());
            fs::write(path, if kind == ContentType::Txt { "本文\nsecond line" } else {
                r#"{"name":"Original","imagePaths":["shared.png"],"templateStack":[],"custom":{"keep":true}}"#
            }).unwrap();
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
    fn duplicates_each_content_kind_with_fresh_identity_body_and_backup() {
        for kind in [
            ContentType::Txt,
            ContentType::Character,
            ContentType::World,
            ContentType::Entity,
        ] {
            let f = Fixture::new();
            let mut original = f.content(kind);
            let original_path = content_path::resolve(&f.library(), &original).unwrap();
            let original_bytes = fs::read(&original_path).unwrap();
            original.name = "stale title".into();
            let first = duplicate_content_at(&f.library(), &f.backup(), &original).unwrap();
            let second = duplicate_content_at(&f.library(), &f.backup(), &first).unwrap();
            assert_eq!(first.name, "Original (1)");
            assert_eq!(second.name, "Original (2)");
            assert_ne!(first.access_id, original.access_id);
            assert_ne!(first.access_id, second.access_id);
            let path = content_path::resolve(&f.library(), &first).unwrap();
            let body = fs::read_to_string(&path).unwrap();
            if kind == ContentType::Txt {
                assert_eq!(body.as_bytes(), original_bytes);
            } else {
                let value: Value = serde_json::from_str(&body).unwrap();
                assert_eq!(value["name"], "Original (1)");
                assert_eq!(value["custom"]["keep"], true);
                assert_eq!(value["imagePaths"], json!(["shared.png"]));
            }
            let backup: Value = serde_json::from_slice(
                &fs::read(
                    f.backup()
                        .join("Story")
                        .join(path.with_extension("json").file_name().unwrap()),
                )
                .unwrap(),
            )
            .unwrap();
            assert_eq!(backup["backups"][0]["base_content"], body);
            assert_eq!(backup["backups"][0]["incremental_content"], json!([]));
            fs::write(&path, "independent edit").unwrap();
            assert_eq!(fs::read(original_path).unwrap(), original_bytes);
        }
    }

    #[test]
    fn story_copy_preserves_metadata_and_assets_with_new_ids_and_new_history() {
        let f = Fixture::new();
        let originals: Vec<_> = [
            ContentType::Txt,
            ContentType::Character,
            ContentType::World,
            ContentType::Entity,
        ]
        .into_iter()
        .map(|kind| f.content(kind))
        .collect();
        fs::write(f.library().join("Story/story_metadata.json"), json!({
            "story_name":"Story", "synopsis":"synopsis", "cover":"#aabbcc", "cover_text_color":"#ffffff", "created_at":1
        }).to_string()).unwrap();
        fs::create_dir(f.library().join("Story/assets")).unwrap();
        fs::write(f.library().join("Story/assets/extra.bin"), [0, 255, 1]).unwrap();
        fs::create_dir_all(f.backup().join("Story (1)")).unwrap();
        let result = duplicate_story_at(&f.library(), &f.backup(), "Story").unwrap();
        let metadata = serde_json::to_value(result).unwrap();
        assert_eq!(metadata["story_name"], "Story (2)");
        assert_eq!(metadata["synopsis"], "synopsis");
        assert_eq!(metadata["cover"], "#aabbcc");
        assert_eq!(metadata["cover_text_color"], "#ffffff");
        assert!(metadata["created_at"].as_i64().unwrap() > 1);
        assert_eq!(
            fs::read(f.library().join("Story (2)/assets/extra.bin")).unwrap(),
            [0, 255, 1]
        );
        let copied = content_path::list(&f.library(), "Story (2)").unwrap();
        assert_eq!(copied.len(), 4);
        for info in copied {
            assert_eq!(info.name, "Original");
            assert!(originals.iter().all(|old| old.access_id != info.access_id));
            let path = content_path::resolve(&f.library(), &info).unwrap();
            let backup: Value = serde_json::from_slice(
                &fs::read(
                    f.backup()
                        .join("Story (2)")
                        .join(path.with_extension("json").file_name().unwrap()),
                )
                .unwrap(),
            )
            .unwrap();
            assert_eq!(backup["story_name"], "Story (2)");
            assert_eq!(backup["backups"].as_array().unwrap().len(), 1);
        }
        assert_eq!(content_path::list(&f.library(), "Story").unwrap().len(), 4);
    }

    #[test]
    fn invalid_sources_and_failed_backups_leave_no_duplicate() {
        let f = Fixture::new();
        let mut info = f.content(ContentType::Character);
        let source = content_path::resolve(&f.library(), &info).unwrap();
        fs::write(&source, "invalid JSON").unwrap();
        assert!(duplicate_content_at(&f.library(), &f.backup(), &info).is_err());
        fs::write(&source, "{}").unwrap();
        fs::create_dir_all(f.0.join("Backup")).unwrap();
        fs::write(f.backup(), "blocking file").unwrap();
        assert!(duplicate_content_at(&f.library(), &f.backup(), &info).is_err());
        assert!(duplicate_story_at(&f.library(), &f.backup(), "Story").is_err());
        info.story_name = "../outside".into();
        assert!(duplicate_content_at(&f.library(), &f.backup(), &info).is_err());
        assert!(duplicate_story_at(&f.library(), &f.backup(), "../outside").is_err());
        assert_eq!(fs::read_dir(f.library()).unwrap().count(), 1);
        assert_eq!(content_path::list(&f.library(), "Story").unwrap().len(), 1);
    }

    #[test]
    fn naming_handles_gaps_case_and_utf16_limit() {
        let occupied = ["original (1)", "original (3)"]
            .into_iter()
            .map(String::from)
            .collect();
        assert_eq!(
            next_name("Original (3)", &occupied).unwrap(),
            "Original (2)"
        );
        let name = next_name(&"羊".repeat(100), &HashSet::new()).unwrap();
        assert_eq!(name.encode_utf16().count(), 100);
        assert!(name.ends_with(" (1)"));
        assert!(
            next_name(&"🐑".repeat(50), &HashSet::new())
                .unwrap()
                .encode_utf16()
                .count()
                <= 100
        );
    }
}
