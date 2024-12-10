use crate::command::redis_cmd::KeySpaceInfo;
use crate::dao::datasource_dao;
use crate::storage::redis_pool::RedisPool;
use crate::storage::sqlite_storage::SqliteStorage;
use crate::utils::system::{prop, SETTING_PATH};
use crate::CmdResult;
use redis::cmd;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::cell::RefCell;
use std::collections::HashMap;
use std::ops::DerefMut;
use std::rc::Rc;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_store::StoreExt;

/// list flatted datasource list.
#[tauri::command]
pub async fn list_flat_datasource<R: Runtime>(
    handle: AppHandle<R>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<Value> {
    let result = datasource_dao::query_flat_datasource(None, sqlite).await?;
    Ok(json!({"datasource": result}))
}

#[tauri::command]
pub async fn list_database_list<R: Runtime>(
    datasource: i64,
    database: i64,
    handle: AppHandle<R>,
    sqlite: State<'_, SqliteStorage>,
    redis_pool: State<'_, RedisPool>,
) -> CmdResult<Value> {
    let mut connection = redis_pool.select_connection(datasource, None).await;

    // databases key space info.
    let re =
        Regex::new(r"(?<name>db(?<index>\d+)):keys=(?<keys>\d+),expires=(\d+)").unwrap();
    let keyspace: String = cmd("INFO")
        .arg("KEYSPACE")
        .query_async(&mut connection)
        .await
        .unwrap();
    let key_space_info: Vec<KeySpaceInfo> = keyspace
        .split("\n")
        .filter(|line| line.len() > 0 && !line.starts_with("#"))
        .map(|line| {
            let cap = re.captures(line).unwrap();
            let name = String::from(cap.name("name").unwrap().as_str());
            let index = cap.name("index").unwrap().as_str().parse().unwrap();
            let keys = cap.name("keys").unwrap().as_str().parse().unwrap();
            KeySpaceInfo { name, index, keys }
        })
        .collect();

    // count of databases.
    let databases_info: Vec<String> = cmd("CONFIG")
        .arg("GET")
        .arg("DATABASES")
        .query_async(&mut connection)
        .await
        .unwrap();
    let database_count = &databases_info[1];
    Ok(json!({
        "database": database,
        "key_space_info": key_space_info,
        "database_count": database_count
    }))
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct TreeNode {
    /// type of node: 1: group 2: leaf
    node_type: u16,
    id: i64,
    name: String,
    short_name: Option<String>,
    color: Option<String>,
    host: Option<String>,
    port: Option<u16>,
    path: Option<String>,
    children: Vec<Rc<RefCell<TreeNode>>>,
    default_database: Option<u16>,
}

/// list treed datasource
#[tauri::command]
pub async fn list_treed_datasource<R: Runtime>(
    handle: AppHandle<R>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<Value> {
    let result = datasource_dao::query_flat_datasource(None, sqlite).await?;

    let mut dir_map = HashMap::<String, Rc<RefCell<TreeNode>>>::new();
    for ds in result {
        let paths = ds.path.split("/").collect::<Vec<&str>>();
        for i in 1..paths.len() + 1 {
            let p = paths[0..i].join("/");
            if !dir_map.contains_key(&p) {
                if i - 1 > 0 {
                    let parent = paths[0..i - 1].join("/");
                    let p_node = dir_map.get_mut(&parent).expect("parent not exists");
                    let mut new_dir = TreeNode::default();
                    new_dir.node_type = 1;
                    new_dir.path = Some(p.clone());
                    new_dir.name = String::from(paths[i - 1]);

                    let rrc = Rc::new(RefCell::new(new_dir));
                    p_node.borrow_mut().children.push(rrc.clone());
                    dir_map.insert(p, rrc);
                } else {
                    let mut new_dir = TreeNode::default();
                    new_dir.node_type = 1;
                    new_dir.path = Some(p.clone());
                    new_dir.name = String::from(paths[i - 1]);
                    dir_map.insert(p, Rc::new(RefCell::new(new_dir)));
                }
            }
        }

        let mut dir = dir_map.get_mut(&ds.path).expect("Direction not exists");
        let mut node = TreeNode::default();
        node.id = ds.id;
        node.node_type = 2;
        node.name = ds.datasource_name;
        node.host = Some(ds.host);
        node.port = ds.port;
        node.color = ds.color;
        node.path = Some(ds.path);
        node.default_database = ds.default_database;
        dir.borrow_mut().children.push(Rc::new(RefCell::new(node)));
    }

    let root = dir_map.get("").expect("Empty.");
    Ok(json!(root))
}

#[tauri::command]
pub async fn change_active_datasource<R: Runtime>(
    datasource: i64,
    default_database: i64,
    handle: AppHandle<R>,
    redis_pool: State<'_, RedisPool>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<Value> {
    redis_pool.change_active_connection(Some(datasource), Some(default_database)).await;

    let datasource_detail = datasource_dao::query_datasource(datasource, sqlite).await?;

    let resource_path = &handle.path().resolve(SETTING_PATH, BaseDirectory::AppData).unwrap();
    let store = handle.store(&resource_path).unwrap();

    let ds_name = datasource_detail.datasource_name;
    let ds_color = datasource_detail.color.unwrap_or(String::from(""));
    let host = datasource_detail.host;
    let port = datasource_detail.port;
    let id = datasource_detail.id;
    let path = datasource_detail.path;

    store.set(prop::P_LAST_DATASOURCE, json!({
        "datasource": datasource,
        "database": default_database,
        "dsname": ds_name,
        "color": ds_color,
        "host": host,
        "port": port,
        "id": id,
        "path": path
    }));
    store.save().unwrap();

    let resp = json!({"datasource": &datasource, "database": default_database});
    handle.emit("spotlight/activated-datasource", resp).expect("Notify error.");
    Ok(json!({"success": true}))
}

#[tauri::command]
pub async fn add_new_datasource<R: Runtime>(
    handle: AppHandle<R>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<Value> {
    Ok(json!({}))
}

#[tauri::command]
pub async fn query_datasource_detail<R: Runtime>(
    datasource: i64,
    handle: AppHandle<R>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<Value> {
    let datasource_detail = datasource_dao::query_datasource(datasource, sqlite).await?;
    let ds_name = datasource_detail.datasource_name;
    let ds_color = datasource_detail.color;
    let ds_id = datasource_detail.id;
    let host = datasource_detail.host;
    let port = datasource_detail.port;
    let default_database = datasource_detail.default_database;
    let password = datasource_detail.password;
    let path = datasource_detail.path;
    Ok(json!({
        "name": ds_name,
        "ds_color": ds_color,
        "id": ds_id,
        "host": host,
        "port": port,
        "default_database": default_database,
        "password": password,
        "path": path
    }))
}

#[derive(Clone, Serialize, Deserialize, Debug, Default)]
struct DataSourceProp {
    /// datasource id
    datasource: String,
    /// name of the datasource
    name: String,
    /// description of the datasource
    desc: Option<String>,
    /// redis's connection host.
    host: String,
    /// redis's connection port, default is 6379
    port: Option<u16>,
    /// datasource theme color.
    custom_color: Option<String>,
    /// group id of the datasource property
    group_id: String,
}
