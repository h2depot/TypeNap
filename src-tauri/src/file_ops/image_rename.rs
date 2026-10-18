//! Image rename preflight, persistent path redirects and recoverable transactions.
use super::image_manager::is_supported_image_file;
use crate::utils::path_gate;
use serde::{Deserialize, Serialize};
use serde_json::Value;
#[cfg(test)]
use std::path::PathBuf;
use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Component, Path},
};

const REDIRECT_FILE: &str = "Image/.renames.json";
const TRANSACTION_DIR: &str = "Image/.rename-transaction";
pub type Redirects = BTreeMap<String, String>;

fn path_key(path: &str) -> String {
    path.replace('\\', "/").to_lowercase()
}

pub fn redirects(app_data: &Path) -> Result<Redirects, String> {
    let bytes = match fs::read(app_data.join(REDIRECT_FILE)) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(BTreeMap::new()),
        Err(error) => return Err(error.to_string()),
    };
    let aliases: Redirects = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Invalid image rename redirects: {error}"))?;
    let root = format!(
        "{}/",
        path_key(&app_data.join("Image/user").to_string_lossy())
    );
    for (old, new) in &aliases {
        for path in [old.as_str(), new.as_str()] {
            let normalized = path_key(path);
            let name = normalized
                .strip_prefix(&root)
                .ok_or("Image redirect leaves the user collection")?;
            validate_source_name(name)?;
            if !is_supported_image_file(Path::new(name)) {
                return Err("Invalid image redirect format".into());
            }
        }
    }
    for path in aliases.keys() {
        resolve_with(app_data, &aliases, path)?;
    }
    Ok(aliases)
}

pub fn resolve_with(app_data: &Path, redirects: &Redirects, path: &str) -> Result<String, String> {
    let mut current = super::image_manager::migrated_image_path(app_data, path);
    let legacy_root = format!(
        "{}/",
        path_key(&app_data.join("BgImage/user").to_string_lossy())
    );
    if path_key(path).starts_with(&legacy_root) {
        if let Some(name) = path.replace('\\', "/").rsplit('/').next() {
            validate_source_name(name)?;
            current = app_data
                .join("Image/user")
                .join(name)
                .to_string_lossy()
                .into_owned();
        }
    }
    for _ in 0..=redirects.len() {
        let Some(next) = redirects.get(&path_key(&current)) else {
            return Ok(current);
        };
        if path_key(next) == path_key(&current) {
            return Ok(next.clone());
        }
        current = next.clone();
    }
    Err("Cyclic image rename redirects".into())
}

pub fn resolve_reference(app_data: &Path, path: &str) -> Result<String, String> {
    resolve_with(app_data, &redirects(app_data)?, path)
}

pub fn import_name_reserved(app_data: &Path, path: &Path) -> Result<bool, String> {
    let aliases = redirects(app_data)?;
    let name = path.to_string_lossy();
    Ok((aliases.contains_key(&path_key(&name)) && !path.exists())
        || path_key(&resolve_with(app_data, &aliases, &name)?) != path_key(&name))
}

pub fn normalize_object_references(app_data: &Path, value: &mut Value) -> Result<(), String> {
    let redirects = redirects(app_data)?;
    if let Some(images) = value.get_mut("imagePaths").and_then(Value::as_array_mut) {
        for image in images {
            if let Some(path) = image.as_str() {
                *image = Value::String(resolve_with(app_data, &redirects, path)?);
            }
        }
    }
    Ok(())
}

fn replace_fields(app_data: &Path, value: &mut Value, old: &str, new: &str) -> bool {
    let mut changed = false;
    if let Some(cover) = value.get_mut("cover") {
        if cover
            .as_str()
            .is_some_and(|path| refers_to(app_data, path, old))
        {
            *cover = Value::String(new.into());
            changed = true;
        }
    }
    if let Some(images) = value.get_mut("imagePaths").and_then(Value::as_array_mut) {
        for image in images {
            if image
                .as_str()
                .is_some_and(|path| refers_to(app_data, path, old))
            {
                *image = Value::String(new.into());
                changed = true;
            }
        }
    }
    changed
}

#[derive(Serialize, Deserialize)]
struct Journal {
    version: u8,
    committed: bool,
    old_name: String,
    new_name: String,
    files: Vec<JournalFile>,
}

#[derive(Serialize, Deserialize)]
struct JournalFile {
    path: String,
    existed: bool,
}

fn checked_path(app_data: &Path, relative: &str) -> Result<std::path::PathBuf, String> {
    let relative_path = Path::new(relative);
    if relative_path
        .components()
        .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err("Invalid image transaction path".into());
    }
    if relative != "settings.json"
        && relative != REDIRECT_FILE
        && !relative_path.starts_with("TypeNap_Library")
        && !relative_path.starts_with("Backup")
    {
        return Err("Image transaction path is outside managed references".into());
    }
    let mut current = app_data.to_path_buf();
    for part in relative_path.components() {
        current.push(part);
        if let Ok(metadata) = fs::symlink_metadata(&current) {
            if metadata.file_type().is_symlink() {
                return Err("Image transaction cannot follow symbolic links".into());
            }
        }
    }
    Ok(current)
}

