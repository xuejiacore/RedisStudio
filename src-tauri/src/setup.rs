use crate::tray;
use log::{debug, info};
use redisstudio::indexer::redis_indexer::RedisIndexer;
use redisstudio::indexer::simple_infer_pattern::PatternInferenceEngines;
use redisstudio::indexer::tantivy_indexer::TantivyIndexer;
use redisstudio::menu::menu_manager;
use redisstudio::menu::menu_manager::MenuContext;
use redisstudio::spotlight_command::SPOTLIGHT_LABEL;
use redisstudio::storage::redis_pool::RedisPool;
use redisstudio::storage::sqlite_storage::SqliteStorage;
use redisstudio::view::command::CommandDispatcher;
use redisstudio::win::pinned_windows;
use redisstudio::win::pinned_windows::PinnedWindows;
use redisstudio::win::window::WebviewWindowExt;
use redisstudio::Launcher;
use serde_json::json;
use sqlx::{Connection, Pool};
use ssh2::HostKeyType;
use std::process;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::async_runtime::set;
use tauri::menu::{Menu, MenuId};
use tauri::utils::config::WindowConfig;
use tauri::webview::PageLoadEvent;
use tauri::{window, App, Emitter, Listener, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, Window, WindowEvent, Wry};
use tauri_nspanel::cocoa::appkit::{NSMainMenuWindowLevel, NSWindowCollectionBehavior};
use tauri_nspanel::{panel_delegate, WebviewWindowExt as WebWindowExt};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_sql::Error;
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};

pub type TauriResult<T> = std::result::Result<T, tauri::Error>;

/// setup
pub fn init(app: &mut App<Wry>) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(all(desktop, not(test)))]
    {
        let handle = app.handle();
        tray::create_tray(handle)?;
    }

    init_spotlight_search_window(app);

    let launcher = Launcher::new();
    let command_dispatcher = CommandDispatcher::new(launcher);
    app.manage(command_dispatcher);

    let main_window = initialize_main_and_spotlight_window(app)?;
    init_datasource_window(app)?;
    init_database_selector_window(app)?;

    let splashscreen_window = prepare_splashscreen_window(app);
    splashscreen_window.show()?;

    let config_dir = app.path().app_config_dir().expect("No App path was found!");
    let mut cloned_dir = config_dir.clone();
    let app_handler = app.app_handle();

    // prepare tantivy indexer.
    let _: Result<(), Error> = tauri::async_runtime::block_on(async move {
        let indexer = TantivyIndexer::init(config_dir).init_indexer().await;
        app_handler.manage(indexer.clone());

        // prepare redis datasource's pattern inference engines.
        let engines = PatternInferenceEngines::new();
        let redis_indexer = RedisIndexer::new(Arc::new(Mutex::new(indexer)), Arc::new(Mutex::new(engines)));
        redis_indexer.initialize_datasource_pattern("datasource01").await;
        app_handler.manage(redis_indexer);
        Ok(())
    });

    let cloned_app_handler = app_handler.clone();
    let pinned_windows = PinnedWindows::new();
    pinned_windows.init_pinned_windows(&cloned_app_handler);

    // we perform the initialization code on a new task so the app doesn't freeze
    tauri::async_runtime::spawn(async move {
        cloned_app_handler.manage(pinned_windows);

        splashscreen_window.emit("splashscreen_progress", json!({
            "tips": "connect to sqlite"
        })).unwrap();
        // prepare sqlite connection manager
        let instance = SqliteStorage::default();
        let mut lock = instance.pool.lock().await;
        cloned_dir.push("redisstudio.db");
        let protocol = format!("sqlite:{}", cloned_dir.as_os_str().to_str().unwrap());
        let pool = Pool::connect(&protocol.as_str()).await.unwrap();
        let _ = lock.insert("default".to_string(), pool);
        drop(lock);
        cloned_app_handler.manage(instance);

        splashscreen_window.emit("splashscreen_progress", json!({
            "tips": "connect to redis"
        })).unwrap();
        // prepare redis connection manager.
        let pool = RedisPool::new();
        let client = redis::Client::open("redis://172.31.72.5/10").unwrap();
        let con = client.get_multiplexed_async_connection().await.unwrap();
        pool.add_new_connection("datasource01".into(), con).await;
        cloned_app_handler.manage(pool);

        // initialize your app here instead of sleeping :)
        println!("Initializing...");
        //std::thread::sleep(std::time::Duration::from_secs(10));
        println!("Done initializing.");

        // launch the system, setup and initialize all sub-system
        command_dispatcher.setup();
        splashscreen_window.close().unwrap();
        main_window.show().unwrap();
        splashscreen_window.emit("splashscreen_progress", json!({
            "tips": "connect to redis2"
        })).unwrap();
        //sqlite.initialize();
        // match sqlite.initialize().await {
        //     Ok(()) => {
        //
        //     }
        //     Err(err) => {}
        // };
    });
    //
    // #[cfg(desktop)]
    // app.handle()
    //     .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;

    Ok(())
}

