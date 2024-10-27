use tauri::{AppHandle, Manager, PhysicalSize, Runtime, Wry};
use tauri_nspanel::ManagerExt;

pub const SPOTLIGHT_LABEL: &str = "spotlight-search";

#[tauri::command]
pub fn hide_spotlight(app_handle: AppHandle,
                      window: tauri::Window<Wry>,
) {
    let search_win = app_handle.get_webview_window(SPOTLIGHT_LABEL).unwrap();
    let scale_factor = window.scale_factor();

    let size = search_win.inner_size().unwrap();
    let scale = scale_factor.unwrap_or(1f64);
    search_win.set_size(PhysicalSize::new(size.width, (128f64 * scale) as u32)).unwrap();

    let panel = app_handle.get_webview_panel(SPOTLIGHT_LABEL).unwrap();

    if panel.is_visible() {
        panel.order_out(None);
    }
}

#[tauri::command]
pub async fn resize_spotlight_window<R: Runtime>(
    height: u32,
    handle: tauri::AppHandle<R>,
    window: tauri::Window<Wry>,
) {
    let search_win = handle.get_webview_window(SPOTLIGHT_LABEL).unwrap();
    let scale_factor = window.scale_factor();

    let size = search_win.inner_size().unwrap();
    let scale = scale_factor.unwrap_or(1f64);
    search_win.set_size(PhysicalSize::new(size.width, (height as f64 * scale) as u32)).unwrap();
    search_win.set_focus().unwrap();
}
