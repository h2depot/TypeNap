use tauri::{AppHandle, Manager, Webview};

// WebviewBuilder is used only for creation. Reuse the existing Webview here
// so navigation preserves its session history.
fn get_search_webview(app: &AppHandle, label: &str) -> Result<Webview, String> {
    if !label.starts_with("search-") {
        return Err("Only search webviews can be controlled".to_string());
    }
    app.get_webview(label)
        .ok_or_else(|| format!("Search webview not found: {label}"))
}

/// Go back in the target webview's history (a no-op if there is no previous page).
#[tauri::command]
pub async fn webview_back(app: AppHandle, label: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        native_history(get_search_webview(&app, &label)?, Some(false)).await?;
        Ok(())
    }
    #[cfg(not(windows))]
    get_search_webview(&app, &label)?
        .eval("window.history.back()")
        .map_err(|err| err.to_string())
}

/// Go forward in the target webview's history (a no-op if there is no next page).
#[tauri::command]
pub async fn webview_forward(app: AppHandle, label: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        native_history(get_search_webview(&app, &label)?, Some(true)).await?;
        Ok(())
    }
    #[cfg(not(windows))]
    get_search_webview(&app, &label)?
        .eval("window.history.forward()")
        .map_err(|err| err.to_string())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationState {
    pub url: String,
    pub title: Option<String>,
    pub can_go_back: Option<bool>,
    pub can_go_forward: Option<bool>,
}

// Run COM calls on the Webview's UI thread and propagate the actual native
// result, rather than just reporting that JavaScript was queued for evaluation.
#[cfg(windows)]
async fn native_history(webview: Webview, forward: Option<bool>) -> Result<NavigationState, String> {
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    webview.with_webview(move |platform| {
        let result = (|| {
            // SAFETY: Tauri invokes this closure on the owning UI thread.
            unsafe {
                let core = platform.controller().CoreWebView2().map_err(|err| err.to_string())?;
                let mut back = Default::default();
                let mut next = Default::default();
                core.CanGoBack(&mut back).map_err(|err| err.to_string())?;
                core.CanGoForward(&mut next).map_err(|err| err.to_string())?;
                match forward {
                    Some(false) if back.as_bool() => core.GoBack().map_err(|err| err.to_string())?,
                    Some(true) if next.as_bool() => core.GoForward().map_err(|err| err.to_string())?,
                    _ => {}
                }
                let mut source = Default::default();
                core.Source(&mut source).map_err(|err| err.to_string())?;
                let url = source.to_string().map_err(|err| err.to_string());
                windows_sys::Win32::System::Com::CoTaskMemFree(source.0.cast());
                let url = url?;
                let mut document_title = Default::default();
                core.DocumentTitle(&mut document_title).map_err(|err| err.to_string())?;
                let title = document_title.to_string().ok().filter(|title| !title.trim().is_empty());
                windows_sys::Win32::System::Com::CoTaskMemFree(document_title.0.cast());
                Ok(NavigationState {
                    url, title,
                    can_go_back: Some(back.as_bool()),
                    can_go_forward: Some(next.as_bool()),
                })
            }
        })();
        let _ = sender.send(result);
    }).map_err(|err| err.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        receiver.recv_timeout(std::time::Duration::from_secs(5))
            .map_err(|err| format!("Webview history response failed: {err}"))?
    }).await.map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn webview_navigation_state(app: AppHandle, label: String) -> Result<NavigationState, String> {
    let webview = get_search_webview(&app, &label)?;
    #[cfg(windows)]
    { native_history(webview, None).await }
    #[cfg(not(windows))]
    {
        let url = webview.url().map_err(|err| err.to_string())?.to_string();
        Ok(NavigationState { url, title: None, can_go_back: None, can_go_forward: None })
    }
}

/// Reload the current page without creating a new webview.
#[tauri::command]
pub async fn webview_reload(app: AppHandle, label: String) -> Result<(), String> {
    get_search_webview(&app, &label)?
        .reload()
        .map_err(|err| err.to_string())
}

/// Navigate in place so URLs entered in the toolbar retain browsing history.
#[tauri::command]
pub async fn webview_navigate(app: AppHandle, label: String, url: String) -> Result<(), String> {
    let url = url::Url::parse(&url).map_err(|err| err.to_string())?;
    if url.scheme() != "https" {
        return Err("Only HTTPS URLs are allowed".to_string());
    }
    get_search_webview(&app, &label)?
        .navigate(url)
        .map_err(|err| err.to_string())
}
