// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::any::Any;

use sqlx::{Connection, Row};
use tauri::ipc::private::FutureKind;
use tauri::ipc::IpcResponse;
use tauri::{Manager, PhysicalSize, Runtime, State, Wry};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use redisstudio::command::index_search;
use redisstudio::command::menu_controller;
use redisstudio::command::pattern_manager;
use redisstudio::command::redis_cmd;
use redisstudio::command::window_controller;
use redisstudio::log::project_logger;
use redisstudio::spotlight_command;
use redisstudio::spotlight_command::SPOTLIGHT_LABEL;
use redisstudio::storage::sqlite_storage::SqliteStorage;
use redisstudio::view::command::CommandDispatcher;
use redisstudio::window::WebviewWindowExt;
use tauri_nspanel::ManagerExt;
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

mod setup;
mod tray;

type Result<T> = std::result::Result<T, tauri_plugin_sql::Error>;

#[tauri::command]
async fn sys_prop(storage: State<'_, SqliteStorage>, property: &str) -> Result<String> {
    let mut instance = storage.pool.lock().await;
    let db = instance.get_mut("default").unwrap();
    let rows = sqlx::query("select value from tbl_system where field = $1")
        .bind(property)
        .fetch_all(&*db)
        .await?;
    if rows.len() > 0 {
        Ok(rows[0].try_get("value").unwrap())
    } else {
        Ok("".to_string())
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// receive action from front
#[tauri::command]
fn action(data: &str, dispatcher: tauri::State<'_, CommandDispatcher>) -> String {
    dispatcher.dispatch(data)
}

// Create the command:
// This command must be async so that it doesn't run on the main thread.
#[tauri::command]
async fn close_splashscreen(window: tauri::Window<Wry>) {
    // Close splashscreen
    if let Some(splashscreen) = window.get_window("splashscreen") {
        splashscreen.close().unwrap();
    }
    // Show main window
    window.get_window("main").unwrap().show().unwrap();
}

#[tauri::command]
async fn resize_spotlight_window<R: Runtime>(
    height: u32,
    handle: tauri::AppHandle<R>,
    window: tauri::Window<Wry>,
) {
    let search_win = handle.get_window("spotlight-search").unwrap();
    let size = search_win.inner_size().unwrap();
    let scale = 1;
    search_win.set_size(PhysicalSize::new(size.width, height * scale)).unwrap();
    search_win.set_focus().unwrap();
}

fn main() {
    project_logger::init_logger();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            sys_prop,
            redis_cmd::redis_invoke,
            action,
            greet,
            close_splashscreen,
            resize_spotlight_window,

            spotlight_command::show_spotlight,
            spotlight_command::hide_spotlight,

            // Searching
            index_search::search,
            index_search::write_index,
            index_search::infer_redis_key_pattern,

            // Pattern Manager
            pattern_manager::pattern_add_tag,

            // Window
            window_controller::open_redis_pushpin_window,
            window_controller::close_redis_pushpin_window,
            window_controller::on_redis_pushpin_window_shown,
            window_controller::prepare_pin_window,
            window_controller::open_datasource_window,
            window_controller::open_database_selector_window,

            // Menu
            menu_controller::show_content_editor_menu,
            menu_controller::show_auto_refresh_menu,
            menu_controller::show_add_new_key_menu,
            menu_controller::show_key_tree_right_menu,
        ])
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_nspanel::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut(Shortcut::new(Some(Modifiers::SUPER), Code::KeyK))
                .unwrap()
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed
                        && shortcut.matches(Modifiers::SUPER, Code::KeyK)
                    {
                        let window = app.get_webview_window(SPOTLIGHT_LABEL).unwrap();

                        let panel = app.get_webview_panel(SPOTLIGHT_LABEL).unwrap();

                        if panel.is_visible() {
                            panel.order_out(None);
                        } else {
                            window.center_at_cursor_monitor().unwrap();

                            panel.show();
                        }
                    }
                })
                .build(),
        )
        // .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(setup::init)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
