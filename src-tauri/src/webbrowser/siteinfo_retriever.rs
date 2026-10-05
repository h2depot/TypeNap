use super::url_format;
use scraper::{Html, Selector};
use std::time::Duration;
use url::Url;

const MAX_METADATA_BYTES: usize = 5 * 1024 * 1024;

fn append_metadata_chunk(bytes: &mut Vec<u8>, chunk: &[u8]) -> Result<(), String> {
    if chunk.len() > MAX_METADATA_BYTES - bytes.len() {
        return Err("Site metadata exceeds the 5 MiB limit".into());
    }
    bytes.extend_from_slice(chunk);
    Ok(())
}

// Only the metadata request is restricted; Webview rendering is independent.
async fn read_metadata_html(mut response: reqwest::Response) -> Result<String, String> {
    let content_type = response.headers().get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| "Missing or invalid metadata Content-Type".to_string())?;
    let media_type = content_type.split(';').next().unwrap_or_default().trim();
    if !media_type.eq_ignore_ascii_case("text/html")
        && !media_type.eq_ignore_ascii_case("application/xhtml+xml") {
        return Err("Site metadata requires HTML or XHTML".into());
    }
    let content_type = content_type.to_owned();
    let declared_length = response.headers().get(reqwest::header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok());
    if declared_length.is_some_and(|length| length > MAX_METADATA_BYTES as u64)
        || response.content_length().is_some_and(|length| length > MAX_METADATA_BYTES as u64) {
        return Err("Site metadata exceeds the 5 MiB limit".into());
    }
    let mut bytes = Vec::new();
    // Do not trust Content-Length: also bound chunked or incorrectly sized bodies.
    while let Some(chunk) = response.chunk().await.map_err(|err| err.to_string())? {
        append_metadata_chunk(&mut bytes, &chunk)?;
    }
    // Retain reqwest's charset/BOM decoding, now using an already bounded body.
    let bounded = tauri::http::Response::builder()
        .header(reqwest::header::CONTENT_TYPE, content_type)
        .body(bytes).map_err(|err| err.to_string())?;
    reqwest::Response::from(bounded).text().await.map_err(|err| err.to_string())
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteInfo {
    title: Option<String>,
    icon: Option<String>,
    title_error: Option<String>,
    icon_error: Option<String>,
    success: bool,
}

impl SiteInfo {
    fn from_results(title: Result<String, String>, icon: Result<String, String>) -> Self {
        let success = title.is_ok() && icon.is_ok();
        let (title, title_error) = match title {
            Ok(value) => (Some(value), None),
            Err(error) => (None, Some(error)),
        };
        let (icon, icon_error) = match icon {
            Ok(value) => (Some(value), None),
            Err(error) => (None, Some(error)),
        };
        Self { title, icon, title_error, icon_error, success }
    }
}

// Metadata failure is returned as data, not a failed bookmark operation.
// Fetch once, then preserve each extractor's Result independently.
#[tauri::command]
pub async fn get_site_info(url: String) -> SiteInfo {
    let page = match icon_target(&url) {
        Ok(None) => return SiteInfo::from_results(Ok(site_title(&url)), Ok("Search".into())),
        Ok(Some(target)) => fetch_page(target).await,
        Err(error) => Err(error),
    };
    match page {
        Ok((page_url, html)) => SiteInfo::from_results(
            extract_title(&html), favicon_url(&page_url, &html),
        ),
        Err(error) => SiteInfo::from_results(Err(error.clone()), Err(error)),
    }
}

fn extract_title(html: &str) -> Result<String, String> {
    html_title(html).ok_or_else(|| "Page title was not found".into())
}

#[tauri::command]
pub async fn get_site_icon(url: String) -> Result<String, String> {
    let Some(target) = icon_target(&url)? else {
        return Ok("Search".to_string());
    };
    let (page_url, html) = fetch_page(target).await?;
    favicon_url(&page_url, &html)
}

async fn fetch_page(target: Url) -> Result<(Url, String), String> {
    let client = reqwest::Client::builder()
        .https_only(true)
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|err| err.to_string())?;
    let response = client.get(target).send().await
        .map_err(|err| format!("Failed to fetch site: {err}"))?
        .error_for_status().map_err(|err| err.to_string())?;
    // Relative links are based on the final URL after redirects.
    let page_url = response.url().clone();
    let html = read_metadata_html(response).await?;
    Ok((page_url, html))
}

fn icon_target(input: &str) -> Result<Option<Url>, String> {
    let input = input.trim();
    if input.is_empty() { return Ok(None); }
    let target = match Url::parse(input) {
        Ok(url) => url,
        Err(_) => match super::setup_url::brushup_url(input)? {
            Some(url) => Url::parse(&url).map_err(|err| err.to_string())?,
            None => return Ok(None),
        },
    };
    if search_query(target.as_str()).is_some() { return Ok(None); }
    if target.scheme() != "https" || target.host_str().is_none() {
        return Err("Site icons require an HTTPS URL".to_string());
    }
    Ok(Some(target))
}

fn favicon_url(page_url: &Url, html: &str) -> Result<String, String> {
    let document = Html::parse_document(html);
    let base_selector = Selector::parse("base[href]").unwrap();
    let base = document.select(&base_selector).next()
        .and_then(|element| page_url.join(element.value().attr("href")?.trim()).ok())
        .filter(|url| url.scheme() == "https")
        .unwrap_or_else(|| page_url.clone());
    let selector = Selector::parse("link[rel][href]").unwrap();
    for link in document.select(&selector) {
        let rel = link.value().attr("rel").unwrap_or_default();
        if !rel.split_ascii_whitespace().any(|token| token.eq_ignore_ascii_case("icon")) {
            continue;
        }
        let href = link.value().attr("href").unwrap_or_default().trim();
        if href.is_empty() { continue; }
        if let Ok(icon) = base.join(href) {
            if matches!(icon.scheme(), "https" | "data") {
                return Ok(icon.to_string());
            }
        }
    }
    page_url.join("/favicon.ico").map(|url| url.to_string()).map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn get_site_title(url: String) -> Result<String, String> {
    let Some(target) = icon_target(&url)? else {
        return Ok(site_title(&url));
    };
    let (_, html) = fetch_page(target).await?;
    extract_title(&html)
}

fn html_title(html: &str) -> Option<String> {
    let document = Html::parse_document(html);
    let selector = Selector::parse("title").unwrap();
    let title = document.select(&selector).next()?.text().collect::<String>();
    let title = title.split_whitespace().collect::<Vec<_>>().join(" ");
    (!title.is_empty()).then_some(title)
}

fn site_title(url: &str) -> String {
    search_query(url)
        .map(|query| format!("Search {query}"))
        .unwrap_or_else(|| "Search".to_string())
}

fn search_query(input: &str) -> Option<String> {
    let url = Url::parse(input.trim()).ok()?;
    for (base_url, parameter) in [
        url_format::GOOGLE,
        url_format::BING,
        url_format::DUCKDUCKGO,
        url_format::YAHOO,
    ] {
        let base = Url::parse(base_url).ok()?;
        if url.origin() != base.origin() || url.path() != base.path() {
            continue;
        }
        return url.query_pairs().find_map(|(key, value)| {
            let query = value.trim();
            (key == parameter && !query.is_empty()).then(|| query.to_string())
        });
    }
    None
}
