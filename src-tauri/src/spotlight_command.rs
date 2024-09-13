use tauri::AppHandle;
use tauri_nspanel::ManagerExt;

pub const SPOTLIGHT_LABEL: &str = "spotlight-search";

#[tauri::command]
pub fn show_spotlight(app_handle: AppHandle) {
    let panel = app_handle.get_webview_panel(SPOTLIGHT_LABEL).unwrap();

    panel.show();
}

#[tauri::command]
pub fn hide_spotlight(app_handle: AppHandle) {
    let panel = app_handle.get_webview_panel(SPOTLIGHT_LABEL).unwrap();

    if panel.is_visible() {
        panel.order_out(None);
    }
}
