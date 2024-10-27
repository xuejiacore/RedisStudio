use crate::spotlight_command;
use tauri::{Builder, Runtime, Wry};

pub mod index_search;
pub mod menu_controller;
pub mod redis_cmd;
pub mod window_controller;
pub mod pattern_manager;
pub mod common_cmd;
pub fn register_command(builder: Builder<Wry>) -> Builder<Wry>
{
    builder.invoke_handler(tauri::generate_handler![
            redis_cmd::redis_invoke,
            redis_cmd::reconnect_redis,
            redis_cmd::select_redis_database,

            common_cmd::sys_prop,
            common_cmd::action,
            common_cmd::key_favor_status,
            common_cmd::operate_key_favor,

            // Searching
            index_search::spotlight_search,
            index_search::write_index,
            index_search::infer_redis_key_pattern,
            index_search::record_key_access_history,

            // Pattern Manager
            pattern_manager::pattern_add_tag,

            // Window
            window_controller::open_redis_pushpin_window,
            window_controller::close_redis_pushpin_window,
            window_controller::resize_redis_pushpin_window,
            window_controller::on_redis_pushpin_window_shown,
            window_controller::open_datasource_window,
            window_controller::open_database_selector_window,

            spotlight_command::hide_spotlight,
            spotlight_command::resize_spotlight_window,

            // Menu
            menu_controller::show_content_editor_menu,
            menu_controller::show_auto_refresh_menu,
            menu_controller::show_add_new_key_menu,
            menu_controller::show_key_tree_right_menu,
            menu_controller::show_database_list_menu,
        ])
}