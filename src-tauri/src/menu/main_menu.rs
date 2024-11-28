use crate::menu;
use crate::menu::menu_manager::MenuContext;
use crate::storage::redis_pool::RedisPool;
use redis::{cmd, AsyncCommands};
use serde_json::json;
use std::collections::HashMap;
use std::ops::DerefMut;
use tauri::menu::MenuEvent;
use tauri::{Emitter, Manager, State, Window};
use tauri_plugin_clipboard_manager::ClipboardExt;

/// process the menu event of main window
pub async fn process_main_menu(window: &Window, event: MenuEvent) {
    let menu_id = &event.id;
    let menu_id_val = menu_id.0.clone();
    let menu_id_str = menu_id_val.as_str();
    let t: Vec<&str> = menu_id_val.split("/").collect();
    let menu_group = t[0];
    let menu_id = t[1];

    let menu_context: State<'_, MenuContext> = window.state();
    let context = menu_context
        .get_context(menu_group)
        .unwrap_or(HashMap::new());
    match menu_group {
        menu::MENU_ADD_NEW_KEY_MENU => process_add_new_key(window, event, menu_id, context),
        menu::MENU_OPERATOR_MENU => {
            process_type_operator(window, event, menu_id, context, menu_id_str).await
        }
        menu::MENU_KEY_TREE_RIGHT_CLICK => {
            process_key_tree_right_clk(window, event, menu_id, context, menu_id_str).await
        }
        menu::MENU_DATA_VIEW_R_CLK => {
            process_data_view_right_clk(window, event, menu_id, context, menu_id_str).await
        }
        &_ => {}
    }
}

/// create new key
fn process_add_new_key(
    window: &Window,
    event: MenuEvent,
    menu_id: &str,
    context: HashMap<String, String>,
) {
    let datasource = context.get("datasource").expect("data not exists");
    let database = context.get("database").expect("database not exists");
    let key_type = menu_id;
    let win = window.get_webview_window("create-new-key").unwrap();
    win.eval(
        format!(
            "window.onCreateNewKey('{}', '{}', {})",
            key_type, datasource, database
        )
        .as_str(),
    )
    .unwrap();
    win.show().unwrap();
}

/// type operator
async fn process_type_operator(
    window: &Window,
    event: MenuEvent,
    menu_id: &str,
    context: HashMap<String, String>,
    menu_id_val: &str,
) {
    let win_label = context.get("win").expect("could not found source window");
    let datasource = context.get("datasource").expect("`datasource` unknown");
    let database_str = context.get("database").expect("`database` unknown");
    let key = context.get("key").expect("`key` unknown");
    let field = context.get("field").expect("`field` unknown");
    let value = context.get("value");

    let database = database_str.parse::<i64>().map(|t| Some(t)).unwrap_or(None);
    println!("win = {win_label}, 点击内容：{menu_id}, datasource = {datasource}, key = {key}, field = {field}");
    match menu_id_val {
        menu::MID_KEY_OP_ADD_ROW => {
            let payload = json!({
                "winLabel": win_label,
                "datasource": datasource
            });
            window
                .emit_to(win_label, "operator/add_row", payload)
                .unwrap();
        }
        menu::MID_KEY_OP_COPY => {
            let copy_value = context.get("copy_value").expect("`copy_value` unknown");
            let handle = window.app_handle();
            handle.clipboard().write_text(copy_value).unwrap();
        }
        menu::MID_KEY_OP_DELETE => {
            let redis_pool: State<'_, RedisPool> = window.state();
            let datasource_num = datasource.parse::<i64>().expect("`datasource` unknown");
            let t = redis_pool.select_connection(datasource_num, database).await;
            let mut conn = {
                let mutex = t.lock().await;
                mutex
            };
            let del_result: i32 = cmd("HDEL")
                .arg(key)
                .arg(field)
                .query_async(conn.deref_mut())
                .await
                .expect("");
            let success = del_result == 1;
            let payload = json!({
                "datasource": datasource,
                "key": key,
                "field": field,
                "success": success
            });
            window
                .emit_to(win_label, "operator/del_row", payload)
                .expect("Fail to emit msg.");
        }
        &_ => {}
    }
}

