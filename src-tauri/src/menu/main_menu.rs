use crate::menu;
use crate::menu::menu_manager::MenuContext;
use crate::storage::redis_pool::RedisPool;
use redis::{cmd, AsyncCommands};
use serde_json::json;
use std::collections::HashMap;
use std::ops::DerefMut;
use tauri::menu::MenuEvent;
use tauri::{Emitter, Manager, State, Window};

/// process the menu event of main window
pub async fn process_main_menu(window: &Window, event: MenuEvent) {
    let menu_id = &event.id;
    let menu_id_val = menu_id.0.clone();
    let menu_id_str = menu_id_val.as_str();
    let t: Vec<&str> = menu_id_val.split("@").collect();
    let menu_group = t[0];
    let menu_id = t[1];

    let menu_context: State<'_, MenuContext> = window.state();
    let context = menu_context.get_context(menu_group).unwrap_or(HashMap::new());
    match menu_group {
        menu::MENU_ADD_NEW_KEY_MENU => process_add_new_key(window, event, menu_id, context),
        menu::MENU_OPERATOR_MENU => process_type_operator(window, event, menu_id, context),
        menu::MENU_KEY_TREE_RIGHT_CLICK => process_key_tree_right_clk(window, event, menu_id, context, menu_id_str).await,
        &_ => {}
    }
}

/// create new key
fn process_add_new_key(window: &Window, event: MenuEvent, menu_id: &str, context: HashMap<String, String>) {
    let datasource = context.get("datasource").expect("data not exists");
    let key_type = menu_id;
    let win = window.get_webview_window("create-new-key").unwrap();
    win.eval(format!("window.onCreateNewKey('{}', '{}')", key_type, datasource).as_str()).unwrap();
    win.show().unwrap();
}

/// type operator
fn process_type_operator(window: &Window, event: MenuEvent, menu_id: &str, context: HashMap<String, String>) {}

/// key tree right click event
async fn process_key_tree_right_clk(window: &Window, event: MenuEvent, menu_id: &str, context: HashMap<String, String>, menu_id_val: &str) {
    let datasource = context.get("datasource").expect("Parameter error: missing `datasource`");
    let key = context.get("key").expect("Parameter error: missing `key`");

    let redis_pool: State<'_, RedisPool> = window.state();
    let t = redis_pool.fetch_connection(datasource).await;
    let mut conn = {
        let mutex = t.lock().await;
        mutex
    };

    match menu_id_val {
        menu::MID_COPY_KEY_NAME => {}
        menu::MID_DELETE_KEY => {
            let result: i32 = cmd("DEL")
                .arg(key)
                .query_async(conn.deref_mut())
                .await
                .unwrap();
            let success = result > 0;
            let payload = json!({"key": key, "success": success});
            window.emit("key_tree/delete", payload).unwrap()
        }
        &_ => todo!()
    }
}