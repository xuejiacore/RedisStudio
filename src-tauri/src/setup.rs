use crate::tray;
use log::{debug, info};
use redisstudio::indexer::redis_indexer::RedisIndexer;
use redisstudio::indexer::simple_infer_pattern::PatternInferenceEngines;
use redisstudio::indexer::tantivy_indexer::TantivyIndexer;
use redisstudio::menu::menu_manager;
use redisstudio::menu::menu_manager::MenuManager;
use redisstudio::storage::redis_pool::RedisPool;
use redisstudio::storage::sqlite_storage::SqliteStorage;
use redisstudio::view::command::CommandDispatcher;
use redisstudio::Launcher;
use sqlx::{Connection, Pool};
use std::process;
use std::sync::{Arc, Mutex};
use tauri::async_runtime::set;
use tauri::menu::{Menu, MenuId};
use tauri::{App, Manager, PhysicalPosition, Window, WindowEvent, Wry};
use tauri_plugin_sql::Error;
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};
use window_vibrancy::{self, NSVisualEffectMaterial, NSVisualEffectState};

pub type TauriResult<T> = std::result::Result<T, tauri::Error>;

/// setup
pub fn init(app: &mut App<Wry>) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(all(desktop, not(test)))]
    {
        let handle = app.handle();
        tray::create_tray(handle)?;
    }

    let launcher = Launcher::new();
    let command_dispatcher = CommandDispatcher::new(launcher);
    app.manage(command_dispatcher);

    let main_window = initialize_main_and_spotlight_window(app)?;
    init_datasource_window(app)?;
    init_database_selector_window(app)?;

    // let _redis_value_editor = init_redis_value_editor_window(app);
    // _redis_value_editor.hide()?;
    let splashscreen_window = app.get_window("splashscreen").unwrap();
    splashscreen_window.hide()?;

    let config_dir = app.path().app_config_dir().expect("No App path was found!");
    let mut cloned_dir = config_dir.clone();
    let app_handler = app.app_handle();

    // prepare sqlite connection manager
    let _: Result<(), Error> = tauri::async_runtime::block_on(async move {
        let instance = SqliteStorage::default();
        let mut lock = instance.pool.lock().await;
        cloned_dir.push("redisstudio.db");
        let protocol = format!("sqlite:{}", cloned_dir.as_os_str().to_str().unwrap());
        let pool = Pool::connect(&protocol.as_str()).await?;
        let _ = lock.insert("default".to_string(), pool);
        drop(lock);
        app_handler.manage(instance);
        Ok(())
    });

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

    // prepare redis connection manager.
    let _: Result<(), Error> = tauri::async_runtime::block_on(async move {
        let pool = RedisPool::new();
        let client = redis::Client::open("redis://172.31.72.5/10").unwrap();
        let con = client.get_multiplexed_async_connection().await.unwrap();
        pool.add_new_connection("test".into(), con).await;
        app_handler.manage(pool);
        Ok(())
    });

    // we perform the initialization code on a new task so the app doesn't freeze
    tauri::async_runtime::spawn(async move {
        splashscreen_window.show().unwrap();
        // initialize your app here instead of sleeping :)
        println!("Initializing...");
        //std::thread::sleep(std::time::Duration::from_secs(10));
        println!("Done initializing.");

        // launch the system, setup and initialize all sub-system
        command_dispatcher.setup();
        splashscreen_window.close().unwrap();
        main_window.show().unwrap();
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
fn initialize_main_and_spotlight_window(app: &mut App) -> TauriResult<Window> {
    let spotlight_search_win = init_spotlight_search_window(app);
    spotlight_search_win.hide()?;
    let main_window = app.get_window("main").unwrap();
    // all `Window` types now have the following additional method
    //main_window.restore_state(StateFlags::POSITION | StateFlags::SIZE).unwrap(); // will restore the window's state from disk
    main_window.hide()?;
    let cloned_main_win = main_window.clone();
    let cloned_search_win = spotlight_search_win.clone();
    let reset_spotlight_search_win_pos = move || {
        // 重新计算窗口的位置
        let monitor = cloned_main_win.current_monitor().unwrap().unwrap();
        let search_win_inner_size = cloned_search_win.inner_size().unwrap();
        let screen = monitor.size();
        let m_pos = monitor.position();
        let semi_width = search_win_inner_size.width as i32 / 2;
        let (new_x, new_y) = (
            m_pos.x + (screen.width as i32 / 2).abs() - semi_width,
            m_pos.y + (screen.height / 4) as i32,
        );
        let new_pos = PhysicalPosition { x: new_x, y: new_y };
        cloned_search_win.set_position(new_pos).unwrap();
    };
    reset_spotlight_search_win_pos();
    let app_handler = app.handle().clone();
    main_window.on_window_event(move |event| {
        match event {
            WindowEvent::Resized(_) => {}
            WindowEvent::Moved(_) => {
                reset_spotlight_search_win_pos();
            }
            WindowEvent::CloseRequested { .. } => {
                info!("--------------- 主窗口关闭 ---------------");
                // `tauri::AppHandle` now has the following additional method
                //&app_handler.save_window_state(StateFlags::POSITION | StateFlags::SIZE); // will save the state of all open windows to disk
                app_handler.exit(0);
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
    #[cfg(target_os = "macos")]
    window_vibrancy::apply_vibrancy(
        &main_window,
        NSVisualEffectMaterial::FullScreenUI,
        Some(NSVisualEffectState::FollowsWindowActiveState),
        Some(0.5),
    ).expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

    // 仅在 windows 下执行
    #[cfg(target_os = "windows")]
    window_vibrancy::apply_blur(&win, Some((18, 18, 18, 125)))
        .expect("Unsupported platform! 'apply_blur' is only supported on Windows");
    Ok(main_window)
}

fn init_datasource_window(app: &mut App) -> TauriResult<()> {
    let datasource_dropdown_win = app.get_window("datasource-dropdown").unwrap();
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
    let datasource_dropdown_win = app.get_window("datasource-database-selector").unwrap();
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


fn init_spotlight_search_window(app: &mut App) -> Window {
    let win = app.get_window("spotlight-search").unwrap();
    let cloned_spotlight_win = win.clone();
    win.on_window_event(move |event| match event {
        WindowEvent::Resized(_) => {}
        WindowEvent::Moved(_) => {}
        WindowEvent::CloseRequested { .. } => {}
        WindowEvent::Destroyed => {}
        WindowEvent::Focused(focused) => {
            if !focused {
                cloned_spotlight_win.hide().unwrap();
            }
        }
        WindowEvent::ScaleFactorChanged { .. } => {}
        WindowEvent::ThemeChanged(_) => {}
        _ => {}
    });
    win
}
