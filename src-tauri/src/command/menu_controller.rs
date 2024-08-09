use tauri::menu::{ContextMenu, Menu, MenuItem, PredefinedMenuItem};
use tauri::{Manager, PhysicalPosition, Runtime, Window};

#[tauri::command]
pub fn show_content_editor_menu<R: Runtime>(
    handle: tauri::AppHandle<R>,
    window: Window,
    x: f64,
    y: f64,
) {
    let app_handle = handle.app_handle();
    let pkg_info = app_handle.package_info();
    let menu = Menu::with_items(
        app_handle,
        &[
            &MenuItem::new(app_handle, "Copy Content", true, None::<&str>).unwrap(),
            &MenuItem::new(app_handle, "Copy As", true, None::<&str>).unwrap(),
            &PredefinedMenuItem::separator(app_handle).unwrap(),
            &MenuItem::new(app_handle, "Delete Row", true, None::<&str>).unwrap(),
        ],
    )
    .unwrap();
    menu.popup(window).unwrap();
}

#[tauri::command]
pub fn show_auto_refresh_menu<R: Runtime>(
    handle: tauri::AppHandle<R>,
    window: Window,
    x: f64,
    y: f64,
) {
    let app_handle = handle.app_handle();
    let pkg_info = app_handle.package_info();
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

    menu.popup_at(window, PhysicalPosition::new(x as i32, y as i32))
        .unwrap();
}
