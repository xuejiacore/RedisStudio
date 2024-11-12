use crate::utils::system::constant::{PIN_WINDOW_MIN_HEIGHT, PIN_WINDOW_MIN_WIDTH};
use std::collections::HashMap;
use std::sync::atomic::AtomicI16;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindow};
use tauri_nspanel::cocoa::appkit::{NSMainMenuWindowLevel, NSWindowCollectionBehavior};
use tauri_nspanel::{panel_delegate, ManagerExt, WebviewWindowExt as WebWindowExt};

const WEBVIEW_URL: &str = "windows/redis-pin.html";
const CORE_SIZE: usize = 2;
const MAX_SIZE: usize = 15;

pub struct PinnedWindows {
    win_label_mapping: Arc<Mutex<HashMap<String, Option<String>>>>,
    runtime_label_mapping: Arc<Mutex<HashMap<String, String>>>,
    serial: AtomicI16,
}

impl PinnedWindows {
    pub fn new() -> Self {
        PinnedWindows {
            win_label_mapping: Arc::new(Mutex::new(HashMap::new())),
            runtime_label_mapping: Arc::new(Mutex::new(HashMap::new())),
            serial: AtomicI16::new(0),
        }
    }

    pub fn init_pinned_windows<R: Runtime, M: Manager<R>>(&self, manager: &M) {
        for _ in 0..CORE_SIZE {
            self.create_new_pinned_window(manager);
        }
    }

    pub fn create_new_pinned_window<R: Runtime, M: Manager<R>>(&self, manager: &M) -> String {
        let current_serial = self.serial.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let label = format!("pinned_win_{}", current_serial);

        let url: WebviewUrl = WebviewUrl::App(WEBVIEW_URL.into());
        let window = tauri::webview::WebviewWindowBuilder::new(manager, label.clone(), url)
            .inner_size(PIN_WINDOW_MIN_WIDTH, PIN_WINDOW_MIN_HEIGHT)
            .min_inner_size(PIN_WINDOW_MIN_WIDTH, PIN_WINDOW_MIN_HEIGHT)
            .transparent(true)
            .visible(false)
            .decorations(false)
            .always_on_top(true)
            .shadow(true)
            .resizable(true)
            .initialization_script(r#"
                window._REDIS_PIN_WIN_ATTR = {"key_name":"undefined","key_type":"undefined"}
            "#)
            .build()
            .unwrap();

        // Convert window to panel
        let panel = window.to_panel().unwrap();

        // Set panel level
        panel.set_level(NSMainMenuWindowLevel + 1);

        // Allows the panel to display on the same space as the full screen window
        panel.set_collection_behaviour(
            NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary,
        );

        #[allow(non_upper_case_globals)]
        const NSWindowStyleMaskNonActivatingPanel: i32 = 1 << 7;

        // Ensures the panel cannot activate the App
        panel.set_style_mask(NSWindowStyleMaskNonActivatingPanel);

        // Set up a delegate to handle key window events for the panel
        //
        // This delegate listens for two specific events:
        // 1. When the panel becomes the key window
        // 2. When the panel resigns as the key window
        //
        // For each event, it emits a corresponding custom event to the app,
        // allowing other parts of the application to react to these panel state changes.

        let panel_delegate = panel_delegate!(SpotlightPanelDelegate {
            window_did_resign_key,
            window_did_become_key
        });

        panel_delegate.set_listener(Box::new(move |delegate_name: String| {
            match delegate_name.as_str() {
                "window_did_become_key" => {
                    // let _ = app_handle.emit(format!("{}_panel_did_become_key", label).as_str(), ());
                }
                "window_did_resign_key" => {
                    // let _ = app_handle.emit(format!("{}_panel_did_resign_key", label).as_str(), ());
                }
                _ => (),
            }
        }));

        panel.set_delegate(panel_delegate);

        {
            let mut map = self.win_label_mapping.lock().unwrap();
            map.insert(label.clone(), None);
        }

        label
    }

    pub fn window_shown<R: Runtime>(&self, runtime_label: String, handle: &AppHandle<R>) -> bool {
        let exists_win = {
            let mut rlm = self.runtime_label_mapping.lock().unwrap();
            match rlm.get(&runtime_label) {
                None => None,
                Some(l) => Some(l.clone())
            }
        };
        if let Some(win_label) = exists_win {
            let panel = handle.get_webview_panel(win_label.as_str()).unwrap();
            panel.is_visible()
        } else {
            false
        }
    }

    pub fn fetch_idle_window<R: Runtime>(&self, runtime_label: String, handle: &AppHandle<R>) -> WebviewWindow<R> {
        let exists_win = {
            let mut rlm = self.runtime_label_mapping.lock().unwrap();
            match rlm.get(&runtime_label) {
                None => None,
                Some(l) => Some(l.clone())
            }
        };
        if let Some(win_label) = exists_win {
            return handle.get_webview_window(win_label.as_str()).unwrap();
        }
        let mut window_label: Option<String> = None;
        let mut size = 0;
        let mut using_count = 0;
        {
            let mut map_lock = self.win_label_mapping.lock().unwrap();
            size = map_lock.len();
            using_count = map_lock.iter().filter(|t| t.1.is_some()).count();
            for (key, value) in map_lock.iter_mut() {
                if value.is_none() {
                    *value = Some(runtime_label.clone());
                    window_label = Some(key.clone());
                    {
                        let mut rlm = self.runtime_label_mapping.lock().unwrap();
                        rlm.insert(runtime_label.clone(), key.clone());
                    }
                    break;
                }
            }
        }

        if window_label.is_none() {
            if size > MAX_SIZE {
                panic!("No available window.");
            }

            let label = self.create_new_pinned_window(handle);
            window_label = Some(label);
        } else if using_count == size - 1 && size + 1 < MAX_SIZE {
            self.create_new_pinned_window(handle);
        }

        let label = window_label.unwrap();
        handle.get_webview_window(label.as_str()).unwrap()
    }

    pub fn return_window(&self, runtime_label: String) {
        let window_label = {
            let mut rlm = self.runtime_label_mapping.lock().unwrap();
            rlm.remove(&runtime_label)
        };

        match window_label {
            None => {}
            Some(label) => {
                let mut map_lock = self.win_label_mapping.lock().unwrap();
                let entry_opt = map_lock.get_mut(&label);
                let t = entry_opt.unwrap().clone();
                if t.is_some() {
                    map_lock.insert(label, None);
                }
            }
        }
    }
}