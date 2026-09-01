pub mod file_ops;
pub mod utils;

use file_ops::{
    backup_manager, bgimage_manager, document_manager, file_manager, initializer, txt_editor,
};
use utils::{battery_manager, time_manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            battery_manager::start_battery_monitor(app.handle().clone());
            Ok(())
        })
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            //ここにJS側から呼び出す関数を書き連ねる。
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
            bgimage_manager::get_whole_image_list
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
