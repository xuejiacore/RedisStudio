// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use crate::storage::redis_pool::RedisPool;
use crate::win::pinned_windows::PinnedWindows;
use crate::win::window::WebviewWindowExt;
use crate::CmdError;
use futures::FutureExt;
use rand::Rng;
use redis::cmd;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::ops::DerefMut;
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Position, Runtime, Size, State, WebviewWindow, Wry};
use tauri_nspanel::cocoa::appkit::NSEvent;
use tauri_nspanel::cocoa::base::nil;
use tauri_nspanel::ManagerExt;

type Result<T> = std::result::Result<T, CmdError>;

const REDIS_PIN_LABEL_PREFIX: &str = "redispin_win:";

#[tauri::command]
pub fn open_datasource_window<R: Runtime>(x: f64, y: f64, handle: tauri::AppHandle<R>) {
    let window = handle.get_webview_window("datasource-dropdown");
    match window {
        None => {}
        Some(win) => {
            let main_window = handle.get_webview_window("main").unwrap();
            let pos = main_window.outer_position().unwrap();
            let log_pos: LogicalPosition<f64> = LogicalPosition::from_physical(pos, main_window.scale_factor().unwrap());
            win.set_size(Size::Logical(LogicalSize::new(270f64, 600f64))).unwrap();
            win.set_position(Position::Logical(LogicalPosition::new(x + log_pos.x, y + log_pos.y - 4f64))).unwrap();
            win.show().unwrap();
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
struct KeySpaceInfo {
    name: String,
    index: usize,
    keys: i64,
}

#[tauri::command]
pub async fn open_database_selector_window<R: Runtime>(
    datasource_id: String,
    database: i64,
    win_id: i64,
    x: f64,
    y: f64,
    redis_pool: State<'_, RedisPool>,
    handle: tauri::AppHandle<R>,
) -> Result<()> {
    let window = handle.get_webview_window("datasource-database-selector");
    match window {
        None => {}
        Some(win) => {
            let main_window = handle.get_webview_window("main").unwrap();
            let pos = main_window.outer_position().unwrap();
            let log_pos: LogicalPosition<f64> = LogicalPosition::from_physical(pos, main_window.scale_factor().unwrap());
            win.set_size(Size::Logical(LogicalSize::new(140f64, 300f64))).unwrap();
            win.set_position(Position::Logical(LogicalPosition::new(x + log_pos.x, y + log_pos.y - 4f64))).unwrap();

            let arc = redis_pool.select_connection(datasource_id.as_str(), None).await;
            let mut connection = arc.lock().await;

            // databases key space info.
            let re = Regex::new(r"(?<name>db(?<index>\d+)):keys=(?<keys>\d+),expires=(\d+)").unwrap();
            let keyspace: String = cmd("INFO").arg("KEYSPACE").query_async(connection.deref_mut()).await.unwrap();
            let key_space_info: Vec<KeySpaceInfo> = keyspace
                .split("\n")
                .filter(|line| line.len() > 0 && !line.starts_with("#"))
                .map(|line| {
                    let cap = re.captures(line).unwrap();
                    let name = String::from(cap.name("name").unwrap().as_str());
                    let index = cap.name("index").unwrap().as_str().parse().unwrap();
                    let keys = cap.name("keys").unwrap().as_str().parse().unwrap();
                    KeySpaceInfo { name, index, keys }
                })
                .collect();

            // count of databases.
            let databases_info: Vec<String> = cmd("CONFIG")
                .arg("GET")
                .arg("DATABASES")
                .query_async(connection.deref_mut())
                .await
                .unwrap();
            let database_count = &databases_info[1];

            let json_data = json!(key_space_info).to_string();
            win.eval(format!("window.loadAllDatabase({win_id}, {database}, '{json_data}', {database_count})").as_str()).unwrap();
            win.show().unwrap();
        }
    }
    Ok(())
}

/// open the redis pushpin window, always on the top.
#[tauri::command]
pub fn open_redis_pushpin_window<R: Runtime>(
    datasource: String,
    database: i64,
    key_name: &str,
    key_type: &str,
    redis_pool: State<'_, RedisPool>,
    handle: tauri::AppHandle<R>,
    _window: tauri::Window<Wry>,
    pin_win_man: State<'_, PinnedWindows>,
) {
    let window = pin_win_man.fetch_idle_window(key_name.to_string(), &handle);
    let binding = window.clone();
    let label = binding.label();

    if datasource.is_empty() {
        tauri::async_runtime::block_on(async move {
            redis_pool.get_active_info().then(|r| {
                async move {
                    let datasource = r.0;
                    let database = r.1;
                    let script = format!("window.onKeyChange('{}', '{}', '{datasource}', {database})", key_name, key_type);
                    let eval_script = script.as_str();

                    eval_script_and_show_pin(&handle, &window, label, eval_script);
                }
            }).await
        });
    } else {
        let script = format!("window.onKeyChange('{}', '{}', '{datasource}', {database})", key_name, key_type);
        let eval_script = script.as_str();
        eval_script_and_show_pin(&handle, &window, label, eval_script);
    }
}

fn eval_script_and_show_pin<R: Runtime>(handle: &AppHandle<R>, window: &WebviewWindow<R>, label: &str, eval_script: &str) {
    window.eval(eval_script).unwrap();

    let panel = handle.get_webview_panel(label).unwrap();

    let mut rng = rand::thread_rng();

    if !panel.is_visible() {
        let random_x: f64 = rng.gen_range(-30f64..=100f64);
        let random_y: f64 = rng.gen_range(-30f64..=100f64);
        window.random_center_at_cursor_monitor(random_x, random_y).unwrap();
    }
    panel.show();
}

/// close the redis pushpin window, by provided key name of the window.
#[tauri::command]
pub fn close_redis_pushpin_window<R: Runtime>(
    key_name: &str,
    only_hide: bool,
    handle: tauri::AppHandle<R>,
    window: tauri::Window<Wry>,
    pin_win_man: State<'_, PinnedWindows>,
) {
    let window = pin_win_man.fetch_idle_window(key_name.to_string(), &handle);
    let label = window.label();
    let panel = handle.get_webview_panel(label).unwrap();
    if panel.is_visible() {
        panel.order_out(None);
        pin_win_man.return_window(key_name.to_string());

        let payload = json!({"keyName": key_name});
        window.emit_to("main", "redis_toolbar/pushpin_hidden", payload).unwrap();
    }
}

#[tauri::command]
pub fn resize_redis_pushpin_window<R: Runtime>(
    x: f64,
    y: f64,
    key_name: &str,
    handle: tauri::AppHandle<R>,
    window: tauri::Window<Wry>,
    pin_win_man: State<'_, PinnedWindows>,
) {
    let window = pin_win_man.fetch_idle_window(key_name.to_string(), &handle);
    let pos = window.outer_position().unwrap();
    println!("pos: {:?}, x={}, y={}", pos, x, y);

    // 获得鼠标的位置
    unsafe {
        // 获取鼠标位置
        let event = NSEvent::mouseLocation(nil);
        let mut mouse_x = event.x;
        let mut mouse_y = event.y; // Flip y-coordinate for macOS

        let aft_x = mouse_x as f64 - pos.x as f64 + 4f64;
        let aft_y = mouse_y as f64 - pos.y as f64 + 4f64;
        println!("mouse ({}, {}), afterSize = ({}, {})", mouse_x, mouse_y, aft_x, aft_y);
        // window.set_size(Size::Logical(LogicalSize::new(af_width, af_height))).unwrap();
    }

    let af_width = x - pos.x as f64;
    let af_height = y - pos.y as f64;
    // window.set_size(Size::Logical(LogicalSize::new(af_width, af_height))).unwrap();
}

#[tauri::command]
pub fn on_redis_pushpin_window_shown<R: Runtime>(
    key_name: &str,
    handle: tauri::AppHandle<R>,
    pin_win_man: State<'_, PinnedWindows>,
) -> String {
    match pin_win_man.window_shown(key_name.to_string(), &handle) {
        true => String::from("true"),
        false => String::from("false")
    }
}

fn get_window_label(key_name: &str) -> String {
    let mut label = String::from(REDIS_PIN_LABEL_PREFIX);
    let digest = md5::compute(key_name);
    let unique_id = format!("{:x}", digest).clone();
    label.push_str(unique_id.as_str());
    label
}


// Create the command:
// This command must be async so that it doesn't run on the main thread.
#[tauri::command]
pub async fn close_splashscreen(window: tauri::Window<Wry>) {
    // Close splashscreen
    if let Some(splashscreen) = window.get_webview_window("splashscreen") {
        splashscreen.close().unwrap();
    }
    // Show main window
    window.get_webview_window("main").unwrap().show().unwrap();
}
