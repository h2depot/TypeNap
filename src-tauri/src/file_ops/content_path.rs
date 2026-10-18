//! Shared file identity and naming for text and JSON content.
use super::contents_info::{ContentType, ContentsInfo};
use crate::utils::path_gate;
use std::{
    fs,
    path::{Path, PathBuf},
};
use uuid::Uuid;

pub fn parse_id(value: &str) -> Result<Uuid, String> {
    let id = Uuid::parse_str(value).map_err(|_| "Invalid content access_id".to_string())?;
    if value.len() != 36 || id.get_version_num() != 4 || id.get_variant() != uuid::Variant::RFC4122
    {
        return Err("Content access_id must be a UUID v4".into());
    }
    Ok(id)
}

pub fn inspect(story_name: &str, path: &Path) -> Option<ContentsInfo> {
    let (prefix, rest) = path.file_stem()?.to_str()?.split_once('_')?;
    let kind = match prefix {
        "text" => ContentType::Txt,
        "character" => ContentType::Character,
        "world" => ContentType::World,
        "entity" => ContentType::Entity,
        _ => return None,
    };
    if path.extension()?.to_str()? != kind.extension() {
        return None;
    }
    let (name, id) = rest.rsplit_once('_')?;
    path_gate::validate_name(name).ok()?;
    Some(ContentsInfo {
        story_name: story_name.into(),
        name: name.into(),
        access_id: parse_id(id).ok()?.to_string(),
        content_type: kind,
    })
}

pub fn file_name(kind: ContentType, name: &str, id: &str) -> Result<String, String> {
    path_gate::validate_name(name)?;
    Ok(format!(
        "{}_{}_{}.{}",
        kind.prefix(),
        name,
        parse_id(id)?,
        kind.extension()
    ))
}

pub fn list(root: &Path, story_name: &str) -> Result<Vec<ContentsInfo>, String> {
    let story = path_gate::story_dir(root, story_name)?;
    let entries = match fs::read_dir(story) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e.to_string()),
    };
    let mut contents = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_type().map_err(|e| e.to_string())?.is_file() {
            if let Some(info) = inspect(story_name, &entry.path()) {
                contents.push(info);
            }
        }
    }
    contents.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(contents)
}

pub fn resolve(root: &Path, info: &ContentsInfo) -> Result<PathBuf, String> {
    let id = parse_id(&info.access_id)?.to_string();
    let mut found = None;
    for entry in
        fs::read_dir(path_gate::story_dir(root, &info.story_name)?).map_err(|e| e.to_string())?
    {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().map_err(|e| e.to_string())?.is_file() {
            continue;
        }
        let path = entry.path();
        if let Some(actual) = inspect(&info.story_name, &path) {
            if actual.access_id == id && actual.content_type == info.content_type {
                if found.is_some() {
                    return Err("Duplicate content access_id".into());
                }
                found = Some(path);
            }
        }
    }
    found.ok_or_else(|| "Content not found".into())
}

pub fn renamed_path(
    root: &Path,
    info: &ContentsInfo,
    name: &str,
) -> Result<(PathBuf, PathBuf), String> {
    path_gate::validate_name(name)?;
    let old = resolve(root, info)?;
    for item in list(root, &info.story_name)? {
        if item.content_type == info.content_type
            && item.name.trim().to_lowercase() == name.trim().to_lowercase()
            && parse_id(&item.access_id)? != parse_id(&info.access_id)?
        {
            return Err("Content already exists".into());
        }
    }
    let new = path_gate::story_dir(root, &info.story_name)?.join(file_name(
        info.content_type,
        name,
        &info.access_id,
    )?);
    if old != new && new.exists() {
        return Err("Content already exists".into());
    }
    Ok((old, new))
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("typenap-identity-test-{}", Uuid::new_v4()));
            fs::create_dir_all(root.join("Library/Story")).unwrap();
            Self(root)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            assert_eq!(self.0.parent(), Some(std::env::temp_dir().as_path()));
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn resolves_text_by_id_even_with_stale_names_and_rejects_ambiguity() {
        let fixture = Fixture::new();
        let library = fixture.0.join("Library");
        let path = super::super::document_name::create(
            &library,
            &fixture.0.join("Backup"),
            "Story",
            "Original",
        )
        .unwrap();
        let mut info = inspect("Story", &path).unwrap();
        fs::write(&path, "keep this body").unwrap();
        let (old, new) = renamed_path(&library, &info, "Renamed").unwrap();
        fs::rename(old, &new).unwrap();
        assert_eq!(resolve(&library, &info).unwrap(), new);
        info.name = "ignored stale name".into();
        assert_eq!(
            fs::read_to_string(resolve(&library, &info).unwrap()).unwrap(),
            "keep this body"
        );
        let mut wrong_id = info.clone();
        wrong_id.access_id = Uuid::new_v4().to_string();
        assert!(resolve(&library, &wrong_id).is_err());
        let mut wrong_kind = info.clone();
        wrong_kind.content_type = ContentType::Character;
        assert!(super::super::super::utils::path_gate::text_file(&library, &wrong_kind).is_err());
        let mut invalid = info.clone();
        invalid.access_id = "../outside".into();
        assert!(resolve(&library, &invalid).is_err());
        invalid = info.clone();
        invalid.story_name = "../outside".into();
        assert!(resolve(&library, &invalid).is_err());
        fs::write(
            library
                .join("Story")
                .join(file_name(ContentType::Txt, "Duplicate", &info.access_id).unwrap()),
            "other body",
        )
        .unwrap();
        assert!(resolve(&library, &info).is_err());
    }

    #[test]
    fn legacy_migration_preserves_body_history_and_is_repeatable() {
        let fixture = Fixture::new();
        let library = fixture.0.join("Library");
        let backups = fixture.0.join("Backup");
        let backup_story = backups.join("Alive/Story");
        fs::create_dir_all(&backup_story).unwrap();
        fs::write(library.join("Story/Legacy.txt"), "current body").unwrap();
        let backup = serde_json::json!({"story_name": "Story", "file_name": "Legacy", "backups": [{"base_content": "old body", "incremental_content": []}]});
        fs::write(
            backup_story.join("Legacy.json"),
            serde_json::to_vec(&backup).unwrap(),
        )
        .unwrap();
        super::super::document_name::ensure_text_ids(&library, &backups, "Story").unwrap();
        let contents = list(&library, "Story").unwrap();
        assert_eq!(contents.len(), 1);
        let info = &contents[0];
        assert_eq!(info.name, "Legacy");
        let path = resolve(&library, info).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "current body");
        let renamed_backup = backup_story.join(path.with_extension("json").file_name().unwrap());
        let migrated: serde_json::Value =
            serde_json::from_slice(&fs::read(renamed_backup).unwrap()).unwrap();
        assert_eq!(migrated["backups"], backup["backups"]);
        assert!(!backup_story.join("Legacy.json").exists());
        super::super::document_name::ensure_text_ids(&library, &backups, "Story").unwrap();
        assert_eq!(list(&library, "Story").unwrap(), contents);

        fs::write(library.join("Story/Broken.txt"), "untouched").unwrap();
        fs::write(backup_story.join("Broken.json"), "invalid JSON").unwrap();
        assert!(super::super::document_name::ensure_text_ids(&library, &backups, "Story").is_err());
        assert_eq!(
            fs::read_to_string(library.join("Story/Broken.txt")).unwrap(),
            "untouched"
        );
        assert_eq!(
            fs::read_to_string(backup_story.join("Broken.json")).unwrap(),
            "invalid JSON"
        );
    }
}
