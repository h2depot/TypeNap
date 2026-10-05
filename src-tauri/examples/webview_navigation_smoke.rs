//! Run with `cargo run --example webview_navigation_smoke` on Windows.
//! Uses a separate, hidden Webview and local fixture pages; no user data is opened.
use std::{io::{Read, Write}, net::TcpListener, sync::mpsc, time::Duration};
use tauri::{Manager, WebviewBuilder, WebviewUrl};
use typenap_lib::webbrowser::webview_manager::{
    webview_back, webview_forward, webview_navigate, webview_navigation_state, webview_reload,
};

fn main() {
    let server = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", server.local_addr().unwrap());
    std::thread::spawn(move || {
        for mut stream in server.incoming().flatten() {
            let mut request = [0; 4096];
            let count = stream.read(&mut request).unwrap_or(0);
            let request = String::from_utf8_lossy(&request[..count]);
            let title = if request.starts_with("GET /second ") { "Second page" } else { "Google" };
            let body = format!("<!doctype html><title>{title}</title><p>Local test page</p>");
            let response = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
            let _ = stream.write_all(response.as_bytes());
        }
    });
    tauri::Builder::default()
        .setup(move |app| {
            let window = app.get_window("main").unwrap();
            window.hide()?;
            let (sender, receiver) = mpsc::channel();
            let label = "search-navigation-smoke".to_string();
            let first = format!("{base}/first");
            let second = format!("{base}/second");
            window.add_child(
                WebviewBuilder::new(&label, WebviewUrl::External(first.parse()?))
                    .on_page_load(move |_, payload| {
                        if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                            let _ = sender.send(payload.url().to_string());
                        }
                    }),
                tauri::LogicalPosition::new(0, 0),
                tauri::LogicalSize::new(640, 480),
            )?;
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let wait_for = |expected: &str| -> Result<(), String> {
                    let deadline = std::time::Instant::now() + Duration::from_secs(20);
                    loop {
                        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
                        let loaded = receiver.recv_timeout(remaining).map_err(|err| err.to_string())?;
                        if loaded == expected { return Ok(()); }
                    }
                };
                let result: Result<(), String> = tauri::async_runtime::block_on(async {
                    wait_for(&first)?;
                    let state = webview_navigation_state(handle.clone(), label.clone()).await?;
                    if state.title.as_deref() != Some("Google") { return Err(format!("Initial title mismatch: {:?}", state.title)); }
                    // The public command rejects HTTP, including local fixtures.
                    if webview_navigate(handle.clone(), label.clone(), second.clone()).await.is_ok() {
                        return Err("HTTP navigation was not blocked".into());
                    }
                    // This isolated harness bypasses the production HTTPS policy
                    // only to exercise native history against its local server.
                    handle.get_webview(&label).unwrap().navigate(second.parse().unwrap())
                        .map_err(|err| err.to_string())?;
                    wait_for(&second)?;
                    let state = webview_navigation_state(handle.clone(), label.clone()).await?;
                    if state.can_go_back != Some(true) { return Err("Second page has no back history".into()); }
                    if state.title.as_deref() != Some("Second page") { return Err("Navigation did not update title".into()); }
                    handle.get_webview(&label).unwrap().eval("document.title = 'Updated title'").map_err(|err| err.to_string())?;
                    let deadline = std::time::Instant::now() + Duration::from_secs(5);
                    loop {
                        let state = webview_navigation_state(handle.clone(), label.clone()).await?;
                        if state.url == second && state.title.as_deref() == Some("Updated title") { break; }
                        if std::time::Instant::now() >= deadline { return Err("Title change at the same URL was not detected".into()); }
                        std::thread::sleep(Duration::from_millis(50));
                    }
                    webview_back(handle.clone(), label.clone()).await?;
                    wait_for(&first)?;
                    let state = webview_navigation_state(handle.clone(), label.clone()).await?;
                    if state.url != first || state.can_go_forward != Some(true) { return Err("Back did not restore first page and forward history".into()); }
                    if state.title.as_deref() != Some("Google") { return Err("Back did not restore the page title".into()); }
                    webview_forward(handle.clone(), label.clone()).await?;
                    wait_for(&second)?;
                    webview_reload(handle.clone(), label.clone()).await?;
                    wait_for(&second)?;
                    Ok(())
                });
                match result {
                    Ok(()) => { println!("PASS: native navigation, history, page titles and title changes at the same URL"); handle.exit(0); }
                    Err(err) => { eprintln!("FAIL: {err}"); handle.exit(1); }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run navigation smoke test");
}