fn write_synced(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| error.to_string())?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|error| error.to_string())
}

fn write_journal(directory: &Path, journal: &Journal) -> Result<(), String> {
    super::atomic_file::write_text_or_create(
        &directory.join("manifest.json"),
        &serde_json::to_string(journal).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

fn cleanup_transaction(app_data: &Path) -> Result<(), String> {
    let directory = app_data.join(TRANSACTION_DIR);
    if !directory.exists() {
        return Ok(());
    }
    let image_root = fs::canonicalize(app_data.join("Image")).map_err(|error| error.to_string())?;
    let resolved = fs::canonicalize(&directory).map_err(|error| error.to_string())?;
    if resolved.parent() != Some(image_root.as_path())
        || resolved.file_name() != Some(std::ffi::OsStr::new(".rename-transaction"))
    {
        return Err("Invalid image recovery directory".into());
    }
    fs::remove_dir_all(directory).map_err(|error| error.to_string())
}

// Prepared operations roll back. A committed operation only needs temporary cleanup.
pub fn recover(app_data: &Path) -> Result<(), String> {
    let directory = app_data.join(TRANSACTION_DIR);
    let manifest = directory.join("manifest.json");
    if !manifest.exists() {
        return cleanup_transaction(app_data);
    }
    let journal: Journal =
        serde_json::from_slice(&fs::read(&manifest).map_err(|error| error.to_string())?)
            .map_err(|error| format!("Invalid image recovery manifest: {error}"))?;
    if journal.version != 1 {
        return Err("Unsupported image recovery version".into());
    }
    validate_source_name(&journal.old_name)?;
    path_gate::validate_name(&journal.new_name)?;
    if journal.committed {
        return cleanup_transaction(app_data);
    }
    for (index, entry) in journal.files.iter().enumerate().rev() {
        let path = checked_path(app_data, &entry.path)?;
        let after = fs::read(directory.join(format!("{index}.after")))
            .map_err(|error| error.to_string())?;
        let before = if entry.existed {
            Some(
                fs::read(directory.join(format!("{index}.before")))
                    .map_err(|error| error.to_string())?,
            )
        } else {
            None
        };
        let current = match fs::read(&path) {
            Ok(bytes) => Some(bytes),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
            Err(error) => return Err(error.to_string()),
        };
        if current == before {
            continue;
        }
        if current.is_some() && current.as_ref() != Some(&after) {
            return Err(format!(
                "Reference changed outside image transaction: {}",
                path.display()
            ));
        }
        if let Some(before) = before {
            let text = std::str::from_utf8(&before).map_err(|error| error.to_string())?;
            super::atomic_file::write_text_or_create(&path, text)
                .map_err(|error| error.to_string())?;
        } else if current.is_some() {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
    }
    let old = app_data.join("Image/user").join(&journal.old_name);
    let new = app_data.join("Image/user").join(&journal.new_name);
    let moving = directory.join("image.moving");
    let original = fs::read(directory.join("image.before")).map_err(|error| error.to_string())?;
    if moving.exists() {
        if fs::read(&moving).map_err(|error| error.to_string())? != original {
            return Err("Staged image changed during recovery".into());
        }
        super::atomic_file::move_no_replace(&moving, &old).map_err(|error| error.to_string())?;
    } else {
        let case_only = path_key(&old.to_string_lossy()) == path_key(&new.to_string_lossy());
        let actual_old_name = fs::read_dir(app_data.join("Image/user"))
            .map_err(|error| error.to_string())?
            .filter_map(Result::ok)
            .any(|entry| entry.file_name() == std::ffi::OsStr::new(&journal.old_name));
        if !old.exists() || (case_only && !actual_old_name) {
            if new.exists() {
                if fs::read(&new).map_err(|error| error.to_string())? != original {
                    return Err("Renamed image changed during recovery".into());
                }
                super::atomic_file::move_no_replace(&new, &moving)
                    .map_err(|error| error.to_string())?;
                super::atomic_file::move_no_replace(&moving, &old)
                    .map_err(|error| error.to_string())?;
            } else {
                write_synced(&old, &original)?;
            }
        } else if fs::read(&old).map_err(|error| error.to_string())? != original {
            return Err("Original image changed during recovery".into());
        }
    }
    cleanup_transaction(app_data)
}

#[derive(Serialize)]
pub struct ImageRenameResult {
    pub old_path: String,
    pub new_path: String,
    pub redirects: Redirects,
}

// The caller holds CONTENT_WRITE_LOCK and synchronizes the plugin's settings cache.
pub fn execute(
    app_data: &Path,
    img_name: &str,
    new_name: &str,
    synchronize_settings: impl Fn() -> Result<(), String>,
) -> Result<ImageRenameResult, String> {
    execute_with_hook(app_data, img_name, new_name, synchronize_settings, |_| {
        Ok(())
    })
}

fn execute_with_hook(
    app_data: &Path,
    img_name: &str,
    new_name: &str,
    synchronize_settings: impl Fn() -> Result<(), String>,
    step: impl Fn(usize) -> Result<(), String>,
) -> Result<ImageRenameResult, String> {
    recover(app_data)?;
    let plan = plan(app_data, img_name, new_name)?;
    if !plan.issues.is_empty() {
        return Err(format!(
            "Cannot inspect all image references: {}",
            plan.issues
                .iter()
                .map(|issue| format!("{}: {}", issue.file_path, issue.message))
                .collect::<Vec<_>>()
                .join("\n")
        ));
    }
    let mut aliases = redirects(app_data)?;
    if !plan.changes_required {
        return Ok(ImageRenameResult {
            old_path: plan.old_path,
            new_path: plan.new_path,
            redirects: aliases,
        });
    }
    let target = resolve_with(app_data, &aliases, &plan.new_path)?;
    if aliases.contains_key(&path_key(&plan.new_path))
        && path_key(&target) != path_key(&plan.old_path)
    {
        return Err("That name is reserved by another renamed image".into());
    }
    let mut updates = BTreeMap::new();
    for reference in &plan.references {
        let path = Path::new(&reference.file_path);
        if updates.contains_key(path) {
            continue;
        }
        let before = fs::read(path).map_err(|error| error.to_string())?;
        let mut value: Value =
            serde_json::from_slice(&before).map_err(|error| error.to_string())?;
        if matches!(reference.kind, ImageReferenceKind::Background) {
            if let Some(background) = value.pointer_mut("/bgimage/path") {
                *background = Value::String(plan.new_path.clone());
            }
        } else if value.get("backups").is_some()
            || value
                .get("files")
                .and_then(Value::as_array)
                .is_some_and(|files| {
                    files
                        .first()
                        .is_some_and(|node| node.get("base_content").is_some())
                })
        {
            value = super::backup_manager::remap_image_history(&value, |value| {
                replace_fields(app_data, value, &plan.old_path, &plan.new_path)
            })?;
        } else {
            replace_fields(app_data, &mut value, &plan.old_path, &plan.new_path);
        }
        updates.insert(
            path.to_path_buf(),
            serde_json::to_string_pretty(&value).map_err(|error| error.to_string())?,
        );
    }
    aliases.remove(&path_key(&plan.new_path));
    for value in aliases.values_mut() {
        if refers_to(app_data, value, &plan.old_path) {
            *value = plan.new_path.clone();
        }
    }
    aliases.insert(path_key(&plan.old_path), plan.new_path.clone());
    aliases.insert(path_key(&plan.new_path), plan.new_path.clone());
    updates.insert(
        app_data.join(REDIRECT_FILE),
        serde_json::to_string_pretty(&aliases).map_err(|error| error.to_string())?,
    );
    let directory = app_data.join(TRANSACTION_DIR);
    fs::create_dir(&directory).map_err(|error| error.to_string())?;
    let prepare = (|| {
        let original = fs::read(&plan.old_path).map_err(|error| error.to_string())?;
        write_synced(&directory.join("image.before"), &original)?;
        let mut files = Vec::new();
        for (index, (path, after)) in updates.iter().enumerate() {
            let relative = path
                .strip_prefix(app_data)
                .map_err(|error| error.to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            checked_path(app_data, &relative)?;
            let existed = path.exists();
            if existed {
                write_synced(
                    &directory.join(format!("{index}.before")),
                    &fs::read(path).map_err(|error| error.to_string())?,
                )?;
            }
            write_synced(&directory.join(format!("{index}.after")), after.as_bytes())?;
            files.push(JournalFile {
                path: relative,
                existed,
            });
        }
        let journal = Journal {
            version: 1,
            committed: false,
            old_name: img_name.into(),
            new_name: plan.new_name.clone(),
            files,
        };
        write_journal(&directory, &journal)?;
        Ok::<_, String>(journal)
    })();
    let mut journal = match prepare {
        Ok(journal) => journal,
        Err(error) => {
            let _ = cleanup_transaction(app_data);
            return Err(error);
        }
    };
    let commit = (|| {
        step(0)?;
        super::atomic_file::move_no_replace(
            Path::new(&plan.old_path),
            &directory.join("image.moving"),
        )
        .map_err(|error| error.to_string())?;
        step(1)?;
        super::atomic_file::move_no_replace(
            &directory.join("image.moving"),
            Path::new(&plan.new_path),
        )
        .map_err(|error| error.to_string())?;
        for (index, (path, after)) in updates.iter().enumerate() {
            super::atomic_file::write_text_or_create(path, after)
                .map_err(|error| error.to_string())?;
            step(index + 2)?;
        }
        synchronize_settings()?;
        journal.committed = true;
        write_journal(&directory, &journal)?;
        Ok::<_, String>(())
    })();
    if let Err(error) = commit {
        return match recover(app_data).and_then(|_| synchronize_settings()) {
            Ok(()) => Err(error),
            Err(recovery) => Err(format!("{error}\nImage recovery is pending: {recovery}")),
        };
    }
    let _ = step(usize::MAX);
    // A committed manifest is retained if cleanup is temporarily blocked.
    if let Err(error) = cleanup_transaction(app_data) {
        eprintln!("Image transaction cleanup deferred: {error}");
    }
    Ok(ImageRenameResult {
        old_path: plan.old_path,
        new_path: plan.new_path,
        redirects: aliases,
    })
}

#[derive(Debug, Serialize)]
pub struct ImageRenamePlan {
    pub old_path: String,
    pub new_path: String,
    pub new_name: String,
    pub changes_required: bool,
    pub references: Vec<ImageReference>,
    pub scanned_files: usize,
    pub issues: Vec<ImageReferenceIssue>,
    // A disk scan cannot establish whether an open editor has an unsaved reference.
    pub requires_runtime_sync: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ImageReferenceKind {
    Background,
    StoryCover,
    ObjectImage,
    ActiveBackup,
    DeletedBackup,
}

#[derive(Debug, Serialize)]
pub struct ImageReference {
    pub kind: ImageReferenceKind,
    pub file_path: String,
    // JSON pointer; '#' separates a JSON document embedded in a backup string.
    pub pointer: String,
}

#[derive(Debug, Serialize)]
pub struct ImageReferenceIssue {
    pub file_path: String,
    pub message: String,
}

pub fn plan(app_data: &Path, img_name: &str, new_name: &str) -> Result<ImageRenamePlan, String> {
    validate_source_name(img_name)?;
    let new_name = new_name.trim();
    path_gate::validate_name(new_name)?;
    let user_dir = app_data.join("Image").join("user");
    let old = user_dir.join(img_name);
    let new = user_dir.join(new_name);
    if !is_supported_image_file(&old) {
        return Err("Unsupported source image format".into());
    }
    if old
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        != new
            .extension()
            .and_then(|value| value.to_str())
            .map(str::to_ascii_lowercase)
    {
        return Err("Renaming an image must preserve its file extension".into());
    }
    let metadata = fs::symlink_metadata(&old).map_err(|error| error.to_string())?;
    if !metadata.file_type().is_file() {
        return Err("Source must be a regular user image file".into());
    }
    match fs::symlink_metadata(&new) {
        Ok(metadata) => {
            if !metadata.file_type().is_file()
                || fs::canonicalize(&new).map_err(|error| error.to_string())?
                    != fs::canonicalize(&old).map_err(|error| error.to_string())?
            {
                return Err("An image with that name already exists".into());
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error.to_string()),
    }

    let mut result = ImageRenamePlan {
        old_path: old.to_string_lossy().into_owned(),
        new_path: new.to_string_lossy().into_owned(),
        new_name: new_name.into(),
        changes_required: old != new,
        references: Vec::new(),
        scanned_files: 0,
        issues: Vec::new(),
        requires_runtime_sync: true,
    };
    if !result.changes_required {
        return Ok(result);
    }
    scan_file(
        app_data,
        &app_data.join("settings.json"),
        Scope::Settings,
        &mut result,
    );
    for (directory, scope) in [
        ("TypeNap_Library", Scope::Library),
        ("Backup/Alive", Scope::ActiveBackup),
        ("Backup/Necropolis", Scope::DeletedBackup),
    ] {
        scan_directory(app_data, &app_data.join(directory), scope, &mut result);
    }
    result.references.sort_by(|a, b| {
        a.file_path
            .cmp(&b.file_path)
            .then(a.pointer.cmp(&b.pointer))
    });
    result.issues.sort_by(|a, b| a.file_path.cmp(&b.file_path));
    Ok(result)
}

fn validate_source_name(name: &str) -> Result<(), String> {
    // Imported filenames can be longer than the new-name limit. Still reject
    // paths, streams and Windows-special components rather than stripping them.
    if name.is_empty()
        || name == "."
        || name == ".."
        || name.ends_with([' ', '.'])
        || name.chars().any(|character| {
            character.is_control()
                || matches!(
                    character,
                    '/' | '\\' | ':' | '<' | '>' | '"' | '|' | '?' | '*'
                )
        })
    {
        return Err("Expected a user image file name, not a path".into());
    }
    Ok(())
}

#[derive(Clone, Copy)]
enum Scope {
    Settings,
    Library,
    ActiveBackup,
    DeletedBackup,
}

fn issue(result: &mut ImageRenamePlan, path: &Path, error: impl ToString) {
    result.issues.push(ImageReferenceIssue {
        file_path: path.to_string_lossy().into_owned(),
        message: error.to_string(),
    });
}

fn scan_directory(app_data: &Path, directory: &Path, scope: Scope, result: &mut ImageRenamePlan) {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
        Err(error) => {
            issue(result, directory, error);
            return;
        }
    };
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                issue(result, directory, error);
                continue;
            }
        };
        let path = entry.path();
        match entry.file_type() {
            Ok(kind) if kind.is_symlink() => issue(result, &path, "Symbolic links are not scanned"),
            Ok(kind) if kind.is_dir() => scan_directory(app_data, &path, scope, result),
            Ok(kind) if kind.is_file() => {
                let name = path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or_default();
                let json = path.extension().and_then(|value| value.to_str()) == Some("json");
                if json
                    && (name == "story_metadata.json"
                        || matches!(scope, Scope::ActiveBackup | Scope::DeletedBackup)
                        || ["character_", "world_", "entity_"]
                            .iter()
                            .any(|prefix| name.starts_with(prefix)))
                {
                    scan_file(app_data, &path, scope, result);
                }
            }
            Ok(_) => {}
            Err(error) => issue(result, &path, error),
        }
    }
}

fn scan_file(app_data: &Path, path: &Path, scope: Scope, result: &mut ImageRenamePlan) {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
        Err(error) => {
            issue(result, path, error);
            return;
        }
    };
    result.scanned_files += 1;
    let value: Value = match serde_json::from_slice(&bytes) {
        Ok(value) => value,
        Err(error) => {
            issue(result, path, error);
            return;
        }
    };
    let mut pointers = Vec::new();
    if matches!(scope, Scope::Settings) {
        if value
            .pointer("/bgimage/path")
            .and_then(Value::as_str)
            .is_some_and(|value| refers_to(app_data, value, &result.old_path))
        {
            pointers.push("/bgimage/path".into());
        }
    } else {
        image_pointers(app_data, &value, &result.old_path, "", &mut pointers);
        if matches!(scope, Scope::ActiveBackup | Scope::DeletedBackup) {
            backup_pointers(app_data, path, &value, result, &mut pointers);
        }
    }
    for pointer in pointers {
        let kind = match scope {
            Scope::Settings => ImageReferenceKind::Background,
            Scope::Library if pointer == "/cover" => ImageReferenceKind::StoryCover,
            Scope::Library => ImageReferenceKind::ObjectImage,
            Scope::ActiveBackup => ImageReferenceKind::ActiveBackup,
            Scope::DeletedBackup => ImageReferenceKind::DeletedBackup,
        };
        result.references.push(ImageReference {
            kind,
            file_path: path.to_string_lossy().into_owned(),
            pointer,
        });
    }
}

fn refers_to(app_data: &Path, value: &str, old_path: &str) -> bool {
    let legacy = app_data
        .join("BgImage/user")
        .join(Path::new(old_path).file_name().unwrap_or_default());
    let normalize = |path: &str| path.replace('\\', "/").to_lowercase();
    normalize(value) == normalize(old_path)
        || normalize(value) == normalize(&legacy.to_string_lossy())
}

fn image_pointers(
    app_data: &Path,
    value: &Value,
    old_path: &str,
    prefix: &str,
    pointers: &mut Vec<String>,
) {
    if value
        .get("cover")
        .and_then(Value::as_str)
        .is_some_and(|value| refers_to(app_data, value, old_path))
    {
        pointers.push(format!("{prefix}/cover"));
    }
    if let Some(images) = value.get("imagePaths").and_then(Value::as_array) {
        array_pointers(
            app_data,
            images,
            old_path,
            &format!("{prefix}/imagePaths"),
            pointers,
        );
    }
}

fn array_pointers(
    app_data: &Path,
    images: &[Value],
    old_path: &str,
    prefix: &str,
    pointers: &mut Vec<String>,
) {
    for (index, image) in images.iter().enumerate() {
        if image
            .as_str()
            .is_some_and(|value| refers_to(app_data, value, old_path))
        {
            pointers.push(format!("{prefix}/{index}"));
        }
    }
}

fn backup_pointers(
    app_data: &Path,
    path: &Path,
    value: &Value,
    result: &mut ImageRenamePlan,
    pointers: &mut Vec<String>,
) {
    let name = value
        .get("file_name")
        .and_then(Value::as_str)
        .or_else(|| path.file_stem().and_then(|name| name.to_str()))
        .unwrap_or_default();
    if !["character_", "world_", "entity_"]
        .iter()
        .any(|prefix| name.starts_with(prefix))
    {
        return;
    }
    // Legacy backups used `files` for the generation array.
    let key = if value.get("backups").is_some() {
        "backups"
    } else {
        "files"
    };
    let Some(generations) = value.get(key).and_then(Value::as_array) else {
        return;
    };
    for (index, generation) in generations.iter().enumerate() {
        let prefix = format!("/{key}/{index}");
        if let Some(base) = generation.get("base_content").and_then(Value::as_str) {
            match serde_json::from_str::<Value>(base) {
                Ok(base) => image_pointers(
                    app_data,
                    &base,
                    &result.old_path,
                    &format!("{prefix}/base_content#"),
                    pointers,
                ),
                Err(error) => {
                    let json_document =
                        value
                            .get("file_name")
                            .and_then(Value::as_str)
                            .is_some_and(|name| {
                                ["character_", "world_", "entity_"]
                                    .iter()
                                    .any(|prefix| name.starts_with(prefix))
                            });
                    if json_document {
                        issue(
                            result,
                            path,
                            format!("Invalid JSON backup baseline: {error}"),
                        );
                    }
                }
            }
        }
        let Some(increments) = generation
            .get("incremental_content")
            .and_then(Value::as_array)
        else {
            continue;
        };
        for (increment_index, increment) in increments.iter().enumerate() {
            let Some(patches) = increment.get("json_patch").and_then(Value::as_array) else {
                continue;
            };
            for (patch_index, patch) in patches.iter().enumerate() {
                let location = format!(
                    "{prefix}/incremental_content/{increment_index}/json_patch/{patch_index}/value"
                );
                let Some(patch_value) = patch.get("value") else {
                    continue;
                };
                match patch.get("path").and_then(Value::as_str) {
                    Some("") => {
                        image_pointers(app_data, patch_value, &result.old_path, &location, pointers)
                    }
                    Some("/imagePaths") => {
                        if let Some(images) = patch_value.as_array() {
                            array_pointers(app_data, images, &result.old_path, &location, pointers);
                        }
                    }
                    Some(target) if target == "/cover" || target.starts_with("/imagePaths/") => {
                        if patch_value
                            .as_str()
                            .is_some_and(|value| refers_to(app_data, value, &result.old_path))
                        {
                            pointers.push(location);
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("typenap-image-rename-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(root.join("Image/user")).unwrap();
            fs::write(root.join("Image/user/photo.png"), b"original image").unwrap();
            Self(root)
        }
        fn write(&self, path: &str, value: Value) {
            let path = self.0.join(path);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, serde_json::to_vec(&value).unwrap()).unwrap();
        }
        fn image(&self) -> String {
            self.0
                .join("Image/user/photo.png")
                .to_string_lossy()
                .into_owned()
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            assert_eq!(self.0.parent(), Some(std::env::temp_dir().as_path()));
            fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn finds_background_covers_and_all_object_types_without_writing_any_files() {
        let fixture = Fixture::new();
        let image = fixture.image();
        fixture.write(
            "settings.json",
            serde_json::json!({"bgimage":{"path":image}, "other": image}),
        );
        fixture.write(
            "TypeNap_Library/Story/story_metadata.json",
            serde_json::json!({"cover":image, "synopsis":image}),
        );
        for kind in ["character", "world", "entity"] {
            fixture.write(
                &format!(
                    "TypeNap_Library/Story/{kind}_Object_{}.json",
                    uuid::Uuid::new_v4()
                ),
                serde_json::json!({"imagePaths":[image], "notes":image}),
            );
        }
        let before = fs::read(fixture.0.join("settings.json")).unwrap();
        let result = plan(&fixture.0, "photo.png", "新しい画像.png").unwrap();
        assert_eq!(result.references.len(), 5);
        assert_eq!(result.scanned_files, 5);
        assert!(result.issues.is_empty());
        assert!(result.requires_runtime_sync);
        assert_eq!(fs::read(fixture.0.join("settings.json")).unwrap(), before);
        assert_eq!(
            fs::read(fixture.0.join("Image/user/photo.png")).unwrap(),
            b"original image"
        );
        assert!(!Path::new(&result.new_path).exists());
        assert!(result
            .references
            .iter()
            .all(|reference| !reference.pointer.contains("notes")
                && !reference.pointer.contains("synopsis")));
    }

    #[test]
    fn detects_backup_baselines_patch_values_and_deleted_snapshots() {
        let fixture = Fixture::new();
        let image = fixture.image();
        fixture.write(
            "Backup/Alive/Story/character_Person_id.json",
            serde_json::json!({
                "file_name":"character_Person_id", "backups":[{
                    "base_content": serde_json::json!({"imagePaths":[image]}).to_string(),
                    "incremental_content":[{"json_patch":[
                        {"op":"add", "path":"/imagePaths/0", "value":image},
                        {"op":"replace", "path":"/imagePaths", "value":[image]},
                        {"op":"replace", "path":"", "value":{"imagePaths":[image]}},
                        {"op":"replace", "path":"/notes", "value":image}
                    ]}]
                }]
            }),
        );
        fixture.write(
            "Backup/Necropolis/Story_123/world_Land_id.json",
            serde_json::json!({"imagePaths":[image]}),
        );
        let result = plan(&fixture.0, "photo.png", "renamed.png").unwrap();
        assert_eq!(result.references.len(), 5);
        assert!(result
            .references
            .iter()
            .any(|reference| reference.pointer.contains("base_content#")));
        assert_eq!(
            result
                .references
                .iter()
                .filter(|reference| matches!(reference.kind, ImageReferenceKind::DeletedBackup))
                .count(),
            1
        );
        assert!(result.issues.is_empty());
        for reference in result
            .references
            .iter()
            .filter(|reference| !reference.pointer.contains('#'))
        {
            let stored: Value =
                serde_json::from_slice(&fs::read(&reference.file_path).unwrap()).unwrap();
            assert_eq!(
                stored.pointer(&reference.pointer).and_then(Value::as_str),
                Some(image.as_str())
            );
        }
    }

    #[test]
    fn recognizes_legacy_slashes_and_case_but_not_other_images_or_free_text() {
        let fixture = Fixture::new();
        let legacy = fixture
            .0
            .join("BgImage/user/photo.png")
            .to_string_lossy()
            .replace('\\', "/")
            .to_uppercase();
        fixture.write("TypeNap_Library/Story/character_Person_id.json", serde_json::json!({
            "imagePaths":[legacy, fixture.0.join("Image/presets/photo.png"), "https://example.com/photo.png"],
            "notes":fixture.image()
        }));
        assert_eq!(
            plan(&fixture.0, "photo.png", "renamed.png")
                .unwrap()
                .references
                .len(),
            1
        );
    }

    #[test]
    fn validates_names_extensions_collisions_and_user_collection_boundaries() {
        let fixture = Fixture::new();
        fs::write(fixture.0.join("Image/user/existing.png"), b"another image").unwrap();
        for name in [
            "",
            "../escape.png",
            "dir/escape.png",
            "C:\\escape.png",
            "CON.png",
            "bad?.png",
            "photo.jpg",
            "new",
        ] {
            assert!(
                plan(&fixture.0, "photo.png", name).is_err(),
                "accepted {name}"
            );
        }
        for name in [
            "../photo.png",
            "..\\photo.png",
            "C:\\photo.png",
            "missing.png",
        ] {
            assert!(plan(&fixture.0, name, "renamed.png").is_err());
        }
        assert!(plan(&fixture.0, "photo.png", "existing.png").is_err());
        assert!(
            !plan(&fixture.0, "photo.png", "photo.png")
                .unwrap()
                .changes_required
        );
        assert!(plan(&fixture.0, "photo.png", "Photo.PNG").is_ok());
    }

    #[test]
    fn reports_unreadable_json_instead_of_claiming_no_dependencies() {
        let fixture = Fixture::new();
        fs::write(fixture.0.join("settings.json"), "broken JSON").unwrap();
        let result = plan(&fixture.0, "photo.png", "renamed.png").unwrap();
        assert_eq!(result.issues.len(), 1);
        assert!(result.issues[0].file_path.ends_with("settings.json"));
    }

    fn reference_fixture() -> Fixture {
        let fixture = Fixture::new();
        let image = fixture.image();
        fixture.write(
            "settings.json",
            serde_json::json!({"theme":"dark", "bgimage":{"path":image,"opacity":0.5}}),
        );
        fixture.write(
            "TypeNap_Library/Story/story_metadata.json",
            serde_json::json!({"cover":image,"files":["Chapter"],"synopsis":"unchanged"}),
        );
        for kind in ["character", "world", "entity"] {
            fixture.write(
                &format!("TypeNap_Library/Story/{kind}_Object_id.json"),
                serde_json::json!({"imagePaths":[image],"notes":image}),
            );
        }
        fixture.write(
            "Backup/Necropolis/Story_123/entity_Object_id.json",
            serde_json::json!({"imagePaths":[image],"notes":"retired"}),
        );
        let base = serde_json::json!({"imagePaths":[image],"notes":"old"});
        let next = serde_json::json!({"imagePaths":[image],"notes":"new"});
        let delta =
            super::super::json_backup_manager::diff(base.to_string(), next.to_string()).unwrap();
        fixture.write("Backup/Alive/Story/character_Object_id.json", serde_json::json!({
            "story_name":"Story", "file_name":"character_Object_id", "extra":"preserved",
            "backups":[{"base_content":base.to_string(),"incremental_content":[{"timestamp":123,"json_patch":serde_json::to_value(delta).unwrap()["json_patch"]}]}]
        }));
        fixture
    }

    #[test]
    fn execution_updates_every_persisted_reference_and_replays_all_history() {
        let fixture = reference_fixture();
        let old = fixture.image();
        let result = execute(&fixture.0, "photo.png", "renamed.png", || Ok(())).unwrap();
        assert!(!Path::new(&old).exists());
        assert_eq!(fs::read(&result.new_path).unwrap(), b"original image");
        assert!(!fixture.0.join(TRANSACTION_DIR).exists());
        assert!(
            plan(&fixture.0, "renamed.png", "next.png")
                .unwrap()
                .references
                .len()
                >= 7
        );
        let settings: Value =
            serde_json::from_slice(&fs::read(fixture.0.join("settings.json")).unwrap()).unwrap();
        assert_eq!(settings["bgimage"]["path"], result.new_path);
        assert_eq!(settings["bgimage"]["opacity"], 0.5);
        let path = fixture
            .0
            .join("TypeNap_Library/Story/character_Object_id.json");
        let content: Value = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
        assert_eq!(content["imagePaths"][0], result.new_path);
        assert_eq!(content["notes"], old, "free text must stay unchanged");
        let mut stale = serde_json::json!({"imagePaths":[old],"draft":"keep me"});
        normalize_object_references(&fixture.0, &mut stale).unwrap();
        assert_eq!(stale["imagePaths"][0], result.new_path);
        assert_eq!(stale["draft"], "keep me");
        let history: Value = serde_json::from_slice(
            &fs::read(
                fixture
                    .0
                    .join("Backup/Alive/Story/character_Object_id.json"),
            )
            .unwrap(),
        )
        .unwrap();
        assert_eq!(history["extra"], "preserved");
        let mut revision = history["backups"][0]["base_content"]
            .as_str()
            .unwrap()
            .to_string();
        let delta = serde_json::from_value(history["backups"][0]["incremental_content"][0].clone())
            .unwrap();
        super::super::json_backup_manager::apply(&mut revision, &delta).unwrap();
        let revision: Value = serde_json::from_str(&revision).unwrap();
        assert_eq!(revision["imagePaths"][0], result.new_path);
        assert_eq!(revision["notes"], "new");
    }

    #[test]
    fn errors_at_every_write_boundary_restore_original_bytes_and_file_name() {
        for failure in 0..10 {
            let fixture = reference_fixture();
            let files = plan(&fixture.0, "photo.png", "renamed.png")
                .unwrap()
                .references
                .into_iter()
                .map(|reference| reference.file_path)
                .collect::<std::collections::BTreeSet<_>>();
            let originals: Vec<_> = files
                .iter()
                .map(|file| (file.clone(), fs::read(file).unwrap()))
                .collect();
            let result = execute_with_hook(
                &fixture.0,
                "photo.png",
                "renamed.png",
                || Ok(()),
                |step| {
                    if step == failure {
                        Err("injected failure".into())
                    } else {
                        Ok(())
                    }
                },
            );
            assert!(
                result.is_err(),
                "failure boundary {failure} was not exercised"
            );
            assert_eq!(fs::read(fixture.image()).unwrap(), b"original image");
            assert!(!fixture.0.join("Image/user/renamed.png").exists());
            assert!(!fixture.0.join(REDIRECT_FILE).exists());
            assert!(!fixture.0.join(TRANSACTION_DIR).exists());
            for (file, before) in originals {
                assert_eq!(fs::read(file).unwrap(), before);
            }
        }
    }

    #[test]
    fn interrupted_operations_recover_at_next_start_and_committed_ones_stay_committed() {
        for boundary in [1, 3, usize::MAX] {
            let fixture = reference_fixture();
            let interrupted = std::panic::catch_unwind(|| {
                let _ = execute_with_hook(
                    &fixture.0,
                    "photo.png",
                    "renamed.png",
                    || Ok(()),
                    |step| {
                        if step == boundary {
                            panic!("simulated termination");
                        }
                        Ok(())
                    },
                );
            });
            assert!(interrupted.is_err());
            assert!(fixture.0.join(TRANSACTION_DIR).exists());
            recover(&fixture.0).unwrap();
            recover(&fixture.0).unwrap();
            assert_eq!(
                fixture.0.join("Image/user/renamed.png").exists(),
                boundary == usize::MAX
            );
            assert_eq!(Path::new(&fixture.image()).exists(), boundary != usize::MAX);
            assert!(!fixture.0.join(TRANSACTION_DIR).exists());
        }
    }

    #[test]
    fn chained_case_only_and_back_to_original_renames_keep_stale_paths_usable() {
        let fixture = reference_fixture();
        let original = fixture.image();
        execute(&fixture.0, "photo.png", "Second.png", || Ok(())).unwrap();
        let result = execute(&fixture.0, "Second.png", "SECOND.PNG", || Ok(())).unwrap();
        assert_eq!(
            resolve_reference(&fixture.0, &original).unwrap(),
            result.new_path
        );
        let back = execute(&fixture.0, "SECOND.PNG", "photo.png", || Ok(())).unwrap();
        assert_eq!(path_key(&back.new_path), path_key(&original));
        assert_eq!(
            path_key(&resolve_reference(&fixture.0, &result.new_path).unwrap()),
            path_key(&original)
        );
    }

    #[test]
    fn a_reserved_old_name_cannot_be_taken_by_a_different_image() {
        let fixture = reference_fixture();
        execute(&fixture.0, "photo.png", "renamed.png", || Ok(())).unwrap();
        fs::write(fixture.0.join("Image/user/other.png"), b"other").unwrap();
        assert!(execute(&fixture.0, "other.png", "photo.png", || Ok(())).is_err());
        assert_eq!(
            fs::read(fixture.0.join("Image/user/other.png")).unwrap(),
            b"other"
        );
    }

    #[test]
    fn destination_created_after_preflight_is_preserved_on_failure() {
        let fixture = reference_fixture();
        let target = fixture.0.join("Image/user/renamed.png");
        let result = execute_with_hook(
            &fixture.0,
            "photo.png",
            "renamed.png",
            || Ok(()),
            |step| {
                if step == 0 {
                    fs::write(&target, b"racing image").unwrap();
                }
                Ok(())
            },
        );
        assert!(result.is_err());
        assert_eq!(fs::read(target).unwrap(), b"racing image");
        assert_eq!(fs::read(fixture.image()).unwrap(), b"original image");
        assert!(!fixture.0.join(TRANSACTION_DIR).exists());
    }

    #[test]
    fn cache_sync_failure_rolls_back_and_redirects_cannot_escape_the_user_directory() {
        let fixture = reference_fixture();
        let attempts = std::cell::Cell::new(0);
        assert!(execute(&fixture.0, "photo.png", "renamed.png", || {
            attempts.set(attempts.get() + 1);
            if attempts.get() == 1 {
                Err("cache failed".into())
            } else {
                Ok(())
            }
        })
        .is_err());
        assert_eq!(attempts.get(), 2);
        assert!(Path::new(&fixture.image()).exists());
        fixture.write(REDIRECT_FILE, serde_json::json!({ (fixture.image().replace('\\', "/").to_lowercase()): "C:/outside/private.png" }));
        assert!(redirects(&fixture.0).is_err());
    }
}
