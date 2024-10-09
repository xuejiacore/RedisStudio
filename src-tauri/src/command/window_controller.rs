// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use crate::win::pinned_windows::PinnedWindows;
use crate::win::window::WebviewWindowExt;
use rand::Rng;
use tauri::{LogicalPosition, LogicalSize, Manager, Position, Runtime, Size, State, Wry};
use tauri_nspanel::ManagerExt;

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

#[tauri::command]
pub fn open_database_selector_window<R: Runtime>(x: f64, y: f64, handle: tauri::AppHandle<R>) {
    let window = handle.get_webview_window("datasource-database-selector");
    match window {
        None => {}
        Some(win) => {
            let main_window = handle.get_webview_window("main").unwrap();
            let pos = main_window.outer_position().unwrap();
            let log_pos: LogicalPosition<f64> = LogicalPosition::from_physical(pos, main_window.scale_factor().unwrap());
            win.set_size(Size::Logical(LogicalSize::new(140f64, 300f64))).unwrap();
            win.set_position(Position::Logical(LogicalPosition::new(x + log_pos.x, y + log_pos.y - 4f64))).unwrap();
            win.show().unwrap();
        }
    }
}

/// open the redis pushpin window, always on the top.
#[tauri::command]
pub fn open_redis_pushpin_window<R: Runtime>(
    key_name: &str,
    key_type: &str,
    handle: tauri::AppHandle<R>,
    _window: tauri::Window<Wry>,
    pin_win_man: State<'_, PinnedWindows>,
) {
    let window = pin_win_man.fetch_idle_window(key_name.to_string(), &handle);
    window.eval(format!("window.onKeyChange('{}', '{}')", key_name, key_type).as_str()).unwrap();
    let label = window.label();
    let panel = handle.get_webview_panel(label).unwrap();

    let mut rng = rand::thread_rng();

    let random_x: f64 = rng.gen_range(-30f64..=300f64);
    let random_y: f64 = rng.gen_range(-300f64..=300f64);
    window.random_center_at_cursor_monitor(random_x, random_y).unwrap();
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
    let af_width = x - pos.x as f64;
    let af_height = y - pos.y as f64;
    window.set_size(Size::Logical(LogicalSize::new(af_width, af_height))).unwrap();
}

#[tauri::command]
pub fn on_redis_pushpin_window_shown<R: Runtime>(
    key_name: &str,
    handle: tauri::AppHandle<R>,
) -> String {
    let label = get_window_label(key_name);
    let window = handle.get_webview_window(label.clone().as_str());
    match window {
        None => "false".to_string(),
        Some(w) => w.is_visible().unwrap().to_string(),
    }
}

fn get_window_label(key_name: &str) -> String {
    let mut label = String::from(REDIS_PIN_LABEL_PREFIX);
    let digest = md5::compute(key_name);
    let unique_id = format!("{:x}", digest).clone();
    label.push_str(unique_id.as_str());
    label
}
