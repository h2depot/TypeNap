use crate::utils::path_gate;
use std::fs;
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

pub fn resolve(root: &Path, story_name: &str, title: &str) -> Result<PathBuf, String> {
    path_gate::validate_name(title)?;
    let story = path_gate::story_dir(root, story_name)?;
    find_title(&story, title)?.ok_or_else(|| "Text not found".to_string())
}

pub fn resolve_stem(root: &Path, story_name: &str, title: &str) -> Result<String, String> {
    let path = resolve(root, story_name, title)?;
    Ok(path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| "Invalid text file name".to_string())?
        .to_string())
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
                        if let Some((_, id)) = split(original) {
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
        if !ids.iter().any(|existing| *existing == candidate) {
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

#[cfg(test)]
mod tests {
    use super::*;

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("typenap-document-test-{}", Uuid::new_v4()));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            assert_eq!(self.0.parent(), Some(std::env::temp_dir().as_path()));
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn retries_colliding_ids_with_linear_search() {
        let first = Uuid::new_v4();
        let last = Uuid::new_v4();
        let fresh = Uuid::new_v4();
        let mut candidates = [first, last, fresh].into_iter();
        assert_eq!(
            unused_id(&[first, last], || candidates.next().unwrap()),
            fresh
        );
        assert!(candidates.next().is_none());
    }

    #[test]
    fn creation_resolves_display_names_and_rejects_duplicate_titles() {
        let fixture = Fixture::new();
        let root = fixture.0.join("Library");
        let backups = fixture.0.join("Backup");
        let title = "第一章_part_2";
        let path = create(&root, &backups, "Story", title).unwrap();
        let stem = path.file_stem().unwrap().to_str().unwrap();
        let (parsed_title, id) = split(stem).unwrap();
        assert_eq!(parsed_title, title);
        assert_eq!(id.get_version_num(), 4);
        assert_eq!(resolve(&root, "Story", title).unwrap(), path);
        fs::write(&path, "keep this content").unwrap();
        assert!(create(&root, &backups, "Story", " 第一章_PART_2 ").is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "keep this content");
        let renamed = renamed_stem(stem, "新しい章_3").unwrap();
        assert_eq!(split(&renamed), Some(("新しい章_3", id)));
        let new_path = path.with_file_name(format!("{renamed}.txt"));
        fs::rename(&path, &new_path).unwrap();
        assert_eq!(resolve(&root, "Story", "新しい章_3").unwrap(), new_path);
        assert!(resolve(&root, "Story", title).is_err());
    }

    #[test]
    fn scans_all_stories_and_backup_copies() {
        let fixture = Fixture::new();
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let third = Uuid::new_v4();
        for (folder, file) in [
            ("Library/A", format!("text_one_{first}.txt")),
            ("Library/B", format!("text_two_{second}.txt")),
            ("Backup/Alive/B", format!("text_two_{second}.json")),
            (
                "Backup/Necropolis/A_123",
                format!("text_three_{third}_123_1.txt"),
            ),
        ] {
            let directory = fixture.0.join(folder);
            fs::create_dir_all(&directory).unwrap();
            fs::write(directory.join(file), "").unwrap();
        }
        let mut ids = Vec::new();
        collect_ids(&fixture.0, &mut ids).unwrap();
        assert_eq!(ids.len(), 4);
        assert!(ids.contains(&first) && ids.contains(&second) && ids.contains(&third));
    }

    #[test]
    fn retains_title_limits_legacy_files_and_path_validation() {
        let fixture = Fixture::new();
        let root = fixture.0.join("Library");
        let backups = fixture.0.join("Backup");
        let title = "あ".repeat(100);
        let path = create(&root, &backups, "Story", &title).unwrap();
        validate_stem(path.file_stem().unwrap().to_str().unwrap()).unwrap();
        assert_eq!(
            path_gate::text_backup(
                &backups,
                "Story",
                path.file_stem().unwrap().to_str().unwrap()
            )
            .unwrap(),
            backups
                .join("Story")
                .join(path.with_extension("json").file_name().unwrap()),
        );
        assert!(create(&root, &backups, "Story", &"あ".repeat(101)).is_err());
        assert!(create(&root, &backups, "../outside", "title").is_err());
        assert!(create(&root, &backups, "Story", "../outside").is_err());
        let legacy = root.join("Story/old_name.txt");
        fs::write(&legacy, "legacy").unwrap();
        assert_eq!(resolve(&root, "Story", "old_name").unwrap(), legacy);
        assert_eq!(display_title("text_old_not-a-uuid"), "text_old_not-a-uuid");
        assert!(create(&root, &backups, "Story", "OLD_NAME").is_err());
    }
}
