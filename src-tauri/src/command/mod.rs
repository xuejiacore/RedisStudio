use tauri::{Builder, Wry};

pub mod index_search;
pub mod menu_controller;
pub mod redis_cmd;
pub mod window_controller;
pub mod pattern_manager;
pub mod common_cmd;
pub mod datasource_mgr_command;
pub mod spotlight_command;
pub mod dataview_mgr_command;

pub fn register_command(builder: Builder<Wry>) -> Builder<Wry>
{
    builder.invoke_handler(tauri::generate_handler![
            dataview_mgr_command::list_tree_data_views,
            dataview_mgr_command::add_new_data_view_item,
            dataview_mgr_command::del_data_view_item,
            dataview_mgr_command::query_history_vars,
            dataview_mgr_command::save_var_history,
            dataview_mgr_command::query_key_exist_and_type,

            datasource_mgr_command::list_flat_datasource,
            datasource_mgr_command::change_active_datasource,
            datasource_mgr_command::query_datasource_detail,
            datasource_mgr_command::list_treed_datasource,

            redis_cmd::redis_invoke,
            redis_cmd::reconnect_redis,
            redis_cmd::select_redis_database,
            redis_cmd::database_analysis,

            common_cmd::sys_prop,
            common_cmd::action,
            common_cmd::key_favor_status,
            common_cmd::operate_key_favor,

            // Searching
            index_search::spotlight_search,
            index_search::write_index,
            index_search::infer_redis_key_pattern,
            index_search::record_key_access_history,
            index_search::initialize_datasource_pattern,

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
            menu_controller::show_data_view_right_click_menu,
            menu_controller::show_data_view_mgr_menu,
        ])
}