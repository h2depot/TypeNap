use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::path::BaseDirectory;
use tauri::Manager;

#[derive(Serialize)]
pub struct ImageInfo {
    name: String,
    kind: String,
    path: String,
    created_at: Option<u64>,
    last_update: Option<u64>,
}

pub fn get_image_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(app_data_dir.join("Image"))
}

pub fn init_images(app: &tauri::AppHandle) -> Result<(), String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    migrate_image_directory(&app_data)?;
    super::image_rename::recover(&app_data)?;
    super::image_rename::redirects(&app_data)?;
    let image_path = get_image_path(app)?;
    let preset_dir = image_path.join("presets");
    let user_dir = image_path.join("user");

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

// Return the actual saved path, including any suffix needed for a name collision.
#[tauri::command]
pub fn add_user_image(app: tauri::AppHandle, img_path: PathBuf) -> Result<ImageInfo, String> {
    let _guard = super::backup_manager::CONTENT_WRITE_LOCK
        .lock()
        .map_err(|error| error.to_string())?;
    super::image_rename::recover(
        &app.path()
            .app_data_dir()
            .map_err(|error| error.to_string())?,
    )?;
    import_user_image(&get_image_path(&app)?.join("user"), &img_path)
}

fn import_user_image(user_dir: &Path, img_path: &Path) -> Result<ImageInfo, String> {
    if !img_path.is_file() {
        return Err("Image file not found".into());
    }
    if !is_supported_image_file(img_path) {
        return Err("Unsupported image format (PNG, JPEG or WebP required)".into());
    }
    let img_name = img_path.file_name().ok_or("Image file name not found")?;
    let mut new_path = user_dir.join(img_name);
    fs::create_dir_all(user_dir).map_err(|e| e.to_string())?;
    let reserved = user_dir
        .parent()
        .and_then(Path::parent)
        .map(|root| super::image_rename::import_name_reserved(root, &new_path))
        .transpose()?
        .unwrap_or(false);
    if !reserved
        && new_path.exists()
        && fs::read(img_path).map_err(|e| e.to_string())?
            == fs::read(&new_path).map_err(|e| e.to_string())?
    {
        return Ok(user_image_info(&new_path));
    }
    if reserved || new_path.exists() {
        let stem = img_path.file_stem().unwrap_or_default().to_string_lossy();
        let extension = img_path.extension().unwrap_or_default().to_string_lossy();
        new_path = user_dir.join(format!("{stem}_{}.{extension}", uuid::Uuid::new_v4()));
    }
    // create_new also prevents concurrent imports from overwriting a file.
    let mut source = fs::File::open(img_path).map_err(|e| e.to_string())?;
    let mut target = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&new_path)
        .map_err(|e| e.to_string())?;
    if let Err(error) = std::io::copy(&mut source, &mut target).and_then(|_| target.sync_all()) {
        drop(target);
        let _ = fs::remove_file(&new_path);
        return Err(error.to_string());
    }
    Ok(user_image_info(&new_path))
}

fn user_image_info(path: &Path) -> ImageInfo {
    image_info(path, "user")
}

fn image_info(path: &Path, kind: &str) -> ImageInfo {
    let metadata = path.metadata().ok();
    let timestamp = |time: std::io::Result<SystemTime>| {
        time.ok()?
            .duration_since(UNIX_EPOCH)
            .ok()
            .map(|value| value.as_secs())
    };
    ImageInfo {
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        kind: kind.into(),
        path: path.to_string_lossy().into_owned(),
        created_at: metadata
            .as_ref()
            .and_then(|value| timestamp(value.created())),
        last_update: metadata
            .as_ref()
            .and_then(|value| timestamp(value.modified())),
    }
}