/// key tree right click event
async fn process_key_tree_right_clk(
    window: &Window,
    event: MenuEvent,
    menu_id: &str,
    context: HashMap<String, String>,
    menu_id_val: &str,
) {
    let datasource = context
        .get("datasource")
        .expect("Parameter error: missing `datasource`");
    let database = context
        .get("database")
        .expect("Parameter error: missing `dastabase`");
    let mut keys = vec![];
    match context.get("key") {
        None => {
            let keys_string = context
                .get("keys")
                .expect("Parameter error: missing `keys`");
            keys = keys_string.split("$#$").collect();
        }
        Some(k) => {
            keys.push(k);
        }
    }

    let database_num: i64 = database.parse::<i64>().expect("unrecognized database");
    let redis_pool: State<'_, RedisPool> = window.state();
    let datasource_num = datasource.parse::<i64>().expect("`datasource` unknown");
    let t = redis_pool
        .select_connection(datasource_num, Some(database_num))
        .await;
    let mut conn = {
        let mutex = t.lock().await;
        mutex
    };

    for key in keys {
        match menu_id_val {
            menu::MID_COPY_KEY_NAME => {
                let clipboard = window.clipboard();
                clipboard.write_text(key).unwrap();
            }
            menu::MID_DELETE_KEY => {
                let result: i32 = cmd("DEL")
                    .arg(key)
                    .query_async(conn.deref_mut())
                    .await
                    .unwrap();
                let success = result > 0;
                let payload = json!({"key": key, "success": success});
                window.emit("key-tree/delete", payload).unwrap()
            }
            menu::MID_KEY_RENAME => {
                let type_str: String = cmd("TYPE")
                    .arg(key)
                    .query_async(conn.deref_mut())
                    .await
                    .expect("Key not exists.");
                let win = window.get_webview_window("modify-key-win").unwrap();
                win.eval(
                    format!(
                        "window.onKeyModify('{}', '{}', '{}', {}, 'modify')",
                        key, type_str, datasource, database
                    )
                    .as_str(),
                )
                .unwrap();
                win.show().unwrap();
            }
            menu::MID_DUPLICATE => {
                let type_str: String = cmd("TYPE")
                    .arg(key)
                    .query_async(conn.deref_mut())
                    .await
                    .expect("Key not exists.");
                let win = window.get_webview_window("modify-key-win").unwrap();
                win.eval(
                    format!(
                        "window.onKeyModify('{}', '{}', '{}', {}, 'duplicate')",
                        key, type_str, datasource, database
                    )
                    .as_str(),
                )
                .unwrap();
                win.show().unwrap();
            }
            &_ => todo!(),
        }
    }
}

async fn process_data_view_right_clk(
    window: &Window,
    event: MenuEvent,
    menu_id: &str,
    context: HashMap<String, String>,
    menu_id_val: &str,
) {
    let win_label = context.get("win").expect("could not found source window");
    match menu_id_val {
        menu::MID_ADD_DV_ITEM => {
            window
                .emit_to(
                    "main",
                    menu_id_val,
                    json!({
                        "winId": win_label
                    }),
                )
                .unwrap();
        }
        menu::MID_DEL_DV_ITEM => {
            window
                .emit_to(
                    "main",
                    menu_id_val,
                    json!({
                        "winId": win_label
                    }),
                )
                .unwrap();
        }
        menu::MID_MOD_DV_ITEM => {
            window
                .emit_to(
                    "main",
                    menu_id_val,
                    json!({
                        "winId": win_label
                    }),
                )
                .unwrap();
        }
        menu::MID_DV_EXPAND_ALL => {
            let data_view_id = context
                .get("data_view_id")
                .expect("could not found data view id");
            window
                .emit_to(
                    "main",
                    menu_id_val,
                    json!({
                        "winId": win_label,
                        "dataViewId": data_view_id
                    }),
                )
                .unwrap();
        }
        &_ => {}
    }
}
