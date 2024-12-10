// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use crate::storage::redis_pool::RedisPool;
use crate::utils::system::constant::{PIN_WINDOW_MIN_HEIGHT, PIN_WINDOW_MIN_WIDTH};
use crate::win::pinned_windows::PinnedWindows;
use crate::CmdError;
use futures::FutureExt;
use redis::cmd;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::ops::DerefMut;
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize,
    Position, Runtime, Size, State, WebviewWindow, Wry,
};
use tauri_nspanel::cocoa::appkit::NSEvent;
use tauri_nspanel::cocoa::base::nil;
use tauri_nspanel::cocoa::foundation::NSUInteger;
use tauri_nspanel::ManagerExt;
use thiserror::Error;

type Result<T> = std::result::Result<T, CmdError>;

const REDIS_PIN_LABEL_PREFIX: &str = "redispin_win:";
type TauriError = tauri::Error;

#[derive(Error, Debug)]
enum Error {
    #[error("Monitor with cursor not found")]
    MonitorNotFound,
}

#[derive(Serialize, Deserialize, Debug)]
struct KeySpaceInfo {
    name: String,
    index: usize,
    keys: i64,
}

#[tauri::command]
pub async fn open_database_selector_window<R: Runtime>(
    datasource_id: i64,
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
            let log_pos: LogicalPosition<f64> =
                LogicalPosition::from_physical(pos, main_window.scale_factor().unwrap());
            win.set_size(Size::Logical(LogicalSize::new(140f64, 300f64)))
                .unwrap();
            win.set_position(Position::Logical(LogicalPosition::new(
                x + log_pos.x,
                y + log_pos.y - 4f64,
            )))
                .unwrap();

            let mut connection = redis_pool.select_connection(datasource_id, None).await;

            // databases key space info.
            let re =
                Regex::new(r"(?<name>db(?<index>\d+)):keys=(?<keys>\d+),expires=(\d+)").unwrap();
            let keyspace: String = cmd("INFO")
                .arg("KEYSPACE")
                .query_async(&mut connection)
                .await
                .unwrap();
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
                .query_async(&mut connection)
                .await
                .unwrap();
            let database_count = &databases_info[1];

            let json_data = json!(key_space_info).to_string();
            win.eval(format!("window.loadAllDatabase({win_id}, {database}, '{json_data}', {datasource_id}, {database_count})").as_str()).unwrap();
            win.show().unwrap();
        }
    }
    Ok(())
}

/// open the redis pushpin window, always on the top.
#[tauri::command]
pub fn open_redis_pushpin_window<R: Runtime>(
    datasource: i64,
    database: i64,
    key_name: &str,
    key_type: &str,
    redis_pool: State<'_, RedisPool>,
    handle: tauri::AppHandle<R>,
    _window: tauri::Window<Wry>,
    pin_win_man: State<'_, PinnedWindows>,
) {
    let window = pin_win_man.fetch_idle_window(key_name.to_string(), &handle);
    let window_size = window.outer_size().expect("fail to obtain window size");
    let semi_width = window_size.width as f64 / 2f64;
    let offset_y = 16f64;

    let binding = window.clone();
    let label = binding.label();

    let primary_monitor = handle
        .primary_monitor()
        .expect("fail to obtain primary monitor")
        .expect("fail to obtain primary monitor");
    let primary_scale = primary_monitor.scale_factor();
    let primary_size = primary_monitor.size();
    // calculate mouse position
    let mouse_position = unsafe { NSEvent::mouseLocation(nil) };
    let mx = mouse_position.x;
    let my = mouse_position.y;

    let y = primary_size.height as f64 / primary_scale - my;
    let position = PhysicalPosition::new(mx - semi_width, y - offset_y);

    println!("position = {:?}", &position);
    window
        .set_position(position)
        .expect("fail to update position");

    if datasource <= 0 {
        tauri::async_runtime::block_on(async move {
            redis_pool
                .get_active_info()
                .then(|r| async move {
                    let datasource = r.0;
                    let database = r.1;
                    let script = format!(
                        "window.onKeyChange('{}', '{}', {datasource}, {database})",
                        key_name, key_type
                    );
                    let eval_script = script.as_str();

                    eval_script_and_show_pin(&handle, &window, label, eval_script);
                })
                .await
        });
    } else {
        let script = format!(
            "window.onKeyChange('{}', '{}', {datasource}, {database})",
            key_name, key_type
        );
        let eval_script = script.as_str();
        eval_script_and_show_pin(&handle, &window, label, eval_script);
    }
}

fn eval_script_and_show_pin<R: Runtime>(
    handle: &AppHandle<R>,
    window: &WebviewWindow<R>,
    label: &str,
    eval_script: &str,
) {
    window.eval(eval_script).unwrap();
    let panel = handle.get_webview_panel(label).unwrap();
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
        window
            .emit_to("main", "redis_toolbar/pushpin_hidden", payload)
            .unwrap();
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
    let primary_monitor = handle.primary_monitor().expect("").unwrap();
    let primary_scale = primary_monitor.scale_factor();
    let primary_height = primary_monitor.size().height as f64;

    let monitor = monitor::get_monitor_with_cursor().expect("fail to obtain monitor [1]");
    let this_scale_factor = monitor.scale_factor();
    let scale_rate = this_scale_factor / primary_scale;

    let pin_window = pin_win_man.fetch_idle_window(key_name.to_string(), &handle);
    let pin_window_position = pin_window.outer_position().unwrap();

    let fix_pos_y = pin_window_position.y as f64 - 18f64 * scale_rate;
    let fix_pos_x = pin_window_position.x as f64 - 18f64 * scale_rate;

    tauri::async_runtime::spawn(async move {
        let press = NSUInteger::from(1u64);
        loop {
            unsafe {
                let mouse_logic_pos = NSEvent::mouseLocation(nil);
                let mouse_status = NSEvent::pressedMouseButtons(nil);
                if !mouse_status.eq(&press) {
                    return;
                }

                let mouse_phy_x = mouse_logic_pos.x * this_scale_factor;
                let mouse_phy_y = mouse_logic_pos.y * this_scale_factor;

                let new_width =
                    (PIN_WINDOW_MIN_WIDTH * this_scale_factor).max(mouse_phy_x - fix_pos_x);
                let new_height = (PIN_WINDOW_MIN_HEIGHT * this_scale_factor)
                    .max((primary_height * scale_rate - mouse_phy_y) - fix_pos_y);

                let size = PhysicalSize::from((new_width, new_height));
                pin_window
                    .set_size::<PhysicalSize<f64>>(size)
                    .expect("fail to resize");
                tokio::time::sleep(Duration::from_millis(1)).await;
            }
        }
    });
}

#[tauri::command]
pub fn on_redis_pushpin_window_shown<R: Runtime>(
    key_name: &str,
    handle: tauri::AppHandle<R>,
    pin_win_man: State<'_, PinnedWindows>,
) -> String {
    match pin_win_man.window_shown(key_name.to_string(), &handle) {
        true => String::from("true"),
        false => String::from("false"),
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