// Deletes an image from the user shared collection.
#[tauri::command]
pub fn delete_user_image(app: tauri::AppHandle, img_name: &str) -> Result<(), String> {
    let _guard = super::backup_manager::CONTENT_WRITE_LOCK
        .lock()
        .map_err(|error| error.to_string())?;
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    super::image_rename::recover(&app_data)?;
    let img_name = Path::new(img_name)
        .file_name()
        .ok_or_else(|| "Image file name not found".to_string())?;
    let user_dir = get_image_path(&app)?.join("user");
    let target_path = PathBuf::from(super::image_rename::resolve_reference(
        &app_data,
        &user_dir.join(img_name).to_string_lossy(),
    )?);
    if target_path.is_file() {
        fs::remove_file(target_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Read-only preflight. The actual rename must be committed together with all
// reference updates; this command deliberately does not move or rewrite files.
#[tauri::command]
pub async fn plan_user_image_rename(
    app: tauri::AppHandle,
    img_name: String,
    new_name: String,
) -> Result<super::image_rename::ImageRenamePlan, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = super::backup_manager::CONTENT_WRITE_LOCK
            .lock()
            .map_err(|error| error.to_string())?;
        super::image_rename::plan(&app_data, &img_name, &new_name)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn rename_user_image(
    app: tauri::AppHandle,
    img_name: String,
    new_name: String,
) -> Result<super::image_rename::ImageRenameResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use tauri_plugin_store::StoreExt;
        let _guard = super::backup_manager::CONTENT_WRITE_LOCK
            .lock()
            .map_err(|error| error.to_string())?;
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?;
        super::image_rename::recover(&app_data)
            .map_err(|error| format!("Image recovery is pending: {error}"))?;
        let settings = app
            .store("settings.json")
            .map_err(|error| error.to_string())?;
        settings
            .reload_ignore_defaults()
            .map_err(|error| error.to_string())?;
        super::image_rename::execute(&app_data, &img_name, &new_name, || {
            settings
                .reload_ignore_defaults()
                .map_err(|error| error.to_string())
        })
    })
    .await
    .map_err(|error| format!("Image recovery is pending: {error}"))?
}

#[tauri::command]
pub fn get_image_renames(app: tauri::AppHandle) -> Result<super::image_rename::Redirects, String> {
    super::image_rename::redirects(
        &app.path()
            .app_data_dir()
            .map_err(|error| error.to_string())?,
    )
}

// Returns all preset and user images.
#[tauri::command]
pub async fn get_whole_image_list(app: tauri::AppHandle) -> Result<Vec<ImageInfo>, String> {
    let image_path = get_image_path(&app)?;
    let mut image_list = Vec::new();

    collect_image_list(&image_path.join("presets"), "preset", &mut image_list)?;
    collect_image_list(&image_path.join("user"), "user", &mut image_list)?;

    image_list.sort_by(|a, b| a.kind.cmp(&b.kind).then_with(|| a.name.cmp(&b.name)));

    Ok(image_list)
}

fn collect_image_list(
    dir_path: &Path,
    kind: &str,
    image_list: &mut Vec<ImageInfo>,
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

        image_list.push(image_info(&path, kind));
    }

    Ok(())
}

pub fn is_supported_image_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "png" | "jpg" | "jpeg" | "webp"
            )
        })
}

// Moves the existing collection without overwriting either side on a collision.
fn migrate_image_directory(app_data: &Path) -> Result<(), String> {
    let legacy = app_data.join("BgImage");
    let destination = app_data.join("Image");
    if !legacy.exists() {
        return Ok(());
    }
    if !destination.exists() {
        return fs::rename(legacy, destination).map_err(|e| e.to_string());
    }
    for kind in ["presets", "user"] {
        let source = legacy.join(kind);
        if !source.exists() {
            continue;
        }
        let target = destination.join(kind);
        fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(&source).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let from = entry.path();
            let to = target.join(entry.file_name());
            if !entry.file_type().map_err(|e| e.to_string())?.is_file() {
                return Err(format!(
                    "Unexpected image directory entry: {}",
                    from.display()
                ));
            }
            if !to.exists() {
                fs::rename(from, to).map_err(|e| e.to_string())?;
            } else if fs::read(&from).map_err(|e| e.to_string())?
                == fs::read(&to).map_err(|e| e.to_string())?
            {
                fs::remove_file(from).map_err(|e| e.to_string())?;
            } else {
                return Err(format!(
                    "Image migration found different files named {}",
                    to.display()
                ));
            }
        }
        fs::remove_dir(source).map_err(|e| e.to_string())?;
    }
    fs::remove_dir(legacy).map_err(|e| e.to_string())
}

