use std::ffi::OsStr;
use std::fmt;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use windows_sys::Win32::Storage::FileSystem::ReplaceFileW;

static TEMP_FILE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AtomicWriteStage {
    InvalidDestination,
    CreateTemporary,
    WriteTemporary,
    SyncTemporary,
    ReplaceDestination,
}

#[derive(Debug)]
pub enum AtomicWriteError {
    InvalidDestination,
    CreateTemporary { path: PathBuf, source: io::Error },
    WriteTemporary { path: PathBuf, source: io::Error },
    SyncTemporary { path: PathBuf, source: io::Error },
    ReplaceDestination { path: PathBuf, source: io::Error },
}

impl AtomicWriteError {
    pub fn stage(&self) -> AtomicWriteStage {
        match self {
            Self::InvalidDestination => AtomicWriteStage::InvalidDestination,
            Self::CreateTemporary { .. } => AtomicWriteStage::CreateTemporary,
            Self::WriteTemporary { .. } => AtomicWriteStage::WriteTemporary,
            Self::SyncTemporary { .. } => AtomicWriteStage::SyncTemporary,
            Self::ReplaceDestination { .. } => AtomicWriteStage::ReplaceDestination,
        }
    }
}

impl fmt::Display for AtomicWriteError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidDestination => write!(formatter, "destination file name was not found"),
            Self::CreateTemporary { path, source } => {
                write!(
                    formatter,
                    "failed to create temporary file {}: {source}",
                    path.display()
                )
            }
            Self::WriteTemporary { path, source } => {
                write!(
                    formatter,
                    "failed to write temporary file {}: {source}",
                    path.display()
                )
            }
            Self::SyncTemporary { path, source } => {
                write!(
                    formatter,
                    "failed to sync temporary file {}: {source}",
                    path.display()
                )
            }
            Self::ReplaceDestination { path, source } => {
                write!(
                    formatter,
                    "failed to replace destination file {}: {source}",
                    path.display()
                )
            }
        }
    }
}

impl std::error::Error for AtomicWriteError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::InvalidDestination => None,
            Self::CreateTemporary { source, .. }
            | Self::WriteTemporary { source, .. }
            | Self::SyncTemporary { source, .. }
            | Self::ReplaceDestination { source, .. } => Some(source),
        }
    }
}

pub fn write_text(destination: &Path, content: &str) -> Result<(), AtomicWriteError> {
    let temporary_path = temporary_path(destination)?;
    let result = write_and_replace(&temporary_path, destination, content.as_bytes());

    if result.is_err() {
        let _ = fs::remove_file(&temporary_path);
    }

    result
}

fn write_and_replace(
    temporary_path: &Path,
    destination: &Path,
    content: &[u8],
) -> Result<(), AtomicWriteError> {
    let mut temporary_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(temporary_path)
        .map_err(|source| AtomicWriteError::CreateTemporary {
            path: temporary_path.to_path_buf(),
            source,
        })?;

    temporary_file
        .write_all(content)
        .map_err(|source| AtomicWriteError::WriteTemporary {
            path: temporary_path.to_path_buf(),
            source,
        })?;

    temporary_file
        .sync_all()
        .map_err(|source| AtomicWriteError::SyncTemporary {
            path: temporary_path.to_path_buf(),
            source,
        })?;
    drop(temporary_file);

    replace_file(temporary_path, destination)
}

fn temporary_path(destination: &Path) -> Result<PathBuf, AtomicWriteError> {
    let parent = destination
        .parent()
        .ok_or(AtomicWriteError::InvalidDestination)?;
    let file_name = destination
        .file_name()
        .and_then(OsStr::to_str)
        .ok_or(AtomicWriteError::InvalidDestination)?;
    let sequence = TEMP_FILE_SEQUENCE.fetch_add(1, Ordering::Relaxed);

    Ok(parent.join(format!(
        ".{file_name}.{}.{}.tmp",
        std::process::id(),
        sequence
    )))
}

fn replace_file(temporary_path: &Path, destination: &Path) -> Result<(), AtomicWriteError> {
    let temporary_wide = wide_path(temporary_path);
    let destination_wide = wide_path(destination);

    let result = unsafe {
        ReplaceFileW(
            destination_wide.as_ptr(),
            temporary_wide.as_ptr(),
            std::ptr::null(),
            0,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };

    if result == 0 {
        return Err(AtomicWriteError::ReplaceDestination {
            path: destination.to_path_buf(),
            source: io::Error::last_os_error(),
        });
    }

    Ok(())
}

fn wide_path(path: &Path) -> Vec<u16> {
    path.as_os_str().encode_wide().chain(Some(0)).collect()
}
