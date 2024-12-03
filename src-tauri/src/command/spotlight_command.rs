use crate::storage::redis_pool::RedisPool;
use crate::win::window::WebviewWindowExt;
use futures::FutureExt;
use global_hotkey::hotkey::HotKey;
use global_hotkey::GlobalHotKeyEvent;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, PhysicalSize, Runtime, State, Wry};
use tauri_nspanel::ManagerExt;
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};

pub const SPOTLIGHT_LABEL: &str = "spotlight-search";

/// hide spotlight search
#[tauri::command]
pub fn hide_spotlight(app_handle: AppHandle,
                      window: tauri::Window<Wry>,
) {
    let search_win = app_handle.get_webview_window(SPOTLIGHT_LABEL).unwrap();
    let scale_factor = window.scale_factor();

    let size = search_win.inner_size().unwrap();
    let scale = scale_factor.unwrap_or(1f64);
    search_win.set_size(PhysicalSize::new(size.width, (134f64 * scale) as u32)).unwrap();

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

/// binding spotlight shortcut key
pub fn spotlight_key_shortcut(app: &AppHandle, shortcut: &HotKey, event: GlobalHotKeyEvent) {
    if event.state == ShortcutState::Pressed && shortcut.matches(Modifiers::SUPER, Code::KeyK) {
        let panel = app.get_webview_panel(SPOTLIGHT_LABEL).unwrap();

        if panel.is_visible() {
            panel.order_out(None);
        } else {
            let redis_pool: State<'_, RedisPool> = app.state();
            tauri::async_runtime::block_on(async move {
                let active_info = redis_pool.get_active_info().await;

                redis_pool.try_connect(active_info.0, Some(active_info.1)).await;
                redis_pool.get_active_info().then(|r| {
                    async move {
                        let datasource = active_info.0;
                        let database = active_info.1;
                        let resp = json!({"datasource": datasource, "database": database});
                        let window = app.get_webview_window(SPOTLIGHT_LABEL).unwrap();
                        window.eval("console.log('invoke by rust')").expect("fail to eval");

                        // TODO: query from recently.

                        app.emit("spotlight/activated-datasource", resp).expect("fail to emit activated datasource");
                    }
                }).await
            });
            let window = app.get_webview_window(SPOTLIGHT_LABEL).unwrap();
            window.center_at_cursor_monitor().unwrap();
            panel.show();
        }
    }
}
