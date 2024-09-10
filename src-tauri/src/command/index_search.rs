use crate::indexer::redis_indexer::RedisIndexer;
use crate::indexer::simple_infer_pattern::InferResult;
use crate::indexer::tantivy_indexer::TantivyIndexer;
use crate::CmdError;
use serde::{Deserialize, Serialize, Serializer};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex, MutexGuard};
use tantivy::query::{FuzzyTermQuery, RegexQuery};
use tantivy::{TantivyError, Term};
use tauri::ipc::InvokeError;
use tauri::{Runtime, State, Wry};
use tauri_plugin_sql::Error;

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
    handle: tauri::AppHandle<R>,
    _window: tauri::Window<Wry>,
) -> Result<String> {
    println!("search index: {}, query: {}", index_name, query);
    let search_from_index = indexer.search_with_params(index_name, |index, params_builder| {
        let schema = index.schema();
        let normalize_field = schema.get_field("normalization").unwrap();
        let regex_query = RegexQuery::from_pattern(query, normalize_field).unwrap();
        params_builder
            .with_limit_offset(limit, offset)
            .with_query(Box::new(regex_query));
    });

    let mut search_result = SearchResultDto::new();
    let (index_result, ) = tokio::join!(search_from_index);
    match index_result {
        Ok(result) => {
            let hits = &result.hits;
            let documents = &result.documents;
            search_result.add("key_pattern".to_string(), *hits, documents.clone());
        }
        Err(_) => {}
    }
    Ok(json!(search_result).to_string())
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