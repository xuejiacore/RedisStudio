use crate::indexer::redis_indexer::RedisIndexer;
use crate::indexer::simple_infer_pattern::InferResult;
use crate::indexer::tantivy_indexer::{SearchResult, TantivyIndexer};
use crate::storage::redis_pool::RedisPool;
use crate::CmdError;
use redis::{cmd, RedisResult};
use serde::{Deserialize, Serialize, Serializer};
use serde_json::map::Values;
use serde_json::{json, Value};
use sqlx::query;
use std::future::Future;
use std::ops::DerefMut;
use std::sync::{Arc, Mutex, MutexGuard};
use tantivy::query::{FuzzyTermQuery, RegexQuery};
use tantivy::{TantivyError, Term};
use tauri::ipc::InvokeError;
use tauri::{Runtime, State, Wry};
use tauri_plugin_sql::Error;
use tokio::time;

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
        let regex_query = RegexQuery::from_pattern(query_str.as_str(), normalize_field).unwrap();
        params_builder
            .with_limit_offset(limit, offset)
            .with_query(Box::new(regex_query));
    });

    let search_from_datasource = datasource_search(query);
    let key_exactly_match = key_exactly_match(query, redis_pool);

    let (index_result, datasource_result, exactly_key)
        = tokio::join!(search_from_index, search_from_datasource, key_exactly_match);

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
    if let Ok(tp) = exactly_key {
        if !tp.eq("none") {
            search_result.add("key".to_string(), 1, vec![
                json!({"key": query, "type": tp})
            ]);
        }
    }

    println!("result {}", search_result.results.len());
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
async fn key_exactly_match(query: &str, redis_pool: State<'_, RedisPool>) -> RedisResult<String> {
    let arc = redis_pool.get_active_connection();
    let binding = arc.await;
    let mut mutex = binding.lock().await;
    let ret: RedisResult<String> = cmd("TYPE").arg(query).query_async(mutex.deref_mut()).await;
    ret
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