use tauri::menu::{ContextMenu, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, PhysicalPosition, Runtime, Window};
use tokio::runtime::Handle;

const MID_ADD_STRING: &str = "new_string";
const MID_ADD_HASH: &str = "new_hash";
const MID_ADD_LIST: &str = "new_list";
const MID_ADD_SET: &str = "new_set";
const MID_ADD_ZSET: &str = "new_zset";

#[tauri::command]
pub fn show_key_tree_right_menu<R: Runtime>(
    handle: AppHandle<R>,
    window: Window,
) {
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
    handle: tauri::AppHandle<R>,
    window: Window,
    _x: f64,
    _y: f64,
) {
    let app_handle = handle.app_handle();
    let _pkg_info = app_handle.package_info();
    let menu = Menu::with_items(
        app_handle,
        &[
            &MenuItem::new(app_handle, "Copy Content", true, None::<&str>).unwrap(),
            &MenuItem::new(app_handle, "Copy As", true, None::<&str>).unwrap(),
            &PredefinedMenuItem::separator(app_handle).unwrap(),
            &MenuItem::new(app_handle, "Delete Row", true, None::<&str>).unwrap(),
        ],
    ).unwrap();
    menu.popup(window).unwrap();
}

/// show add new key menu
#[tauri::command]
pub fn show_add_new_key_menu<R: Runtime>(
    handle: tauri::AppHandle<R>,
    window: Window,
) {
    let app_handle = handle.app_handle();
    let _pkg_info = app_handle.package_info();
    let menu = Menu::with_items(
        app_handle,
        &[
            &MenuItem::with_id(app_handle, MID_ADD_STRING, "String", true, None::<&str>).unwrap(),
            &MenuItem::with_id(app_handle, MID_ADD_HASH, "Hash", true, None::<&str>).unwrap(),
            &MenuItem::with_id(app_handle, MID_ADD_LIST, "List", true, None::<&str>).unwrap(),
            &MenuItem::with_id(app_handle, MID_ADD_SET, "Set", true, None::<&str>).unwrap(),
            &MenuItem::with_id(app_handle, MID_ADD_ZSET, "ZSet", true, None::<&str>).unwrap(),
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
