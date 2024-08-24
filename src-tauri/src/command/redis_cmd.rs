use crate::{command, CmdError};
use crate::storage::redis_pool::RedisPool;
use futures::future::MaybeDone::Future;
use log::debug;
use redis::aio::{ConnectionLike, MultiplexedConnection};
use redis::{cmd, Cmd, Commands, Connection, FromRedisValue, RedisResult, RedisWrite};
use regex::{Match, Regex};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::ColumnIndex;
use std::collections::BTreeMap;
use std::fmt::{Error, Write};
use std::ops::DerefMut;
use std::str::from_utf8;
use std::sync::Mutex;
use std::time::Instant;
use std::vec::Vec;
use tauri::{AppHandle, Manager, Pattern, State, Window, Wry};
use tokio::sync::MutexGuard;

type Result<T> = std::result::Result<T, CmdError>;

#[derive(Serialize, Deserialize)]
struct RedisCmd {
    cmd: String,
    #[serde(default)]
    datasource_id: String,
    #[serde(default)]
    param_json: String,
}

impl Default for RedisCmd {
    fn default() -> Self {
        RedisCmd {
            cmd: String::from(""),
            datasource_id: String::from(""),
            param_json: String::from("{}"),
        }
    }
}

#[tauri::command]
pub async fn redis_invoke(
    data: &str,
    app: tauri::AppHandle,
    window: tauri::Window<Wry>,
    redis_pool: State<'_, RedisPool>,
) -> Result<String> {
    Ok(dispatch_redis_cmd(data, app, window, redis_pool).await.to_string())
}

pub async fn dispatch_redis_cmd(cmd_data: &str, _app: AppHandle, window: Window, redis_pool: State<'_, RedisPool>) -> Value {
    let redis_cmd: RedisCmd = serde_json::from_str(cmd_data).unwrap();
    let _param_json = redis_cmd.param_json;

    debug!("cmd = {}, params = {}", &redis_cmd.cmd.clone(), cmd_data);
    // TODO: select runtime redis datasource id.
    let datasource_id = redis_cmd.datasource_id;
    let arc = redis_pool.fetch_connection("test").await;
    let mut con = arc.lock().await;
    match &redis_cmd.cmd as &str {
        "redis_list_datasource" => {
            json!([{"id": 1,"name": "localhost"},{"id": 2,"name": "127.0.0.1"}])
        }
        "redis_get_database_info" => execute_get_database_info(con).await,
        "redis_key_scan" => execute_scan_cmd(
            redis_pool,
            datasource_id,
            serde_json::from_str(cmd_data).unwrap(),
            window,
        ).await,
        "redis_key_type" => execute_type_cmd(
            con,
            datasource_id,
            serde_json::from_str(cmd_data).unwrap(),
            window,
        ).await,
        "redis_get_hash" => execute_get_hash(
            con,
            datasource_id,
            serde_json::from_str(cmd_data).unwrap(),
            window,
        ).await,
        "redis_get_string" => execute_get_string(
            con,
            datasource_id,
            serde_json::from_str(cmd_data).unwrap(),
            window,
        ).await,
        "redis_key_info" => execute_key_info(
            con,
            datasource_id,
            serde_json::from_str(cmd_data).unwrap(),
            window,
        ).await,
        "redis_zrange_members" => execute_zrange_members(
            con,
            datasource_id,
            serde_json::from_str(cmd_data).unwrap(),
            window,
        ).await,
        "redis_lrange_members" => execute_lrange_members(
            con,
            datasource_id,
            serde_json::from_str(cmd_data).unwrap(),
            window,
        ).await,
        "redis_sscan" => execute_sscan(
            con,
            datasource_id,
            serde_json::from_str(cmd_data).unwrap(),
            window,
        ).await,
        "redis_update" => update_value(
            con,
            datasource_id,
            serde_json::from_str(cmd_data).unwrap(),
            window,
        ).await,
        "run_redis_command" => execute_redis_command(
            con,
            datasource_id,
            serde_json::from_str(cmd_data).unwrap(),
            window,
        ).await,
        _ => unimplemented!(),
    }
}

