use url::{Host, Url};
use super::url_format;

#[tauri::command]
pub async fn setup_url(query: String, search_engine: String) -> Result<String, String> {
    let query = query.trim();
    if query.is_empty() {
        return Err("URL or search query must not be empty".to_string());
    }
    let completed_url = if is_valid_url(query) {
        query.to_string()
    } else if let Some(url) = brushup_url(query)? {
        url
    } else {
        make_keyword_search_url(query, &search_engine)?
    };
    if !block_risky_url(&completed_url)? {
        return Err("Only HTTPS URLs are allowed".to_string());
    }
    Ok(completed_url)
}

fn is_valid_url(url: &str) -> bool {
    Url::parse(url).is_ok()
}

// Unlike navigation, shortcut registration must never turn keywords into a search.
#[tauri::command]
pub fn validate_shortcut_url(query: String) -> bool {
    let query = query.trim();
    if query.is_empty() || query.chars().any(char::is_whitespace) {
        return false;
    }
    let completed = if is_valid_url(query) {
        query.to_string()
    } else {
        match brushup_url(query) {
            Ok(Some(url)) => url,
            _ => return false,
        }
    };
    block_risky_url(&completed).unwrap_or(false)
}

// None means this is a search query rather than an incomplete URL.
pub(super) fn brushup_url(query: &str) -> Result<Option<String>, String> {
    if query.contains("://") {
        return Err("Invalid URL".to_string());
    }
    if query.chars().any(char::is_whitespace) {
        return Ok(None);
    }
    let candidate = format!("https://{}", query.strip_prefix("//").unwrap_or(query));
    let url = match Url::parse(&candidate) {
        Ok(url) => url,
        Err(_) => return Ok(None),
    };
    // Avoid treating email addresses as URLs with credentials.
    if !url.username().is_empty() || url.password().is_some() {
        return Ok(None);
    }
    let is_host = match url.host() {
        Some(Host::Domain(host)) => {
            let host = host.trim_end_matches('.');
            host == "localhost"
                || (host.contains('.')
                    && host.split('.').all(|label| {
                        !label.is_empty()
                            && label.len() <= 63
                            && !label.starts_with('-')
                            && !label.ends_with('-')
                            && label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
                    }))
        }
        Some(Host::Ipv4(_) | Host::Ipv6(_)) => true,
        None => false,
    };
    Ok(is_host.then(|| url.to_string()))
}

fn make_keyword_search_url(query: &str, search_engine: &str) -> Result<String, String> {
    let (base_url, parameter) = match search_engine {
        "Google" => url_format::GOOGLE,
        "Bing" => url_format::BING,
        "DuckDuckGo" => url_format::DUCKDUCKGO,
        "Yahoo" => url_format::YAHOO,
        _ => return Err("Unsupported search engine".to_string()),
    };
    let mut url = Url::parse(base_url).map_err(|err| err.to_string())?;
    url.query_pairs_mut().append_pair(parameter, query);
    Ok(url.to_string())
}

fn block_risky_url(url: &str) -> Result<bool, String> {
    let url = Url::parse(url).map_err(|err| format!("Invalid URL: {err}"))?;
    Ok(url.scheme() == "https")
}