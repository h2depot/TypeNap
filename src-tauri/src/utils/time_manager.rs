use chrono::{Local, Timelike, Utc};

/// Local wall-clock hour in [0, 24), including minutes, seconds and fractions.
/// Kept separate from UTC timestamps used for persistence.
pub fn current_local_hour() -> f64 {
    let now = Local::now();
    (now.num_seconds_from_midnight() as f64 + now.nanosecond() as f64 / 1_000_000_000.0) / 3600.0
}

pub fn current_timestamp() -> i64 {
    Utc::now().timestamp()
}

#[tauri::command]
pub async fn get_current_timestamp() -> Result<i64, String> {
    Ok(current_timestamp())
}

#[tauri::command]
// return example: "2026-08-23"
pub async fn get_current_date() -> Result<String, String> {
    let result = Utc::now().format("%Y-%m-%d").to_string();
    Ok(result)
}

#[tauri::command]
// return example: "sun"
pub async fn get_day_of_week() -> Result<String, String> {
    let result = Utc::now().format("%a").to_string().to_lowercase();
    Ok(result)
}