pub fn migrated_image_path(app_data: &Path, value: &str) -> String {
    Path::new(value)
        .strip_prefix(app_data.join("BgImage"))
        .map(|relative| {
            app_data
                .join("Image")
                .join(relative)
                .to_string_lossy()
                .into_owned()
        })
        .unwrap_or_else(|_| value.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("typenap-images-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&root).unwrap();
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
    fn migrates_existing_collection_and_old_references_idempotently() {
        let fixture = Fixture::new();
        let legacy = fixture.0.join("BgImage/user");
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join("portrait.png"), b"portrait").unwrap();
        migrate_image_directory(&fixture.0).unwrap();
        migrate_image_directory(&fixture.0).unwrap();
        assert!(!fixture.0.join("BgImage").exists());
        let target = fixture.0.join("Image").join("user").join("portrait.png");
        assert_eq!(fs::read(&target).unwrap(), b"portrait");
        assert_eq!(
            migrated_image_path(&fixture.0, &legacy.join("portrait.png").to_string_lossy()),
            target.to_string_lossy()
        );
        assert_eq!(migrated_image_path(&fixture.0, "#123456"), "#123456");
    }

    #[test]
    fn migration_merges_matching_files_but_preserves_different_collisions() {
        let fixture = Fixture::new();
        let legacy = fixture.0.join("BgImage/user");
        let target = fixture.0.join("Image/user");
        fs::create_dir_all(&legacy).unwrap();
        fs::create_dir_all(&target).unwrap();
        fs::write(legacy.join("same.png"), b"same").unwrap();
        fs::write(target.join("same.png"), b"same").unwrap();
        migrate_image_directory(&fixture.0).unwrap();
        assert_eq!(fs::read(target.join("same.png")).unwrap(), b"same");
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join("same.png"), b"different").unwrap();
        assert!(migrate_image_directory(&fixture.0).is_err());
        assert_eq!(fs::read(legacy.join("same.png")).unwrap(), b"different");
        assert_eq!(fs::read(target.join("same.png")).unwrap(), b"same");
    }

    #[test]
    fn imports_same_name_images_without_replacing_another_object_image() {
        let fixture = Fixture::new();
        let target = fixture.0.join("Image/user");
        let source = fixture.0.join("portrait.WEBP");
        fs::write(&source, b"first").unwrap();
        let first = import_user_image(&target, &source).unwrap();
        assert_eq!(
            import_user_image(&target, &source).unwrap().path,
            first.path
        );
        fs::write(&source, b"second").unwrap();
        let second = import_user_image(&target, &source).unwrap();
        assert_ne!(first.path, second.path);
        assert_eq!(fs::read(first.path).unwrap(), b"first");
        assert_eq!(fs::read(second.path).unwrap(), b"second");
        let unsupported = fixture.0.join("text.txt");
        fs::write(&unsupported, b"text").unwrap();
        assert!(import_user_image(&target, &unsupported).is_err());
    }

    #[test]
    fn image_list_includes_filesystem_dates_for_gallery_sorting() {
        let fixture = Fixture::new();
        let image = fixture.0.join("landscape.png");
        fs::write(&image, b"image").unwrap();
        fs::write(fixture.0.join("notes.txt"), b"not an image").unwrap();
        let modified = UNIX_EPOCH + std::time::Duration::from_secs(1_700_000_000);
        fs::File::options()
            .write(true)
            .open(&image)
            .unwrap()
            .set_times(fs::FileTimes::new().set_modified(modified))
            .unwrap();

        let mut images = Vec::new();
        collect_image_list(&fixture.0, "preset", &mut images).unwrap();
        assert_eq!(images.len(), 1);
        assert_eq!(images[0].kind, "preset");
        assert_eq!(images[0].last_update, Some(1_700_000_000));
        let serialized = serde_json::to_value(&images[0]).unwrap();
        assert!(serialized.get("created_at").is_some());
        assert_eq!(serialized["last_update"], 1_700_000_000u64);
        assert_eq!(user_image_info(&image).last_update, images[0].last_update);
    }

    #[test]
    fn importing_a_renamed_image_old_filename_cannot_repurpose_its_stale_references() {
        let fixture = Fixture::new();
        let source_dir = fixture.0.join("source");
        fs::create_dir_all(&source_dir).unwrap();
        let source = source_dir.join("photo.png");
        fs::write(&source, b"original").unwrap();
        let target = fixture.0.join("Image/user");
        let original = import_user_image(&target, &source).unwrap();
        let renamed =
            super::super::image_rename::execute(&fixture.0, "photo.png", "renamed.png", || Ok(()))
                .unwrap();
        fs::write(&source, b"different").unwrap();
        let imported = import_user_image(&target, &source).unwrap();
        assert_ne!(imported.name, "photo.png");
        assert_eq!(fs::read(imported.path).unwrap(), b"different");
        assert_eq!(fs::read(&renamed.new_path).unwrap(), b"original");
        assert_eq!(
            super::super::image_rename::resolve_reference(&fixture.0, &original.path).unwrap(),
            renamed.new_path
        );
        fs::remove_file(&renamed.new_path).unwrap();
        let same_current_name = source_dir.join("renamed.png");
        fs::write(&same_current_name, b"third image").unwrap();
        let imported = import_user_image(&target, &same_current_name).unwrap();
        assert_ne!(
            imported.name, "renamed.png",
            "deleted image references must not point at a different image"
        );
    }
}
