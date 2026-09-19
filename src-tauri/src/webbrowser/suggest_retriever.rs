use std::time::Duration;
use tauri::State;
use serde::Serialize;
use crate::webbrowser::setup_url;

pub fn construct_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .https_only(true)
        .timeout(Duration::from_millis(800))
        .user_agent("Mozilla/5.0 (compatible; TypeNap/1.0)")
        .build()
        .map_err(|error| error.to_string())
}

#[derive(Serialize)]
pub struct SuggestResult {
    suggestions: Vec<String>,
}

#[tauri::command]
pub async fn get_suggestions(
    client: State<'_, reqwest::Client>,
    query: String,
) -> Result<SuggestResult, String> {
    let query = query.trim();
    // Suggestions are for typed keywords, not full URLs or hostnames.
    if query.is_empty() || url::Url::parse(query).is_ok()
        || setup_url::brushup_url(query).ok().flatten().is_some() {
        return Ok(SuggestResult { suggestions: vec![] });
    }

    let resp = client
        .get("https://suggestqueries.google.com/complete/search")
        .query(&[("client", "firefox"), ("q", query)])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status().map_err(|e| e.to_string())?;

    let body = resp.text().await.map_err(|e| e.to_string())?;
    parse_suggestions(&body)
}

fn parse_suggestions(body: &str) -> Result<SuggestResult, String> {
    let json: serde_json::Value = serde_json::from_str(body).map_err(|e| e.to_string())?;
    let values = json
        .get(1)
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Invalid suggestion response".to_string())?;
    let mut suggestions = Vec::new();
    for value in values.iter().filter_map(|value| value.as_str()) {
        let value = value.trim();
        if !value.is_empty() && !suggestions.iter().any(|item| item == value) {
            suggestions.push(value.to_string());
        }
        if suggestions.len() == 8 { break; }
    }

    Ok(SuggestResult { suggestions })
}
