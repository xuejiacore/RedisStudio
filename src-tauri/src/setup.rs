use crate::tray;
use chrono::Utc;
use redis::cmd;
use redisstudio::indexer::redis_indexer::RedisIndexer;
use redisstudio::indexer::simple_infer_pattern::PatternInferenceEngines;
use redisstudio::indexer::tantivy_indexer::TantivyIndexer;
use redisstudio::menu::main_menu;
use redisstudio::menu::menu_manager::MenuContext;
use redisstudio::spotlight_command::SPOTLIGHT_LABEL;
use redisstudio::storage::redis_pool::{DataSourceManager, RedisPool};
use redisstudio::storage::sqlite_storage::SqliteStorage;
use redisstudio::utils::redis_util;
use redisstudio::view::command::CommandDispatcher;
use redisstudio::win::pinned_windows::PinnedWindows;
use redisstudio::win::window::WebviewWindowExt;
use redisstudio::Launcher;
use serde_json::json;
use sqlx::{Connection, Pool};
use std::collections::HashSet;
use std::fs;
use std::ops::DerefMut;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{App, AppHandle, Emitter, Listener, Manager, State, WebviewWindow, WindowEvent, Wry};
use tauri_plugin_sql::Error;
use tauri_plugin_store::StoreExt;
use tokio::time;

pub type TauriResult<T> = std::result::Result<T, tauri::Error>;

/// setup
pub fn init(app: &mut App<Wry>) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(all(desktop, not(test)))]
    {
        let handle = app.handle();
        tray::create_tray(handle)?;
    }

    let package_info = app.package_info();
    let env = app.env();
    let resource_dir = tauri::utils::platform::resource_dir(package_info, &env).unwrap();
    println!("{:?}", resource_dir);
    let resource_path = resource_dir.join("resources/default_setting.json");
    let content = fs::read_to_string(&resource_path)?;
    let json: serde_json::Value = serde_json::from_str(&content)?;
    println!("读取资源数据: {}", json);

    // Create a new store or load the existing one
    // this also put the store in the app's resource table
    // so your following calls `store` calls (from both rust and js)
    // will reuse the same store
    let store = app.store(resource_path)?;
    // Note that values must be serde_json::Value instances,
    // otherwise, they will not be compatible with the JavaScript bindings.
    // store.set("some-key", json!({ "value": 5 }));

    // Get a value from the store.
    // let value = store.get("some-key").expect("Failed to get value from store");
    // println!("{}", value); // {"value":5}

    // Remove the store from the resource table
    store.close_resource();

    init_spotlight_search_window(app);

    let launcher = Launcher::new();
    let command_dispatcher = CommandDispatcher::new(launcher);
    app.manage(command_dispatcher);

    let main_window = initialize_main_window(app)?;
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

        // menu context manager
        let menu_context = MenuContext::new();
        cloned_app_handler.manage(menu_context);

        splashscreen_window.emit("splashscreen_progress", json!({
            "tips": "connect to redis"
        })).unwrap();

        prepare_datasource_manager(cloned_app_handler, protocol.as_str()).await;

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
    });
    Ok(())
}

async fn prepare_datasource_manager(cloned_app_handler: AppHandle, connect_protocol: &str) {
    let datasource_manager = DataSourceManager::with_protocol(connect_protocol).await;
    let cloned_for_connection_mgr = cloned_app_handler.clone();
    let redis_connection_pool = RedisPool::new(datasource_manager, Arc::new(tokio::sync::Mutex::new(move |s, d| {
        let payload = json!({"datasource": s, "database": d});
        cloned_for_connection_mgr.emit("connection/lost", payload).unwrap();
    })));
    cloned_app_handler.manage(redis_connection_pool);

    let stat_interval = Duration::from_secs(3);
    // start datasource stat
    tokio::spawn(async move {
        let mut interval = time::interval(stat_interval);
        loop {
            interval.tick().await;
            let redis_pool: State<RedisPool> = cloned_app_handler.state();
            let keys = redis_pool.get_all_connection_infos().await;

            let mut processed = HashSet::<String>::new();
            let pool = redis_pool.get_pool().await;
            for db_key in keys {
                let datasource = db_key.split("#").collect::<Vec<&str>>().get(0)
                    .expect("unrecognized pattern").to_string();

                if processed.contains(&datasource) {
                    continue;
                }

                if let Some(arc) = pool.get(&db_key) {
                    if let Ok(mut connection) = arc.try_lock() {
                        let result = cmd("INFO").query_async::<String>(connection.deref_mut()).await;
                        if let Ok(info) = result {
                            if let Some(i) = redis_util::parse_redis_info(info) {
                                let now = Utc::now();
                                let timestamp_millis = now.timestamp_millis();
                                let payload = json!({"datasource": &datasource, "info": i, "sample_ts": timestamp_millis});
                                cloned_app_handler.emit("datasource/info", payload).unwrap();
                            }
                        }
                        processed.insert(datasource);
                    }
                }
            }
        }
    });
}

/// initialize main and spotlight windows.
fn initialize_main_window(app: &mut App) -> TauriResult<WebviewWindow> {
    let main_window = app.get_webview_window("main").unwrap();
    // all `Window` types now have the following additional method
    //main_window.restore_state(StateFlags::POSITION | StateFlags::SIZE).unwrap(); // will restore the window's state from disk
    main_window.hide()?;

    main_window.on_window_event(move |event| {
        match event {
            WindowEvent::Resized(_) => {}
            WindowEvent::Moved(_) => {}
            WindowEvent::CloseRequested { .. } => {
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
        // process main window's menu event.
        let window = window.clone();
        let event = event.clone();
        tauri::async_runtime::spawn(async move {
            main_menu::process_main_menu(&window, event).await;
        });
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

    window.on_window_event(move |event| match event {
        WindowEvent::Resized(_) => {}
        WindowEvent::Moved(_) => {}
        WindowEvent::CloseRequested { .. } => {
            println!("CloseRequested");
        }
        WindowEvent::Destroyed => {}
        WindowEvent::Focused(focused) => {
            println!("Focused {}", focused);
        }
        WindowEvent::ScaleFactorChanged { .. } => {}
        WindowEvent::ThemeChanged(_) => {}
        _ => {}
    });
    // Convert the window to a spotlight panel
    let panel = window.to_spotlight_panel().unwrap();

    handle.listen(format!("{}_panel_did_resign_key", SPOTLIGHT_LABEL), move |_| {
        // Hide the panel when it's no longer the key window
        // This ensures the panel doesn't remain visible when it's not actively being used
        panel.order_out(None);
    });
}

fn prepare_splashscreen_window(app: &mut App) -> WebviewWindow {
    app.get_webview_window("splashscreen").unwrap()
}