/// initialize main and spotlight windows.
fn initialize_main_and_spotlight_window(app: &mut App) -> TauriResult<WebviewWindow> {
    //spotlight_search_win.hide()?;
    let main_window = app.get_webview_window("main").unwrap();
    // all `Window` types now have the following additional method
    //main_window.restore_state(StateFlags::POSITION | StateFlags::SIZE).unwrap(); // will restore the window's state from disk
    main_window.hide()?;

    main_window.on_window_event(move |event| {
        match event {
            WindowEvent::Resized(_) => {}
            WindowEvent::Moved(_) => {
                //reset_spotlight_search_win_pos();
            }
            WindowEvent::CloseRequested { .. } => {
                info!("--------------- 主窗口关闭 ---------------");
                // `tauri::AppHandle` now has the following additional method
                //&app_handler.save_window_state(StateFlags::POSITION | StateFlags::SIZE); // will save the state of all open windows to disk
                // app_handler.exit(0);
            }
            WindowEvent::Destroyed => {}
            WindowEvent::Focused(_focused) => {}
            WindowEvent::ScaleFactorChanged { .. } => {}
            WindowEvent::ThemeChanged(_) => {}
            _ => {}
        }
    });
    main_window.on_menu_event(move |window, event| {
        println!("点击了菜单：{:?}", &event);
    });
    // 仅在 macOS 下执行
    // #[cfg(target_os = "macos")]
    // window_vibrancy::apply_vibrancy(
    //     &main_window,
    //     NSVisualEffectMaterial::FullScreenUI,
    //     Some(NSVisualEffectState::FollowsWindowActiveState),
    //     Some(0.5),
    // ).expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

    // 仅在 windows 下执行
    #[cfg(target_os = "windows")]
    window_vibrancy::apply_blur(&win, Some((18, 18, 18, 125)))
        .expect("Unsupported platform! 'apply_blur' is only supported on Windows");
    Ok(main_window)
}

fn init_datasource_window(app: &mut App) -> TauriResult<()> {
    let datasource_dropdown_win = app.get_webview_window("datasource-dropdown").unwrap();
    datasource_dropdown_win.hide()?;

    let cloned_win = datasource_dropdown_win.clone();
    datasource_dropdown_win.on_window_event(move |event| match event {
        WindowEvent::Resized(_) => {}
        WindowEvent::Moved(_) => {}
        WindowEvent::CloseRequested { .. } => {}
        WindowEvent::Destroyed => {}
        WindowEvent::Focused(focused) => {
            if !focused {
                cloned_win.hide().unwrap();
            }
        }
        WindowEvent::ScaleFactorChanged { .. } => {}
        WindowEvent::ThemeChanged(_) => {}
        _ => {}
    });
    Ok(())
}

fn init_database_selector_window(app: &mut App) -> TauriResult<()> {
    let datasource_dropdown_win = app.get_webview_window("datasource-database-selector").unwrap();
    datasource_dropdown_win.hide()?;

    let cloned_win = datasource_dropdown_win.clone();
    datasource_dropdown_win.on_window_event(move |event| match event {
        WindowEvent::Resized(_) => {}
        WindowEvent::Moved(_) => {}
        WindowEvent::CloseRequested { .. } => {}
        WindowEvent::Destroyed => {}
        WindowEvent::Focused(focused) => {
            if !focused {
                cloned_win.hide().unwrap();
            }
        }
        WindowEvent::ScaleFactorChanged { .. } => {}
        WindowEvent::ThemeChanged(_) => {}
        _ => {}
    });
    Ok(())
}


fn init_spotlight_search_window(app: &mut App) {
    let handle = app.app_handle();

    let window = handle.get_webview_window(SPOTLIGHT_LABEL).unwrap();

    // Convert the window to a spotlight panel
    let panel = window.to_spotlight_panel().unwrap();

    handle.listen(format!("{}_panel_did_resign_key", SPOTLIGHT_LABEL), move |_| {
        // Hide the panel when it's no longer the key window
        // This ensures the panel doesn't remain visible when it's not actively being used
        panel.order_out(None);
    });
}
const WEBVIEW_URL: &str = "windows/redis-pin.html";

fn init_key_pin_window(app: &mut App) {
    let url: WebviewUrl = WebviewUrl::App(WEBVIEW_URL.into());
    let window = tauri::webview::WebviewWindowBuilder::new(app, "key_pinned_window2".to_string(), url)
        .title(format!("pin_{}", 1))
        .inner_size(410f64, 290f64)
        .min_inner_size(410f64, 170f64)
        .transparent(false)
        .visible(false)
        .decorations(false)
        .always_on_top(true)
        .shadow(true)
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
}

fn prepare_splashscreen_window(app: &mut App) -> WebviewWindow {
    app.get_webview_window("splashscreen").unwrap()
}