use crate::menu::menu_manager::MenuContext;
use crate::storage::redis_pool::RedisPool;
use crate::{menu, CmdError};
use std::collections::HashMap;
use tauri::menu::{ContextMenu, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Theme::Dark;
use tauri::{AppHandle, Manager, PhysicalPosition, Runtime, State, TitleBarStyle, WebviewUrl, Window};

type Result<T> = std::result::Result<T, CmdError>;

#[tauri::command]
pub async fn show_database_list_menu<R: Runtime>(
    datasource: String,
    handle: AppHandle<R>,
    window: Window,
    menu_context: State<'_, MenuContext>,
    redis_pool: State<'_, RedisPool>,
) -> Result<()> {
    let arc = redis_pool.fetch_connection("datasource01").await;
    let mut con = arc.lock().await;
    let app_handle = handle.app_handle();
    let _pkg_info = app_handle.package_info();

    let mut databases = vec![];
    for i in 0..128 {
        let menu_item = MenuItem::with_id(app_handle, format!("tt@{}", i), format!("DB{} [{}]", i, 32), true, None::<&str>).unwrap();
        databases.push(menu_item);
    }

    let menu = Menu::with_items(
        app_handle,
        &databases.iter().map(|item| item as &dyn IsMenuItem<R>).collect::<Vec<_>>(),
    ).unwrap();
    menu.popup(window).unwrap();
    Ok(())
}

#[tauri::command]
pub fn show_key_tree_right_menu<R: Runtime>(
    datasource: String,
    handle: AppHandle<R>,
    window: Window,
    menu_context: State<'_, MenuContext>,
) {
    let mut context = HashMap::new();
    context.insert(String::from("datasource"), datasource);
    menu_context.set_context(menu::MENU_KEY_TREE_RIGHT_CLICK, context);

    let app_handle = handle.app_handle();
    let _pkg_info = app_handle.package_info();
    let menu = Menu::with_items(
        app_handle,
        &[
            &MenuItem::new(app_handle, "Copy Key Name", true, None::<&str>).unwrap(),
            &MenuItem::new(app_handle, "Rename", true, None::<&str>).unwrap(),
            &MenuItem::new(app_handle, "Duplicate", true, None::<&str>).unwrap(),
            &PredefinedMenuItem::separator(app_handle).unwrap(),
            &MenuItem::new(app_handle, "Delete", true, None::<&str>).unwrap(),
        ],
    ).unwrap();
    menu.popup(window).unwrap();
}

#[tauri::command]
pub fn show_content_editor_menu<R: Runtime>(
    datasource: String,
    key: String,
    field: String,
    value: String,
    handle: tauri::AppHandle<R>,
    window: Window,
    menu_context: State<'_, MenuContext>,
    _x: f64,
    _y: f64,
) {
    let mut context = HashMap::new();
    context.insert(String::from("datasource"), datasource);
    context.insert(String::from("key"), key);
    context.insert(String::from("field"), field);
    context.insert(String::from("value"), value);
    menu_context.set_context(menu::MENU_OPERATOR_MENU, context);

    let app_handle = handle.app_handle();
    let _pkg_info = app_handle.package_info();
    let menu = Menu::with_items(
        app_handle,
        &[
            &MenuItem::with_id(app_handle, menu::MID_KEY_OP_ADD_ROW, "Add Row", true, None::<&str>).unwrap(),
            &Submenu::with_items(app_handle, "Copy As", true, &[
                &MenuItem::with_id(app_handle, menu::MID_KEY_OP_CP_AS_CMD, "Redis Command", true, None::<&str>).unwrap(),
                &MenuItem::with_id(app_handle, menu::MID_KEY_OP_CP_AS_TSV, "TSV", true, None::<&str>).unwrap(),
                &MenuItem::with_id(app_handle, menu::MID_KEY_OP_CP_AS_CSV, "CSV", true, None::<&str>).unwrap(),
            ]).unwrap(),
            &PredefinedMenuItem::separator(app_handle).unwrap(),
            &MenuItem::with_id(app_handle, menu::MID_KEY_OP_DELETE, "Delete Row", true, None::<&str>).unwrap(),
        ],
    ).unwrap();
    menu.popup(window).unwrap();
}

/// show add new key menu
#[tauri::command]
pub fn show_add_new_key_menu<R: Runtime>(
    datasource: String,
    handle: tauri::AppHandle<R>,
    window: Window,
    menu_context: State<'_, MenuContext>,
) {
    let mut context = HashMap::new();
    context.insert(String::from("datasource"), datasource);
    menu_context.set_context(menu::MENU_ADD_NEW_KEY_MENU, context);

    let label = "create-new-key".to_string();

    let inner_size = window.inner_size().unwrap();
    let position = window.outer_position().unwrap();
    let scale_factor = window.scale_factor().unwrap();

    let mut visible = false;
    match window.get_webview_window(&label) {
        None => {
            let url: WebviewUrl = WebviewUrl::App("windows/create-new-key.html".into());
            let w = tauri::webview::WebviewWindowBuilder::new(&handle, label, url)
                .fullscreen(false)
                .hidden_title(true)
                .resizable(false)
                .minimizable(false)
                .transparent(false)
                .title_bar_style(TitleBarStyle::Overlay)
                .theme(Some(Dark))
                .inner_size(410f64, 100f64)
                .visible(false)
                .always_on_top(true)
                .shadow(true)
                .build()
                .unwrap();
            let size = w.inner_size().unwrap();
            let x = (position.x + inner_size.width as i32 / 2 - size.width as i32 / 2) as f64;
            let y = (position.y + inner_size.height as i32 / 2 - size.height as i32 / 2) as f64 - 100f64;
            w.set_position(PhysicalPosition::new(x, y)).unwrap();
        }
        Some(w) => {
            visible = w.is_visible().unwrap();
            if !visible {
                let size = w.inner_size().unwrap();
                let x = (position.x + inner_size.width as i32 / 2 - size.width as i32 / 2) as f64;
                let y = (position.y + inner_size.height as i32 / 2 - size.height as i32 / 2) as f64 - 100f64;
                w.set_position(PhysicalPosition::new(x, y)).unwrap()
            }
        }
    };

    if !visible {
        let app_handle = handle.app_handle();
        let _pkg_info = app_handle.package_info();
        let menu = Menu::with_items(
            app_handle,
            &[
                &MenuItem::with_id(app_handle, menu::MID_ADD_STRING, "String", true, None::<&str>).unwrap(),
                &MenuItem::with_id(app_handle, menu::MID_ADD_HASH, "Hash", true, None::<&str>).unwrap(),
                &MenuItem::with_id(app_handle, menu::MID_ADD_LIST, "List", true, None::<&str>).unwrap(),
                &MenuItem::with_id(app_handle, menu::MID_ADD_SET, "Set", true, None::<&str>).unwrap(),
                &MenuItem::with_id(app_handle, menu::MID_ADD_ZSET, "ZSet", true, None::<&str>).unwrap(),
                &PredefinedMenuItem::separator(app_handle).unwrap(),
                &Submenu::with_items(app_handle, "Import", true, &[
                    &MenuItem::new(app_handle, "Json", true, None::<&str>).unwrap(),
                    &MenuItem::new(app_handle, "Excel", true, None::<&str>).unwrap(),
                    &MenuItem::new(app_handle, "Raw", true, None::<&str>).unwrap(),
                ]).unwrap(),
            ],
        ).unwrap();
        menu.popup(window).unwrap();
    }
}

/// open auto refresh timer on datatable toolkits
#[tauri::command]
pub fn show_auto_refresh_menu<R: Runtime>(
    handle: tauri::AppHandle<R>,
    window: Window,
    x: f64,
    y: f64,
) {
    let app_handle = handle.app_handle();
    let _pkg_info = app_handle.package_info();
    let menu = Menu::with_items(
        app_handle,
        &[
            #[cfg(not(any(
                target_os = "linux",
                target_os = "dragonfly",
                target_os = "freebsd",
                target_os = "netbsd",
                target_os = "openbsd"
            )))]
            &MenuItem::new(app_handle, "5s", true, None::<&str>).unwrap(),
            #[cfg(target_os = "macos")]
            &MenuItem::new(app_handle, "20s", true, None::<&str>).unwrap(),
        ],
    )
        .unwrap();

    menu.popup(window).unwrap();
}
