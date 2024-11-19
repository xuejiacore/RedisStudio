use crate::dao::data_view_dao;
use crate::storage::sqlite_storage::SqliteStorage;
use crate::CmdResult;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use tauri::{AppHandle, Runtime, State};

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct DataViewNode {
    /// type of node:
    /// 1. data view group
    /// 2. data view dir
    /// 3. data view leaf
    node_type: u16,
    id: i64,
    name: String,

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
    let result = data_view_dao::query_data_view(datasource, database, sqlite).await?;

    let mut dir_map = HashMap::<String, Rc<RefCell<DataViewNode>>>::new();
    let mut new_dir = DataViewNode::default();
    new_dir.node_type = 1;
    new_dir.path = Some(String::from(""));
    new_dir.name = String::from("root");

    let root_rrc = Rc::new(RefCell::new(new_dir));
    dir_map.insert(String::from(""), root_rrc);

    for dv in result {
        let dv_name = dv.name;
        let dv_p = format!(":{}", dv_name);
        if !dir_map.contains_key(&dv_p) {
            let mut new_dir = DataViewNode::default();
            new_dir.node_type = 1;
            new_dir.path = Some(dv_name.clone());
            new_dir.name = dv_name.clone();

            let rrc = Rc::new(RefCell::new(new_dir));
            let p_node = dir_map.get_mut("").expect("parent not exists");
            p_node.borrow_mut().children.push(rrc.clone());
            dir_map.insert(dv_p, rrc);
        }
        let paths = dv.path.split(":").collect::<Vec<&str>>();
        let node_value = dv.last_var;
        let key_type = dv.key_type;
        for i in 1..paths.len() + 1 {
            let p = paths[0..i].join(":");
            if !dir_map.contains_key(&p) {
                if i - 1 > 0 {
                    let parent = paths[0..i - 1].join(":");
                    let p_node = dir_map.get_mut(&parent).expect("parent not exists");
                    let mut new_dir = DataViewNode::default();
                    new_dir.node_type = match i == paths.len() {
                        true => 3,
                        false => 2
                    };
                    new_dir.path = Some(p.clone());
                    new_dir.name = String::from(paths[i - 1]);
                    new_dir.var = node_value.clone();
                    new_dir.key_type = Some(key_type.clone());

                    let rrc = Rc::new(RefCell::new(new_dir));
                    p_node.borrow_mut().children.push(rrc.clone());
                    dir_map.insert(p, rrc);
                } else {
                    let mut new_dir = DataViewNode::default();
                    new_dir.node_type = 2;
                    new_dir.path = Some(p.clone());
                    new_dir.name = String::from(paths[i - 1]);
                    dir_map.insert(p, Rc::new(RefCell::new(new_dir)));
                }
            }
        }
    }

    match dir_map.get("") {
        None => Ok(json!({})),
        Some(root) => Ok(json!(root))
    }
}
