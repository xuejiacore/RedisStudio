use crate::dao::data_view_dao::query_data_view_by_id;
use crate::menu::menu_manager::MenuContext;
use crate::storage::redis_pool::RedisPool;
use crate::storage::sqlite_storage::SqliteStorage;
use crate::{menu, CmdError, CmdResult};
use redis::cmd;
use std::collections::HashMap;
use tauri::menu::{ContextMenu, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Theme::Dark;
use tauri::{
    AppHandle, Manager, PhysicalPosition, Runtime, State, TitleBarStyle, WebviewUrl, Window,
};

type Result<T> = std::result::Result<T, CmdError>;

/// show data view manager context menu
#[tauri::command]
pub fn show_data_view_mgr_menu<R: Runtime>(
    window: Window,
    handle: AppHandle<R>,
    menu_context: State<'_, MenuContext>,
) {
    let app_handle = handle.app_handle();
    let menu = Menu::with_items(
        app_handle,
        &[
            &MenuItem::with_id(
                app_handle,
                menu::MID_ADD_DV,
                "Create Data View",
                true,
                None::<&str>,
            )
                .unwrap(),
            &MenuItem::with_id(
                app_handle,
                menu::MID_CONFIG_DV,
                "Config Data View",
                true,
                None::<&str>,
            )
                .unwrap(),
            &PredefinedMenuItem::separator(app_handle).unwrap(),
            &MenuItem::with_id(app_handle, menu::MID_DEL_DV, "Delete", true, None::<&str>).unwrap(),
        ],
    )
        .unwrap();
    menu.popup(window).unwrap();
}

/// show data view right click context menu
#[tauri::command]
pub async fn show_data_view_right_click_menu<R: Runtime>(
    key: String,
    data_view_id: Option<i64>,
    win_id: i64,
    window: Window,
    handle: AppHandle<R>,
    menu_context: State<'_, MenuContext>,
    redis_pool: State<'_, RedisPool>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<()> {
    let mut context = HashMap::new();
    context.insert(String::from("win"), win_id.to_string());
    let dvid = data_view_id.clone().unwrap_or(0);
    context.insert(String::from("data_view_id"), dvid.to_string());
    context.insert(String::from("key"), key.clone());

    menu_context.set_context(menu::MENU_DATA_VIEW_R_CLK, context);
    let app_handle = handle.app_handle();
    let _pkg_info = app_handle.package_info();

    let view = query_data_view_by_id(data_view_id.unwrap(), sqlite).await
        .expect("Failed to query data view")
        .expect("No data view found");
    let mut connection = redis_pool.select_connection(view.datasource, Some(view.database)).await;
    let key_exists: bool = cmd("EXISTS").arg(key.clone()).query_async(&mut connection).await
        .unwrap();

    let is_data_view_dir = true;

    let mut menus: Vec<Box<dyn IsMenuItem<R>>> = vec![];
    if is_data_view_dir {
        menus.push(Box::new(MenuItem::with_id(app_handle, menu::MID_DV_EXPAND_ALL, "Expand All", true, None::<&str>).unwrap()));
    }

    menus.push(Box::new(MenuItem::with_id(app_handle, menu::MID_ADD_DV_ITEM, "Add View Item", true, None::<&str>).unwrap()));
    menus.push(Box::new(MenuItem::with_id(app_handle, menu::MID_MOD_DV_ITEM, "Edit Data View", true, None::<&str>).unwrap()));

    if !key_exists {
        menus.push(Box::new(PredefinedMenuItem::separator(app_handle).unwrap()));
        menus.push(Box::new(MenuItem::with_id(app_handle, menu::MID_MOD_INIT_ITEM, "New Key", true, None::<&str>).unwrap()));
    } else {
        menus.push(Box::new(PredefinedMenuItem::separator(app_handle).unwrap()));
        menus.push(Box::new(MenuItem::with_id(app_handle, menu::MID_DV_COPY_KEY_NAME, "Copy Key Name", true, None::<&str>).unwrap()));
        menus.push(Box::new(MenuItem::with_id(app_handle, menu::MID_DEL_KEY_VALUE, "Delete Key", true, None::<&str>).unwrap()));
        menus.push(Box::new(MenuItem::with_id(app_handle, menu::MID_DUPLICATE_VALUE, "Duplicate", true, None::<&str>).unwrap()));
    }

    menus.push(Box::new(PredefinedMenuItem::separator(app_handle).unwrap()));
    menus.push(Box::new(MenuItem::with_id(app_handle, menu::MID_DEL_DV_ITEM, "Delete View", true, None::<&str>).unwrap()));

    let menu_refs: Vec<&dyn IsMenuItem<R>> = menus.iter().map(|b| &**b).collect();
    let menu = Menu::with_items(app_handle, &menu_refs).unwrap();
    menu.popup(window).unwrap();
    Ok(())
}

#[tauri::command]
pub fn show_key_tree_right_menu<R: Runtime>(
    key: Option<String>,
    keys: Option<Vec<String>>,
    datasource: i64,
    database: i64,
    handle: AppHandle<R>,
    window: Window,
    menu_context: State<'_, MenuContext>,
) {
    let mut context = HashMap::new();
    context.insert(String::from("datasource"), datasource.to_string());
    context.insert(String::from("database"), database.to_string());
    let mut single_only_bool = true;
    let mut key_size_info = String::from("");
    if let Some(k) = key {
        context.insert(String::from("key"), k);
    }
    if let Some(ks) = keys {
        let len = ks.len();
        context.insert(String::from("keys"), ks.join("$#$"));
        single_only_bool = false;
        key_size_info = format!(" ({len} keys)");
    }
    menu_context.set_context(menu::MENU_KEY_TREE_RIGHT_CLICK, context);

    let label = "modify-key-win".to_string();

    let inner_size = window.inner_size().unwrap();
    let position = window.outer_position().unwrap();

    let mut visible = false;
    match window.get_webview_window(&label) {
        None => {
            let url: WebviewUrl = WebviewUrl::App("windows/modify-key.html".into());
            let w = tauri::webview::WebviewWindowBuilder::new(&handle, label, url)
                .fullscreen(false)
                .hidden_title(true)
                .resizable(false)
                .minimizable(false)
                .transparent(false)
                .title_bar_style(TitleBarStyle::Overlay)
                .theme(Some(Dark))
                .inner_size(410f64, 140f64)
                .visible(false)
                .always_on_top(true)
                .shadow(true)
                .build()
                .unwrap();
            let size = w.inner_size().unwrap();
            let x = (position.x + inner_size.width as i32 / 2 - size.width as i32 / 2) as f64;
            let y = (position.y + inner_size.height as i32 / 2 - size.height as i32 / 2) as f64
                - 100f64;
            w.set_position(PhysicalPosition::new(x, y)).unwrap();
        }
        Some(w) => {
            visible = w.is_visible().unwrap();
            if !visible {
                let size = w.inner_size().unwrap();
                let x = (position.x + inner_size.width as i32 / 2 - size.width as i32 / 2) as f64;
                let y = (position.y + inner_size.height as i32 / 2 - size.height as i32 / 2) as f64
                    - 100f64;
                w.set_position(PhysicalPosition::new(x, y)).unwrap()
            }
        }
    };

    let app_handle = handle.app_handle();
    let _pkg_info = app_handle.package_info();
    let menu = Menu::with_items(
        app_handle,
        &[
            &MenuItem::with_id(
                app_handle,
                menu::MID_COPY_KEY_NAME,
                "Copy Key Name",
                single_only_bool,
                None::<&str>,
            )
                .unwrap(),
            &MenuItem::with_id(
                app_handle,
                menu::MID_DUPLICATE,
                "Duplicate",
                single_only_bool,
                None::<&str>,
            )
                .unwrap(),
            &MenuItem::with_id(
                app_handle,
                menu::MID_KEY_RENAME,
                "Rename",
                single_only_bool,
                None::<&str>,
            )
                .unwrap(),
            &PredefinedMenuItem::separator(app_handle).unwrap(),
            &MenuItem::with_id(
                app_handle,
                menu::MID_DELETE_KEY,
                format!("Delete{key_size_info}"),
                true,
                None::<&str>,
            )
                .unwrap(),
        ],
    )
        .unwrap();
    menu.popup(window).unwrap();
}

#[tauri::command]
pub fn show_content_editor_menu<R: Runtime>(
    datasource: i64,
    database: i64,
    key: String,
    field: String,
    value: String,
    key_type: String,
    copy_value: Option<String>,
    handle: tauri::AppHandle<R>,
    window: Window,
    menu_context: State<'_, MenuContext>,
    _x: f64,
    _y: f64,
) {
    let label = window.label();
    let mut context = HashMap::new();
    context.insert(String::from("datasource"), datasource.to_string());
    context.insert(String::from("database"), database.to_string());
    context.insert(String::from("key"), key);
    context.insert(String::from("field"), field);
    context.insert(String::from("value"), value);
    context.insert(String::from("win"), label.to_string());
    context.insert(String::from("copy_value"), copy_value.unwrap_or(String::from("")));
    context.insert(String::from("key_type"), key_type);
    menu_context.set_context(menu::MENU_OPERATOR_MENU, context);

    let app_handle = handle.app_handle();
    let _pkg_info = app_handle.package_info();
    let menu = Menu::with_items(
        app_handle,
        &[
            &MenuItem::with_id(
                app_handle,
                menu::MID_KEY_OP_COPY,
                "Copy",
                true,
                None::<&str>,
            )
                .unwrap(),
            &MenuItem::with_id(
                app_handle,
                menu::MID_KEY_OP_ADD_ROW,
                "Add Row",
                true,
                None::<&str>,
            )
                .unwrap(),
            &Submenu::with_items(
                app_handle,
                "Copy As",
                true,
                &[
                    &MenuItem::with_id(
                        app_handle,
                        menu::MID_KEY_OP_CP_AS_CMD,
                        "Redis Command",
                        true,
                        None::<&str>,
                    )
                        .unwrap(),
                    &MenuItem::with_id(
                        app_handle,
                        menu::MID_KEY_OP_CP_AS_TSV,
                        "TSV",
                        true,
                        None::<&str>,
                    )
                        .unwrap(),
                    &MenuItem::with_id(
                        app_handle,
                        menu::MID_KEY_OP_CP_AS_CSV,
                        "CSV",
                        true,
                        None::<&str>,
                    )
                        .unwrap(),
                ],
            )
                .unwrap(),
            &PredefinedMenuItem::separator(app_handle).unwrap(),
            &MenuItem::with_id(
                app_handle,
                menu::MID_KEY_OP_DELETE,
                "Delete Row",
                true,
                None::<&str>,
            )
                .unwrap(),
        ],
    )
        .unwrap();
    menu.popup(window).unwrap();
}

/// show add new key menu
#[tauri::command]
pub fn show_add_new_key_menu<R: Runtime>(
    datasource: i64,
    database: i64,
    handle: tauri::AppHandle<R>,
    window: Window,
    menu_context: State<'_, MenuContext>,
) {
    let mut context = HashMap::new();
    context.insert(String::from("datasource"), datasource.to_string());
    context.insert(String::from("database"), database.to_string());
    menu_context.set_context(menu::MENU_ADD_NEW_KEY_MENU, context);

    let label = "create-new-key".to_string();

    let inner_size = window.inner_size().unwrap();
    let position = window.outer_position().unwrap();

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
            let y = (position.y + inner_size.height as i32 / 2 - size.height as i32 / 2) as f64
                - 100f64;
            w.set_position(PhysicalPosition::new(x, y)).unwrap();
        }
        Some(w) => {
            visible = w.is_visible().unwrap();
            if !visible {
                let size = w.inner_size().unwrap();
                let x = (position.x + inner_size.width as i32 / 2 - size.width as i32 / 2) as f64;
                let y = (position.y + inner_size.height as i32 / 2 - size.height as i32 / 2) as f64
                    - 100f64;
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
                &MenuItem::with_id(
                    app_handle,
                    menu::MID_ADD_STRING,
                    "String",
                    true,
                    None::<&str>,
                )
                    .unwrap(),
                &MenuItem::with_id(app_handle, menu::MID_ADD_HASH, "Hash", true, None::<&str>)
                    .unwrap(),
                &MenuItem::with_id(app_handle, menu::MID_ADD_LIST, "List", true, None::<&str>)
                    .unwrap(),
                &MenuItem::with_id(app_handle, menu::MID_ADD_SET, "Set", true, None::<&str>)
                    .unwrap(),
                &MenuItem::with_id(app_handle, menu::MID_ADD_ZSET, "ZSet", true, None::<&str>)
                    .unwrap(),
                &PredefinedMenuItem::separator(app_handle).unwrap(),
                &Submenu::with_items(
                    app_handle,
                    "Import",
                    true,
                    &[
                        &MenuItem::new(app_handle, "Json", true, None::<&str>).unwrap(),
                        &MenuItem::new(app_handle, "Excel", true, None::<&str>).unwrap(),
                        &MenuItem::new(app_handle, "Raw", true, None::<&str>).unwrap(),
                    ],
                )
                    .unwrap(),
            ],
        )
            .unwrap();
        menu.popup(window).unwrap();
    }
}

/// open auto refresh timer on datatable toolkits
#[tauri::command]
pub fn show_auto_refresh_menu<R: Runtime>(handle: AppHandle<R>, window: Window, _x: f64, _y: f64) {
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
