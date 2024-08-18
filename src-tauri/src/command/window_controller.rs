// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rand::distributions::Uniform;
use rand::Rng;
use tauri::utils::config::WindowConfig;
use tauri::webview::PageLoadEvent;
use tauri::{LogicalPosition, LogicalSize, Manager, PhysicalPosition, Position, Runtime, Size, WindowEvent, Wry};

const REDIS_PIN_LABEL_PREFIX: &str = "redispin_win:";

#[tauri::command]
pub fn open_datasource_window<R: Runtime>(x: f64, y: f64, handle: tauri::AppHandle<R>) {
    let window = handle.get_window("datasource-dropdown");
    match window {
        None => {}
        Some(win) => {
            let main_window = handle.get_window("main").unwrap();
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
    let window = handle.get_window("datasource-database-selector");
    match window {
        None => {}
        Some(win) => {
            let main_window = handle.get_window("main").unwrap();
            let pos = main_window.outer_position().unwrap();
            let log_pos: LogicalPosition<f64> = LogicalPosition::from_physical(pos, main_window.scale_factor().unwrap());
            win.set_size(Size::Logical(LogicalSize::new(140f64, 300f64))).unwrap();
            win.set_position(Position::Logical(LogicalPosition::new(x + log_pos.x, y + log_pos.y - 4f64))).unwrap();
            win.show().unwrap();
        }
    }
}

#[tauri::command]
pub fn prepare_pin_window<R: Runtime>(key_name: &str, key_type: &str, handle: tauri::AppHandle<R>) {
    let label: String = get_window_label(key_name);
    let win_cached = handle.get_window(&label);

    if win_cached.is_none() {
        let mut config = WindowConfig::default();

        // 预备一个窗口
        config.label = label.clone();
        config.title = label.clone();
        config.decorations = false;
        config.visible = false;
        config.always_on_top = true;
        config.width = 410f64;
        config.height = 290f64;
        config.min_width = Some(410f64);
        config.min_height = Some(170f64);
        // set transparent title bar only when building for macOS
        // #[cfg(target_os = "macos")]
        // config.title_bar_style = TitleBarStyle::Transparent;
        // #[cfg(not(target_os = "macos"))]
        // config.title_bar_style = TitleBarStyle::Overlay;
        config.transparent = false;
        config.shadow = true;

        let webview_url = tauri::WebviewUrl::App("windows/redis-pin.html".into());
        config.url = webview_url;
        let window = tauri::window::WindowBuilder::from_config(&handle, &config)
            .unwrap()
            .build()
            .unwrap();
        window.on_window_event(move |event| match event {
            WindowEvent::Resized(v) => {}
            WindowEvent::Moved(_) => {}
            WindowEvent::CloseRequested { .. } => {}
            WindowEvent::Destroyed => {}
            WindowEvent::Focused(focused) => {}
            WindowEvent::ScaleFactorChanged { .. } => {}
            WindowEvent::ThemeChanged(_) => {}
            _ => {}
        });

        // creat new webview to the window.
        let mut init_script: String = String::from(
            r#"
                window._REDIS_PIN_WIN_ATTR = { key_name: '"#,
        );
        init_script.push_str(key_name);
        init_script.push_str("', key_type: '");
        init_script.push_str(key_type);
        init_script.push_str("'}");

        let webview_builder = tauri::webview::WebviewBuilder::from_config(&config)
            .initialization_script(init_script.as_str())
            .on_page_load(move |webview, payload| {
                match payload.event() {
                    PageLoadEvent::Started => {
                        //println!("{} Started loading", payload.url());
                    }
                    PageLoadEvent::Finished => {
                        //println!("{} Finished loading", payload.url());
                        //cloned.show().unwrap();
                    }
                }
            })
            .auto_resize();

        let _ = window
            .add_child(
                webview_builder,
                tauri::LogicalPosition::new(0, 0),
                window.inner_size().unwrap(),
            )
            .unwrap();
    }
}

/// open the redis pushpin window, always on the top.
#[tauri::command]
pub fn open_redis_pushpin_window<R: Runtime>(
    key_name: &str,
    key_type: &str,
    handle: tauri::AppHandle<R>,
    window: tauri::Window<Wry>,
) {
    let label: String = get_window_label(key_name);
    let exists_window = handle.get_window(&label);
    match exists_window {
        None => panic!("窗口不存在"),
        Some(win) => match win.is_visible() {
            Ok(visible) => {
                if !visible {
                    let main_win = handle.get_window("main").unwrap();
                    let inner_size = main_win.inner_size().unwrap();
                    let inner_position = main_win.inner_position().unwrap();

                    let curr_win_size = win.inner_size().unwrap();

                    let mut rng = rand::thread_rng();
                    let low = -50;
                    let high = 50;
                    let random_x_offset = rng.sample(Uniform::new(low, high));
                    let random_y_offset = rng.sample(Uniform::new(low, high));

                    let new_x = inner_position.x + (inner_size.width as i32) / 2
                        - (curr_win_size.width as i32) / 2
                        + random_x_offset;
                    let new_y = inner_position.y + (inner_size.height as i32) / 2
                        - (curr_win_size.height as i32) / 2
                        + random_y_offset;
                    let new_pos = PhysicalPosition { x: new_x, y: new_y };
                    win.set_position(new_pos).unwrap();
                    win.show().unwrap();
                }
            }
            Err(_) => {}
        },
    }
}

/// close the redis pushpin window, by provided key name of the window.
#[tauri::command]
pub fn close_redis_pushpin_window<R: Runtime>(
    key_name: &str,
    only_hide: bool,
    handle: tauri::AppHandle<R>,
    window: tauri::Window<Wry>,
) {
    let label = get_window_label(key_name);
    let exists_window = handle.get_window(&label);
    let is_visible = exists_window.map_or(true, |w| w.is_visible().unwrap());

    let mut release_window = false;
    if !is_visible && !only_hide {
        let exists_webview_window = handle.get_webview(&label);
        match exists_webview_window {
            None => {}
            Some(webview) => {
                match webview.close() {
                    Ok(_) => release_window = true,
                    Err(e) => panic!("Exception {:?}", e),
                };
            }
        }
    }

    let exists_window = handle.get_window(&label);
    match exists_window {
        None => {}
        Some(win) => {
            if is_visible && only_hide {
                win.hide().unwrap();
                window.emit("redis_pushpin_hidden", key_name).unwrap();
            } else {
                if !is_visible && !only_hide {
                    match win.close() {
                        Ok(_) => {
                            println!("窗口 {:?} 关闭", key_name);
                        }
                        Err(e) => panic!("Exception {:?}", e),
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub fn on_redis_pushpin_window_shown<R: Runtime>(
    key_name: &str,
    handle: tauri::AppHandle<R>,
) -> String {
    let label = get_window_label(key_name);
    let window = handle.get_window(label.clone().as_str());
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
