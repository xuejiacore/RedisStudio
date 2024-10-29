// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::Local;
use futures::FutureExt;
use sqlx::{Connection, Row};
use std::any::Any;
use tauri::ipc::private::FutureKind;
use tauri::ipc::IpcResponse;
use tauri::{Emitter, Manager, Runtime};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use redisstudio::log::project_logger;
use redisstudio::win::window::WebviewWindowExt;
use redisstudio::{command, spotlight_command};
use tauri_nspanel::ManagerExt;
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};

mod setup;
mod tray;

type Result<T> = std::result::Result<T, tauri_plugin_sql::Error>;

fn main() {
    project_logger::init_logger();
    let mut builder = tauri::Builder::default();
    builder = command::register_command(builder);

    builder
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::new()
            .level(log::LevelFilter::Info)
            // verbose logs only for the commands module
            .level_for("tantivy", log::LevelFilter::Info)
            .format(|out, message, record| {
                let now = Local::now();
                let milliseconds = now.timestamp_millis() % 1000;
                let formatted_without_millis = now.format("%Y-%m-%d %H:%M:%S");
                let formatted_with_millis = format!("{}.{:03}", formatted_without_millis, milliseconds);
                out.finish(format_args!(
                    "[{}] [{}] [{}] {}",
                    formatted_with_millis,
                    record.level(),
                    record.target(),
                    message
                ))
            })
            .build())
        .plugin(tauri_nspanel::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new()
            .with_shortcut(Shortcut::new(Some(Modifiers::SUPER), Code::KeyK))
            .unwrap()
            .with_handler(spotlight_command::spotlight_key_shortcut)
            .build())
        // .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(setup::init)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