#[derive(Serialize, Deserialize, Debug)]
struct UpdateCmd {
    value: Option<String>,
    field: Option<String>,
    old_value: Option<String>,
    key: String,
    key_type: String,
    // lpush, rpush
    push_dir: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct ExecuteScriptSmd {
    script: String,
}

async fn execute_redis_command(
    mut connection: MutexGuard<'_, MultiplexedConnection>,
    _ds: String,
    params: ExecuteScriptSmd,
    _window: Window,
) -> Value {
    let script = params.script;
    let result = execute_batch_redis_command(script.as_str(), &mut connection, |_result| {}).await;
    json!({"success": true, "data": result})
}

async fn update_value(
    connection: MutexGuard<'_, MultiplexedConnection>,
    _ds: String,
    params: UpdateCmd,
    _window: Window,
) -> Value {
    match params.key_type.as_str() {
        "hash" => update_hash(connection, params).await,
        "string" => update_string(connection, params).await,
        "zset" => update_zset(connection, params).await,
        "set" => update_set(connection, params).await,
        "list" => update_list(connection, params).await,
        _ => unimplemented!(),
    }
}

async fn update_hash(mut connection: MutexGuard<'_, MultiplexedConnection>, params: UpdateCmd) -> Value {
    let field = params.field.unwrap();
    let value = params.value.unwrap();
    let _result: i32 = cmd("HSET")
        .arg(params.key)
        .arg(field)
        .arg(value)
        .query_async(connection.deref_mut())
        .await
        .unwrap();

    json!({"success": true})
}

async fn update_string(_connection: MutexGuard<'_, MultiplexedConnection>, _params: UpdateCmd) -> Value {
    unimplemented!();
}

async fn update_zset(mut connection: MutexGuard<'_, MultiplexedConnection>, params: UpdateCmd) -> Value {
    let new_score: f64 = params.field.unwrap().parse().unwrap();
    let member = params.value.unwrap();
    if params.old_value.is_some() {
        let old_score: f64 = params.old_value.unwrap().parse().unwrap();

        let old_value_result: RedisResult<f64> = cmd("ZSCORE")
            .arg(&params.key)
            .arg(&member)
            .query_async(connection.deref_mut())
            .await;
        if old_value_result.is_ok() {
            let curr_score = old_value_result.unwrap();
            if curr_score == old_score {
                let update_result: RedisResult<i32> = cmd("ZADD")
                    .arg(&params.key)
                    .arg(new_score)
                    .arg(&member)
                    .query_async(connection.deref_mut()).await;
                let is_success = update_result.is_ok();
                json!({"success": is_success})
            } else {
                json!({"success": false, "msg": "value changed"})
            }
        } else {
            json!({"success": false, "msg": "value changed"})
        }
    } else {
        unimplemented!();
    }
}

async fn update_set(_connection: MutexGuard<'_, MultiplexedConnection>, _params: UpdateCmd) -> Value {
    unimplemented!();
}

async fn update_list(mut connection: MutexGuard<'_, MultiplexedConnection>, params: UpdateCmd) -> Value {
    let index = params.field.unwrap();
    let new_value = params.value.unwrap();
    let mut ignore_value_check = true;
    if params.old_value.is_some() {
        ignore_value_check = false;
        let old_value = params.old_value.unwrap();

        let old_val_result: RedisResult<String> = cmd("LINDEX")
            .arg(&params.key)
            .arg(&index)
            .query_async(connection.deref_mut())
            .await;
        if old_val_result.is_ok() {
            let old_val = old_val_result.unwrap();
            if old_val == old_value {
                let lset_result: RedisResult<String> = cmd("LSET")
                    .arg(&params.key)
                    .arg(&index)
                    .arg(&new_value)
                    .query_async(connection.deref_mut())
                    .await;

                let is_success = lset_result.is_ok();
                json!({"success": is_success})
            } else {
                json!({"success": false, "msg": "value changed"})
            }
        } else {
            json!({"success": false, "msg": "value changed"})
        }
    } else {
        // 新增
        json!({"success": false, "msg": "unsupported"})
    }
}

#[derive(Serialize, Deserialize)]
struct GetDatabaseInfo {}

#[derive(Serialize, Deserialize, Debug)]
struct KeySpaceInfo {
    name: String,
    index: usize,
    keys: i64,
}

async fn execute_get_database_info(
    mut connection: MutexGuard<'_, MultiplexedConnection>,
) -> Value {
    let server_info: String = cmd("INFO").arg("SERVER").query_async(connection.deref_mut()).await.unwrap();
    let ver_reg = Regex::new(r"redis_version:(?<version>[0-9.]+)").unwrap();
    let redis_version = ver_reg
        .captures(server_info.as_str())
        .unwrap()
        .name("version")
        .unwrap()
        .as_str();

    // databases key space info.
    let re = Regex::new(r"(?<name>db(?<index>\d+)):keys=(?<keys>\d+),expires=(\d+)").unwrap();
    let keyspace: String = cmd("INFO").arg("KEYSPACE").query_async(connection.deref_mut()).await.unwrap();
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

    let memory_info: String = cmd("INFO").arg("MEMORY").query_async(connection.deref_mut()).await.unwrap();
    let used_memory_human_reg = Regex::new(r"used_memory_human:(?<usage>.*)").unwrap();
    let used_memory_human = used_memory_human_reg
        .captures(memory_info.as_str())
        .unwrap()
        .name("usage")
        .unwrap()
        .as_str();

    let dbsize: i64 = cmd("DBSIZE").query_async(connection.deref_mut()).await.unwrap();

    // count of databases.
    let databases_info: Vec<String> = cmd("CONFIG")
        .arg("GET")
        .arg("DATABASES")
        .query_async(connection.deref_mut())
        .await
        .unwrap();
    let database_count = &databases_info[1];

    json!({
        "key_space_info": key_space_info,
        "database_count": *database_count,
        "redis_version": redis_version,
        "used_memory_human": used_memory_human,
        "dbsize": dbsize
    })
}

#[derive(Serialize, Deserialize)]
struct HashGetCmd {
    key: String,
    cursor: i32,
    count: usize,
    pattern: String,
}

#[derive(Serialize, Deserialize)]
struct GetStringCmd {
    key: String,
}

#[derive(Serialize, Deserialize)]
struct FieldValue {
    field: String,
    content: String,
}

async fn execute_get_hash(
    mut connection: MutexGuard<'_, MultiplexedConnection>,
    _ds: String,
    params: HashGetCmd,
    _window: Window,
) -> Value {
    let start = Instant::now();
    let is_pattern_scan = !&params.pattern.is_empty();

    let mut cursor = params.cursor;
    let mut data_result: Vec<FieldValue> = vec![];
    loop {
        let result: Vec<Vec<String>> = cmd("HSCAN")
            .arg(&params.key)
            .arg(cursor)
            .arg("MATCH")
            .arg(&params.pattern)
            .arg("COUNT")
            .arg(&params.count)
            .query_async(connection.deref_mut())
            .await
            .unwrap();
        let mut field_values: Vec<FieldValue> = result
            .chunks(2)
            .flat_map(|pair| {
                pair[1].chunks(2).map(|fv| {
                    let (field, content) = (fv[0].clone(), fv[1].clone());
                    FieldValue { field, content }
                })
            })
            .collect();
        cursor = result[0][0].parse().unwrap();

        data_result.append(&mut field_values);
        if !is_pattern_scan || cursor <= 0 || data_result.len() >= params.count {
            break;
        }
    }

    let length: i32 = cmd("HLEN").arg(&params.key).query_async(connection.deref_mut()).await.unwrap();
    let ttl: i32 = cmd("TTL").arg(&params.key).query_async(connection.deref_mut()).await.unwrap();
    let duration = start.elapsed();
    println!("open() 耗时: {:?}", duration);
    json!({
        "field_values": data_result,
        "length": length,
        "ttl": ttl,
        "cursor": cursor
    })
}

async fn execute_get_string(
    mut connection: MutexGuard<'_, MultiplexedConnection>,
    _ds: String,
    params: GetStringCmd,
    _window: Window,
) -> Value {
    let result: String = cmd("GET").arg(&params.key).query_async(connection.deref_mut()).await.unwrap();
    json!({
        "content": result
    })
}

#[derive(Serialize, Deserialize)]
struct KeyInfoParam {
    key: String,
    key_type: String,
}

async fn execute_key_info(
    mut connection: MutexGuard<'_, MultiplexedConnection>,
    _ds: String,
    params: KeyInfoParam,
    _window: Window,
) -> Value {
    let mut usage = 0;
    let mut data_len = 0;
    let mut encoding = String::from("unknown");
    let mut ttl_val = 0;
    let mut exists_val = 0;
    let key_type = &params.key_type;

    let con_ref = &mut *connection;
    let mut exists_cmd0 = cmd("EXISTS");
    let cloned_conn = &mut con_ref.clone();
    let exists_cmd = exists_cmd0.arg(&params.key).query_async::<i32>(cloned_conn);

    let mut ttl_cmd0 = cmd("TTL");
    let cloned_conn = &mut con_ref.clone();
    let ttl_cmd = ttl_cmd0.arg(&params.key).query_async::<i32>(cloned_conn);

    let cloned_conn = &mut con_ref.clone();
    let mut memory_cmd0 = cmd("MEMORY");
    let memory_cmd = memory_cmd0.arg("usage").arg(&params.key)
        .query_async::<i32>(cloned_conn);

    let cloned_conn = &mut con_ref.clone();
    let mut object_cmd0 = cmd("OBJECT");
    let object_cmd = object_cmd0.arg("encoding").arg(&params.key)
        .query_async::<String>(cloned_conn);

    let len_cmd_str;
    match key_type.as_str() {
        "hash" => len_cmd_str = Some("HLEN"),
        "set" => len_cmd_str = Some("SCARD"),
        "zset" => len_cmd_str = Some("ZCARD"),
        "list" => len_cmd_str = Some("LLEN"),
        _ => len_cmd_str = None,
    }

    if len_cmd_str.is_some() {
        let cloned_conn = &mut con_ref.clone();
        let mut hlen_cmd0 = cmd(len_cmd_str.unwrap());
        let type_len_cmd = hlen_cmd0.arg(&params.key)
            .query_async::<i32>(cloned_conn);
        let (exists, _ttl, usage_result, encoding_result, type_len_result) = tokio::join!(
            exists_cmd,
            ttl_cmd,
            memory_cmd,
            object_cmd,
            type_len_cmd
        );
        exists_val = exists.unwrap();
        if exists_val == 1 {
            usage = usage_result.unwrap_or(usage);
            encoding = encoding_result.unwrap_or(encoding);
            data_len = type_len_result.unwrap_or(data_len);
        }
    } else {
        let (exists, ttl, usage_result, encoding_result) = tokio::join!(
            exists_cmd,
            ttl_cmd,
            memory_cmd,
            object_cmd,
        );
        exists_val = exists.unwrap();
        if exists_val == 1 {
            usage = usage_result.unwrap_or(usage);
            encoding = encoding_result.unwrap_or(encoding);
        }
        ttl_val = ttl.unwrap();
    }

    json!({
        "exists": exists_val,
        "ttl": ttl_val,
        "usage": usage,
        "encoding": encoding,
        "data_len": data_len
    })
}

#[derive(Serialize, Deserialize)]
struct TypeCmd {
    key: String,
}

async fn execute_type_cmd(
    mut connection: MutexGuard<'_, MultiplexedConnection>,
    _ds: String,
    params: TypeCmd,
    _window: Window,
) -> Value {
    // connect to redis
    let result: String = cmd("TYPE").arg(params.key).query_async(connection.deref_mut()).await.unwrap();
    json!({"type": result})
}

#[derive(Serialize, Deserialize)]
struct ZRangeParam {
    key: String,
    start: usize,
    /* negative means previous page size, positive meas next page size */
    size: i32,
    sorted: String,
    pattern: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct MemberScoreValue {
    member: String,
    score: f64,
    rank: usize,
}

async fn execute_zrange_members(
    mut connection: MutexGuard<'_, MultiplexedConnection>,
    _ds: String,
    params: ZRangeParam,
    _window: Window,
) -> Value {
    let page_size = params.size.abs() as usize;

    let is_pattern_scan = match &params.pattern {
        None => false,
        Some(v) => !v.is_empty(),
    };
    let mut ret = vec![];
    let mut start = 0usize;
    let mut end = 0usize;

    let mut left = 0;
    let mut right = 0;
    if params.size > 0 {
        start = params.start;
        end = start + page_size;
        left = start;
    } else {
        end = params.start;
        start = if end > page_size { end - page_size } else { 0 };
        right = end;
    }

    let mut filter_pattern = Regex::new("").unwrap();
    if is_pattern_scan {
        filter_pattern = Regex::new(&params.pattern.unwrap()).unwrap();
    }

    let data_len: i32 = redis::cmd("ZCARD")
        .arg(&params.key)
        .query_async(connection.deref_mut()).await
        .unwrap();
    let mut nomore = false;
    loop {
        let mut cmd = Cmd::new();
        match "desc".eq_ignore_ascii_case(&params.sorted) {
            true => cmd.arg("ZREVRANGE"),
            false => cmd.arg("ZRANGE"),
        };

        let result: Vec<(String, f64)> = cmd
            .arg(&params.key)
            .arg(start)
            .arg(end)
            .arg("WITHSCORES")
            .query_async(connection.deref_mut()).await
            .unwrap();

        let cnt = result.len();
        let mut fetch_count = 0;

        for idx in 0..std::cmp::min(cnt, page_size) {
            let idx = match params.size > 0 {
                true => idx,
                false => cnt - idx - 1,
            };
            let item = result.get(idx).unwrap().clone();
            let member = item.0;
            let score = item.1;
            if is_pattern_scan {
                if !filter_pattern.is_match(&member) {
                    continue;
                }
            }

            let rank = start + idx + 1;
            let val = MemberScoreValue {
                member,
                score,
                rank,
            };
            match params.size > 0 {
                true => ret.push(val),
                false => ret.insert(0, val),
            }

            fetch_count = fetch_count + 1;
            if ret.len() >= page_size {
                break;
            }
        }
        if !is_pattern_scan || cnt == 0 || ret.len() >= page_size {
            if cnt <= page_size {
                nomore = true;

                if params.size < 0 {
                    left = end - cnt;
                } else {
                    right = start + cnt;
                }
            } else {
                if params.size > 0 {
                    right = start + page_size;
                } else {
                    left = start;
                }
            }
            break;
        }
        if params.size > 0 {
            start = start + page_size;
            end = start + page_size;
        } else {
            if end == 0 {
                break;
            }
            end = if end > page_size { end - page_size } else { 0 };
            start = if end > page_size { end - page_size } else { 0 };
        }
    }

    json!({
        "data": ret,
        "total": data_len,
        "nomore": nomore,
        "left": left,
        "right": right
    })
}

#[derive(Serialize, Deserialize)]
struct LRangeParam {
    key: String,
    start: usize,
    size: usize,
    pattern: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct ListMemberScoreValue {
    element: String,
    idx: usize,
}

async fn execute_lrange_members(
    mut connection: MutexGuard<'_, MultiplexedConnection>,
    _ds: String,
    params: LRangeParam,
    _window: Window,
) -> Value {
    let is_pattern_scan = match &params.pattern {
        None => false,
        Some(v) => !v.is_empty(),
    };
    let mut ret = vec![];
    let mut start = params.start;
    let data_len: i32 = redis::cmd("LLEN")
        .arg(&params.key)
        .query_async(connection.deref_mut()).await
        .unwrap();
    let mut filter_pattern = Regex::new("").unwrap();
    if is_pattern_scan {
        filter_pattern = Regex::new(&params.pattern.unwrap()).unwrap();
    }
    loop {
        let mut cmd = Cmd::new();
        cmd.arg("LRANGE");
        let result: Vec<String> = cmd
            .arg(&params.key)
            .arg(start)
            .arg(start + params.size - 1)
            .query_async(connection.deref_mut()).await
            .unwrap();

        let cnt = result.len();
        for idx in 0..cnt {
            let element = result.get(idx).unwrap().clone();
            if is_pattern_scan {
                if !filter_pattern.is_match(&element) {
                    continue;
                }
            }
            ret.push(ListMemberScoreValue {
                element,
                idx: params.start + idx,
            });
        }
        if !is_pattern_scan || cnt == 0 || ret.len() >= params.size {
            break;
        }
        start = start + params.size;
    }

    json!({
        "data": ret,
        "total": data_len,
        "start": start
    })
}

#[derive(Serialize, Deserialize)]
struct SScanParam {
    key: String,
    start: usize,
    size: usize,
    pattern: Option<String>,
}

async fn execute_sscan(
    mut connection: MutexGuard<'_, MultiplexedConnection>,
    _ds: String,
    params: SScanParam,
    _window: Window,
) -> Value {
    let mut scan_cmd = Cmd::new();
    scan_cmd.arg("SSCAN").arg(&params.key).arg(&params.start);
    if let Some(pattern) = &params.pattern {
        if !pattern.is_empty() {
            scan_cmd.arg("MATCH").arg(pattern);
        }
    }
    let data: Vec<Vec<String>> = scan_cmd
        .arg("COUNT")
        .arg(&params.size)
        .query_async(connection.deref_mut()).await
        .unwrap();

    let total: i32 = cmd("SCARD")
        .arg(&params.key)
        .query_async(connection.deref_mut()).await
        .unwrap();
    if let Some(members) = data.get(1) {
        json!({"data": members, "total": total})
    } else {
        json!({})
    }
}

#[derive(Serialize, Deserialize)]
struct ScanCmd {
    count: Option<usize>,
    page_size: Option<usize>,
    cursor: Option<u64>,
    pattern: String,
}

async fn execute_scan_cmd(
    mut redis_pool: State<'_, RedisPool>,
    _ds: String,
    params: ScanCmd,
    window: Window,
) -> Value {
    let arc = redis_pool.fetch_connection("test").await;
    tokio::spawn(async move {
        let mut con = arc.lock().await;
        // 使用 scan_match 方法迭代匹配指定模式的键
        let pattern = params.pattern.as_str(); // 匹配以 "my_prefix:" 开头的键
        let mut remain_expect_count = params.count.unwrap_or(200);
        let page_size = params.page_size.unwrap_or(20);
        let mut cursor = params.cursor.unwrap_or(0);
        loop {
            let require_count = if remain_expect_count < page_size {
                remain_expect_count
            } else {
                page_size
            };
            let (new_cursor, results): (u64, Vec<String>) = cmd("SCAN")
                .arg(cursor)
                .arg("MATCH")
                .arg(pattern)
                .arg("COUNT")
                .arg(require_count)
                .query_async(con.deref_mut())
                .await
                .unwrap();

            remain_expect_count = if remain_expect_count > results.len() {
                remain_expect_count - results.len()
            } else {
                0
            };
            cursor = new_cursor;

            let payload_json = json!({"cursor": cursor,"keys": results});
            window.emit("redis_scan_event", payload_json).unwrap();
            if remain_expect_count == 0 || cursor == 0 {
                let payload_json = json!({"finished": true});
                window.emit("redis_scan_event", payload_json).unwrap();
                break;
            }
        }
    });
    json!({})
}

pub fn connect() -> String {
    return "[\"localhost\",\"asd\", \"ccc\"]".to_string();
}

pub fn parse_command<'a>(command: &str) -> (String, String, Cmd) {
    let re_str = r#"(?:"(?<double_quote>(?:\\.|[^"\\])*)"|'(?<quote>(?:\\.|[^'\\])*)'|(?<default>[^\s'"]+))"#;
    let re = Regex::new(re_str).unwrap();
    let mut cmd = Cmd::new();
    let mut origin = String::new();
    let mut is_first_item = true;
    let mut command_str = String::new();
    for cap in re.captures_iter(command) {
        match cap.name("default") {
            None => match cap.name("quote") {
                None => match cap.name("double_quote") {
                    None => {}
                    Some(m3) => {
                        let m3str = m3.as_str();
                        origin.push_str(m3str);
                        cmd.arg(m3str);
                    }
                },
                Some(m2) => {
                    let m2str = m2.as_str();
                    origin.push_str(m2str);
                    cmd.arg(m2str);
                }
            },
            Some(m1) => {
                let m1str = m1.as_str();
                origin.push_str(m1str);
                cmd.arg(m1str);
            }
        }
        if is_first_item {
            origin = origin.to_uppercase();
            command_str.push_str(origin.as_str());
            is_first_item = false;
        }
        origin.push_str(" ");
    }
    let trimmed_origin = origin.trim_end();
    return (trimmed_origin.to_string(), command_str, cmd);
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
struct VisibleRedisResp {
    index: Option<i32>,
    plain_text: Option<String>,
    vec: Vec<String>,
    origin_cmd: Option<String>,
    cmd: Option<String>,
    success: bool,
    msg: Option<String>,
}

impl VisibleRedisResp {
    fn plain_text(&mut self, text: String) {
        self.plain_text = Some(text);
    }

