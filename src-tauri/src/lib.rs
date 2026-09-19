pub mod file_ops;
pub mod soundeffect;
pub mod utils;
pub mod webbrowser;

use file_ops::{
    backup_manager, bgimage_manager, document_manager, file_manager, initializer, txt_editor,
};
use utils::{battery_manager, time_manager};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri::plugin::Builder::<tauri::Wry>::new("https-navigation")
            .on_navigation(|webview, url| {
                // Also enforce the policy for page links and redirects.
                !webview.label().starts_with("search-") || url.scheme() == "https"
            })
            .build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            app.manage(webbrowser::suggest_retriever::construct_http_client()?);
            battery_manager::start_battery_monitor(app.handle().clone());
            Ok(())
        })
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            webbrowser::setup_url::setup_url,
            webbrowser::suggest_retriever::get_suggestions,
            webbrowser::setup_url::validate_shortcut_url,
            webbrowser::siteinfo_retriever::get_site_title,
            webbrowser::siteinfo_retriever::get_site_info,
            webbrowser::siteinfo_retriever::get_site_icon,
            webbrowser::webview_manager::webview_back,
            webbrowser::webview_manager::webview_forward,
            webbrowser::webview_manager::webview_reload,
            webbrowser::webview_manager::webview_navigate,
            webbrowser::webview_manager::webview_navigation_state,
            initializer::initialize,
            initializer::create_dir_all,
            initializer::get_settings_state,
            initializer::get_toured_state,
            initializer::set_toured_state,
            file_manager::get_base_path,
            file_manager::get_story_list,
            file_manager::get_whole_txt_list,
            file_manager::get_story_info,
            file_manager::get_txt_content,
            file_manager::create_story,
            file_manager::delete_story,
            file_manager::rename_story,
            file_manager::delete_txt,
            file_manager::scan,
            file_manager::delete_non_txt_files,
            file_manager::update_story_synopsis,
            file_manager::update_story_cover,
            document_manager::create_document_txt,
            document_manager::save_document_content,
            document_manager::save_document_title,
            time_manager::get_current_timestamp,
            time_manager::get_current_date,
            time_manager::get_day_of_week,
            txt_editor::load_txt,
            backup_manager::increment_backup,
            backup_manager::get_backup_history,
            backup_manager::get_deleted_files,
            backup_manager::restore_deleted_files,
            backup_manager::execute_complete_deletion,
            bgimage_manager::add_user_image,
            bgimage_manager::delete_user_image,
            bgimage_manager::get_whole_image_list,
            soundeffect::soundeffect::run_sound_effect,
            soundeffect::soundeffect::run_enter_sound_effect,
            soundeffect::soundeffect::load_wavfile
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
