// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::any::Any;

use redisstudio::command;
use sqlx::{Connection, Row};
use tauri::ipc::private::FutureKind;
use tauri::ipc::IpcResponse;
use tauri::{Manager, Runtime, State, Wry};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use redisstudio::command::index_search;
use redisstudio::command::window_controller;
use redisstudio::command::menu_controller;
use redisstudio::command::zookeeper_cmd;
use redisstudio::log::project_logger;
use redisstudio::storage::sqlite_storage::SqliteStorage;
use redisstudio::view::command::CommandDispatcher;

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

#[tauri::command]
async fn redis_invoke(
    data: &str,
    app: tauri::AppHandle,
    window: tauri::Window<Wry>,
) -> Result<String> {
    Ok(command::redis_cmd::dispatch_redis_cmd(data, app, window).to_string())
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

/// open spotlight window
#[tauri::command]
async fn open_spotlight_window<R: Runtime>(
    handle: tauri::AppHandle<R>,
    window: tauri::Window<Wry>,
) {
    let search_win = window.get_window("spotlight-search").unwrap();
    search_win.show().unwrap();
}

fn main() {
    project_logger::init_logger();
    tauri::Builder::default()
        .setup(setup::init)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        // .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            sys_prop,
            redis_invoke,
            action,
            greet,
            close_splashscreen,
            open_spotlight_window,
            window_controller::open_redis_pushpin_window,
            window_controller::close_redis_pushpin_window,
            window_controller::on_redis_pushpin_window_shown,
            window_controller::prepare_pin_window,
            index_search::search,
            index_search::write_index,
            zookeeper_cmd::zk_invoke,
            menu_controller::show_content_editor_menu,
            menu_controller::show_auto_refresh_menu,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