    fn vec(&mut self, vec: Vec<String>) {
        self.vec = vec;
    }

    fn get_text(self) -> String {
        self.plain_text.unwrap_or_else(|| "".to_string())
    }
}

impl FromRedisValue for VisibleRedisResp {
    fn from_redis_value(v: &redis::Value) -> RedisResult<Self> {
        let mut resp = VisibleRedisResp::default();
        resp.success = true;
        match *v {
            redis::Value::BulkString(ref bytes) => {
                resp.plain_text(from_utf8(bytes)?.to_string());
                Ok(resp)
            }
            redis::Value::Okay => {
                resp.plain_text("OK".to_string());
                Ok(resp)
            }
            redis::Value::Array(ref val) => {
                let t: Vec<String> = val
                    .iter()
                    .map(|item| Self::from_redis_value(item).unwrap().plain_text.unwrap())
                    .collect();
                let mut inner = VisibleRedisResp::default();
                inner.success = true;
                inner.vec(t);
                Ok(inner)
            }
            redis::Value::Int(ref val) => {
                resp.plain_text(val.to_string());
                Ok(resp)
            }
            redis::Value::Nil => {
                resp.plain_text("(nil)".to_string());
                Ok(resp)
            }
            _ => unimplemented!()
        }
    }
}

async fn run_redis_command(single_command: &str, connection: &mut MutexGuard<'_, MultiplexedConnection>) -> VisibleRedisResp {
    let parse_result = parse_command(single_command.trim());
    let cmd_formatted = parse_result.0;
    let cmd_str = parse_result.1;
    let cmd = parse_result.2;
    match cmd.query_async::<VisibleRedisResp>(connection.deref_mut()).await {
        Ok(mut res) => {
            res.origin_cmd = Some(cmd_formatted.to_string());
            res.cmd = Some(cmd_str);
            res
        }
        Err(err) => {
            let mut res = VisibleRedisResp::default();
            res.success = false;
            res.origin_cmd = Some(cmd_formatted.to_string());

            let detail_str = err.detail().unwrap_or("unknown").to_string();
            if detail_str == "syntax error" {
                res.msg = Some("Unsupported command.".to_string());
            } else {
                res.msg = Some(detail_str);
            }
            res
        }
    }
}

async fn execute_batch_redis_command<F>(
    script: &str,
    connection: &mut MutexGuard<'_, MultiplexedConnection>,
    mut result_consumer: F,
) -> Vec<VisibleRedisResp>
where
    F: FnMut(VisibleRedisResp),
{
    let each_command = script.split("\n");
    let mut response_list: Vec<VisibleRedisResp> = vec![];
    let mut index = 0;
    for single_cmd in each_command {
        if !single_cmd.trim().is_empty() {
            let mut resp = run_redis_command(single_cmd, connection).await;
            resp.index = Some(index);
            index = index + 1;
            result_consumer(resp.clone());
            response_list.push(resp);
        }
    }
    response_list
}
