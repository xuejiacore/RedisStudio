use crate::dao::data_view_dao;
use crate::storage::redis_pool::RedisPool;
use crate::storage::sqlite_storage::SqliteStorage;
use crate::{CmdError, CmdResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::cell::RefCell;
use std::collections::HashMap;
use std::ops::DerefMut;
use std::rc::Rc;
use tauri::{AppHandle, Emitter, Runtime, State};

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct DataViewNode {
    /// type of node:
    /// 1. data view group
    /// 2. data view dir
    /// 3. data view leaf
    node_type: u16,
    id: i64,
    dv_id: i64,
    name: String,
    key: String,

    var: Option<String>,
    key_type: Option<String>,
    sort: Option<i64>,

    path: Option<String>,
    children: Vec<Rc<RefCell<DataViewNode>>>,
}

#[tauri::command]
pub async fn list_tree_data_views<R: Runtime>(
    datasource: i64,
    database: i64,
    handle: AppHandle<R>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<Value> {
    get_data_view_tree(datasource, database, sqlite).await?
}
#[tauri::command]
pub async fn add_new_data_view_item<R: Runtime>(
    datasource: i64,
    database: i64,
    data_view_id: i64,
    key: String,
    key_type: Option<String>,
    handle: AppHandle<R>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<Value> {
    data_view_dao::add_data_view_item(data_view_id, key, key_type, sqlite.clone()).await;
    get_data_view_tree(datasource, database, sqlite).await?
}

#[tauri::command]
pub async fn del_data_view_item<R: Runtime>(
    datasource: i64,
    database: i64,
    data_view_item_id: i64,
    handle: AppHandle<R>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<Value> {
    data_view_dao::delete_data_view_item(data_view_item_id, sqlite.clone()).await;
    get_data_view_tree(datasource, database, sqlite).await?
}

#[tauri::command]
pub async fn query_history_vars<R: Runtime>(
    data_view_id: i64,
    var_name: String,
    limit: u32,
    handle: AppHandle<R>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<Value> {
    let t = data_view_dao::query_data_view_var_history(data_view_id, var_name, limit, sqlite).await;
    match t {
        Ok(histories) => Ok(json!({
            "histories": histories,
        })),
        Err(_) => Ok(json!({
            "histories": [],
        })),
    }
}

#[tauri::command]
pub async fn save_var_history<R: Runtime>(
    data_view_id: i64,
    name: String,
    value: String,
    handle: AppHandle<R>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<bool> {
    data_view_dao::save_var_history(data_view_id, name, value, sqlite.clone()).await
}

#[derive(Clone, Serialize, Deserialize, Eq, PartialEq, Hash)]
pub struct QueryTypeKey {
    key: String,
    id: i64,
}
#[tauri::command]
pub async fn query_key_exist_and_type<R: Runtime>(
    view_id: i64,
    datasource: i64,
    database: i64,
    keys: Vec<QueryTypeKey>,
    current_meta: String,
    handle: AppHandle<R>,
    redis_pool: State<'_, RedisPool>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<Value> {
    let key_len = keys.len();
    let arc = redis_pool
        .select_connection(datasource.to_string(), Some(database))
        .await;
    let mut conn = arc.lock().await;
    let mut pipe = redis::pipe();
    keys.iter().for_each(|k| {
        pipe.cmd("TYPE").arg(&k.key);
    });
    let types: Vec<String> = pipe.query_async(conn.deref_mut()).await.unwrap();

    let mut map = HashMap::new();
    let mut id_map = HashMap::new();
    for idx in 0..key_len {
        let key_info = &keys[idx];
        let key_name = key_info.key.clone();
        let key_id = key_info.id;
        map.insert(key_name, types[idx].clone());
        id_map.insert(key_id, types[idx].clone());
    }

    let meta: Value = serde_json::from_str(&current_meta).expect("incorrect meta data");

    let cloned_types = map.clone();
    let payload = json!({"types": cloned_types, "meta": meta, "davaViewId": view_id, "typeByIds": id_map});
    handle.emit("data_view/key_types", &payload).unwrap();

    // complete unknown keys
    let result = data_view_dao::query_unknown_keys(view_id, sqlite.clone()).await?;
    if result.len() > 0 {
        for unknown in result {
            if let Some(type_name) = id_map.get(&unknown.id) {
                if !"none".eq(type_name.as_str()) {
                    data_view_dao::update_unknown_type(
                        view_id,
                        unknown.id,
                        &type_name,
                        sqlite.clone(),
                    )
                    .await?;
                }
            }
        }
    }
    Ok(payload)
}

async fn get_data_view_tree(
    datasource: i64,
    database: i64,
    sqlite: State<'_, SqliteStorage>,
) -> Result<CmdResult<Value>, CmdError> {
    let result = data_view_dao::query_data_view(datasource, database, sqlite).await?;

    let mut dir_map = HashMap::<String, Rc<RefCell<DataViewNode>>>::new();
    let mut new_dir = DataViewNode::default();
    new_dir.node_type = 1;
    new_dir.path = Some(String::from(""));
    new_dir.name = String::from("root");

    let root_rrc = Rc::new(RefCell::new(new_dir));
    dir_map.insert(String::from(""), root_rrc);

    for dv in result {
        let dv_id = dv.dv_id;
        let dv_name = dv.name;
        let dv_p = format!(":{}", dv_name);
        let node_value = dv.last_var;
        if !dir_map.contains_key(&dv_p) {
            let mut new_dir = DataViewNode::default();
            new_dir.node_type = 1;
            new_dir.dv_id = dv_id;
            new_dir.path = Some(dv_name.clone());
            new_dir.name = dv_name.clone();
            new_dir.var = node_value.clone();

            let rrc = Rc::new(RefCell::new(new_dir));
            let p_node = dir_map.get_mut("").expect("parent not exists");
            p_node.borrow_mut().children.push(rrc.clone());
            dir_map.insert(dv_p, rrc);
        }
        let paths = dv.path.split(":").collect::<Vec<&str>>();
        let key_type = dv.key_type;
        let dv_item_id = dv.data_view_item_id;
        let key = dv.key;
        for i in 1..paths.len() + 1 {
            let p = paths[0..i].join(":");
            if !dir_map.contains_key(&p) {
                if i - 1 > 0 {
                    let parent = paths[0..i - 1].join(":");
                    let p_node = dir_map.get_mut(&parent).expect("parent not exists");
                    let mut new_dir = DataViewNode::default();
                    new_dir.node_type = match i == paths.len() {
                        true => {
                            new_dir.id = dv_item_id;
                            new_dir.key = key.clone();
                            3
                        }
                        false => 2,
                    };
                    new_dir.path = Some(p.clone());
                    new_dir.name = String::from(paths[i - 1]);
                    new_dir.var = node_value.clone();
                    new_dir.key_type = Some(key_type.clone());
                    new_dir.dv_id = dv_id;

                    let rrc = Rc::new(RefCell::new(new_dir));
                    p_node.borrow_mut().children.push(rrc.clone());
                    dir_map.insert(p, rrc);
                } else {
                    let mut new_dir = DataViewNode::default();
                    new_dir.node_type = 2;
                    new_dir.path = Some(p.clone());
                    new_dir.name = String::from(paths[i - 1]);
                    new_dir.dv_id = dv_id;
                    dir_map.insert(p, Rc::new(RefCell::new(new_dir)));
                }
            }
        }
    }

    Ok(match dir_map.get("") {
        None => Ok(json!({})),
        Some(root) => Ok(json!(root)),
    })
}
