use std::path::{Path, PathBuf};

const MAX_NAME_UTF16_LEN: usize = 100;
const RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

pub fn validate_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Name must not be empty".to_string());
    }
    if name.encode_utf16().count() > MAX_NAME_UTF16_LEN {
        return Err(format!(
            "Name must be at most {MAX_NAME_UTF16_LEN} UTF-16 characters"
        ));
    }
    if name == "." || name == ".." {
        return Err("Relative path components are not allowed".to_string());
    }
    if name.ends_with(' ') || name.ends_with('.') {
        return Err("A Windows file name cannot end with a space or period".to_string());
    }
    if name.chars().any(|character| {
        character.is_control()
            || matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            )
    }) {
        return Err("Name contains characters that are invalid in a Windows file name".to_string());
    }

    let device_name = name.split('.').next().unwrap_or(name).to_ascii_uppercase();
    if RESERVED_NAMES.contains(&device_name.as_str()) {
        return Err("A reserved Windows device name cannot be used".to_string());
    }

    Ok(())
}

pub fn story_dir(root: &Path, story_name: &str) -> Result<PathBuf, String> {
    validate_name(story_name)?;
    Ok(root.join(story_name))
}

pub fn story_metadata(root: &Path, story_name: &str) -> Result<PathBuf, String> {
    Ok(story_dir(root, story_name)?.join("story_metadata.json"))
}

pub fn text_file(root: &Path, story_name: &str, title: &str) -> Result<PathBuf, String> {
    validate_name(title)?;
    Ok(story_dir(root, story_name)?.join(format!("{title}.txt")))
}

pub fn text_backup(root: &Path, story_name: &str, title: &str) -> Result<PathBuf, String> {
    validate_name(title)?;
    Ok(story_dir(root, story_name)?.join(format!("{title}_backup.json")))
}
