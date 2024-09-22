use crate::indexer::redis_indexer::RedisIndexer;
use crate::indexer::tantivy_indexer::TantivyIndexer;
use crate::storage::redis_pool::RedisPool;
use crate::CmdError;
use redis::{cmd, RedisResult};
use serde::{Deserialize, Serialize, Serializer};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::future::Future;
use std::ops::DerefMut;
use tantivy::query::RegexQuery;
use tauri::{Runtime, State, Wry};

type Result<T> = std::result::Result<T, CmdError>;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
struct SearchResultItem {
    scene: String,
    hits: usize,
    documents: Vec<Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
struct SearchResultDto {
    results: Vec<SearchResultItem>,
}

impl SearchResultDto {
    fn new() -> Self {
        SearchResultDto {
            results: Vec::new(),
        }
    }

    fn add(&mut self, scene: String, hits: usize, documents: Vec<Value>) {
        self.results.push(SearchResultItem { scene, hits, documents });
    }
}

/// search documents by provided query string.
#[tauri::command]
pub async fn search<R: Runtime>(
    index_name: &str,
    query: &str,
    limit: usize,
    scan_size: usize,
    offset: usize,
    indexer: State<'_, TantivyIndexer>,
    redis_pool: State<'_, RedisPool>,
    handle: tauri::AppHandle<R>,
    _window: tauri::Window<Wry>,
) -> Result<String> {
    let mut search_result = SearchResultDto::new();
    let search_from_index = indexer.search_with_params(index_name, |index, params_builder| {
        let schema = index.schema();
        let normalize_field = schema.get_field("normalization").unwrap();

        let mut query_str = String::from(".*");
        query_str.push_str(query);
        query_str.push_str(".*");
        match RegexQuery::from_pattern(query_str.as_str(), normalize_field) {
            Ok(regex_query) => {
                params_builder
                    .with_limit_offset(limit, offset)
                    .with_query(Box::new(regex_query));
            }
            Err(err) => {}
        }
    });

    let search_from_datasource = datasource_search(query);
    let scanned_keys = key_scan_match(query, redis_pool, scan_size);

    let (index_result, datasource_result, scanned_keys)
        = tokio::join!(search_from_index, search_from_datasource, scanned_keys);

    // datasource result
    if let Some(result) = datasource_result {
        search_result.add("datasource".to_string(), 2, result);
    }

    // search from tantivy index
    if let Ok(result) = index_result {
        let hits = &result.hits;
        let documents = &result.documents;
        search_result.add("key_pattern".to_string(), *hits, documents.clone());
    }

    // exactly matched key
    if let Ok(tp) = scanned_keys {
        let t = tp.len();
        search_result.add("key".to_string(), t, tp);
    }
    Ok(json!(search_result).to_string())
}

/// search matched datasource from all configurations.
async fn datasource_search(query: &str) -> Option<Vec<Value>> {
    if query.starts_with("use ") || query.eq("use")
        || query.starts_with("select ") || query.eq("select") {
        return Some(vec![
            json!({"hostport": "localhost:6379", "desc": "localhost","connected": true}),
            json!({"hostport": "192.168.3.321:6379", "desc": "biz test01", "connected": false}),
        ]);
    }
    None
}

/// exactly matched key name and type.
async fn key_scan_match(query: &str, redis_pool: State<'_, RedisPool>, limit: usize) -> anyhow::Result<Vec<Value>> {
    let arc = redis_pool.get_active_connection();
    let binding = arc.await;
    let mut mutex = binding.lock().await;

    let replaced = query.replace("*", "");
    if query.contains("*") && replaced.len() > 0 {
        let mut remain_expect_count = limit;
        let page_size = 400;
        let mut cursor = 0;

        let mut final_results = vec![];
        loop {
            let (new_cursor, results): (u64, Vec<String>) = cmd("SCAN")
                .arg(cursor)
                .arg("MATCH")
                .arg(query)
                .arg("COUNT")
                .arg(page_size)
                .query_async(mutex.deref_mut())
                .await
                .unwrap();

            remain_expect_count = if remain_expect_count > results.len() {
                remain_expect_count - results.len()
            } else {
                0
            };
            cursor = new_cursor;

            final_results.extend(results);
            if remain_expect_count == 0 || cursor == 0 {
                break;
            }
        }

        if final_results.len() > limit {
            final_results.truncate(limit);
        }
        let mut pipe = redis::pipe();
        let cloned_keys = final_results.clone();
        final_results.iter().for_each(|k| {
            pipe.cmd("TYPE").arg(k);
        });
        let types: Vec<String> = pipe.query_async(mutex.deref_mut()).await.unwrap();
        let mut map = HashMap::new();
        for idx in 0..cloned_keys.len() {
            let key = &cloned_keys[idx];
            let t = &types[idx];
            map.insert(key, t);
        }

        anyhow::Ok(map.iter().map(|(key, tp)| {
            json!({"key": key, "type": tp})
        }).collect::<Vec<Value>>())
    } else {
        let ret: RedisResult<String> = cmd("TYPE").arg(query).query_async(mutex.deref_mut()).await;
        match &ret {
            Ok(tp) => {
                if !tp.eq("none") {
                    anyhow::Result::Ok(vec![json!({"key": query, "type": tp})])
                } else {
                    anyhow::Result::Ok(vec![])
                }
            }
            Err(e) => anyhow::Result::Ok(vec![])
        }
    }
}

/// add document to index.
#[tauri::command]
pub async fn write_index<R: Runtime>(
    index_name: &str,
    document: &str,
    indexer: State<'_, TantivyIndexer>,
    _handle: tauri::AppHandle<R>,
    window: tauri::Window<Wry>,
) -> Result<String> {
    match indexer.write(index_name, document).await {
        Ok(_) => Ok(json!({"success": true}).to_string()),
        Err(_err) => Err(CmdError::Unknown(String::from("sdd"))),
    }
}

#[tauri::command]
pub async fn infer_redis_key_pattern<R: Runtime>(
    datasource: &str,
    key: &str,
    redis_indexer: State<'_, RedisIndexer>,
    _handle: tauri::AppHandle<R>,
    window: tauri::Window<Wry>,
) -> Result<String> {
    match redis_indexer.infer(datasource, key).await {
        None => {
            Ok(json!({
                "recognized": false
            }).to_string())
        }
        Some(infer_result) => {
            let pattern = &infer_result.recognized_pattern;
            let normalized = infer_result.normalized();
            Ok(json!({
                "recognized": true,
                "pattern": pattern,
                "normalized": normalized
            }).to_string())
        }
    }
}