use crate::indexer::indexer_initializer::{IDX_NAME_FAVOR, IDX_NAME_KEY_PATTERN, IDX_NAME_RECENTLY_ACCESS};
use crate::indexer::redis_indexer::RedisIndexer;
use crate::indexer::tantivy_indexer::{SearchResult, TantivyIndexer};
use crate::storage::redis_pool::RedisPool;
use crate::CmdError;
use log::info;
use redis::{cmd, RedisResult};
use serde::{Deserialize, Serialize, Serializer};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::future::Future;
use std::ops::DerefMut;
use tantivy::query::{BooleanQuery, Occur, Query, RegexQuery, TermQuery};
use tantivy::schema::{IndexRecordOption, Schema};
use tantivy::{doc, Term};
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
pub async fn spotlight_search<R: Runtime>(
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
    info!("Starting index search");
    let mut search_result = SearchResultDto::new();
    let search_from_index = indexer.search_with_params(IDX_NAME_KEY_PATTERN, |index, params_builder| {
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

    let recently_search = recently_search(query, &indexer, &redis_pool);
    let search_from_datasource = datasource_search(query);
    let scanned_keys = key_scan_match(query, &redis_pool, scan_size);
    let favor_list = search_favor(query, &indexer, &redis_pool, scan_size);

    let (index_result, datasource_result, scanned_keys, favor, recently_result)
        = tokio::join!(search_from_index, search_from_datasource, scanned_keys, favor_list, recently_search);

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

    // favor list
    if let Some(favor_list) = favor {
        search_result.add("favor".to_string(), favor_list.len(), favor_list);
    }

    // recently accessed
    if let Some(recently) = recently_result {
        let hits = recently.len();
        search_result.add("recently".to_string(), hits, recently);
    }
    Ok(json!(search_result).to_string())
}

async fn recently_search(query: &str, indexer: &State<'_, TantivyIndexer>, redis_pool: &State<'_, RedisPool>) -> Option<Vec<Value>> {
    let index = {
        let idx = indexer.indexes.lock().unwrap();
        idx.get(IDX_NAME_RECENTLY_ACCESS).unwrap().clone()
    };
    let result = TantivyIndexer::searching_with_params(&index, |index, search_params| {
        let schema = index.schema();
        let datasource_term_query = build_text_term(&schema, "datasource.keyword", "datasource01");
        let key_kw_term_query = build_text_term(&schema, "key", query);

        let mut should_query = vec![
            (Occur::Should, key_kw_term_query)
        ];

        let field = schema.get_field("key.keyword").unwrap();
        let mut query_str = String::from(".*");
        query_str.push_str(query);
        query_str.push_str(".*");
        match RegexQuery::from_pattern(query_str.as_str(), field) {
            Ok(regex_query) => {
                should_query.push((Occur::Should, Box::new(regex_query)))
            }
            Err(err) => {}
        }

        let should_sub_query = Box::new(BooleanQuery::new(should_query));
        let mut sub_query = vec![
            (Occur::Must, datasource_term_query),
            (Occur::Must, should_sub_query),
        ];

        let query = BooleanQuery::new(sub_query);
        search_params.with_limit_offset(5, 0).with_query(Box::new(query));
    }).await;

    match result {
        Ok(search_result) => {
            if search_result.hits > 0 {
                let mut pipe = redis::pipe();
                search_result.documents.iter().for_each(|k| {
                    pipe.cmd("EXISTS").arg(k.get("key").unwrap().as_array().unwrap()[0].as_str().unwrap());
                });

                let mut conn = {
                    let arc = redis_pool.get_active_connection();
                    let binding = arc.await;
                    let mut mutex = binding.lock().await;
                    mutex.deref_mut().clone()
                };
                let exists_result: Vec<bool> = pipe.query_async(&mut conn).await.unwrap();
                let mut documents = search_result.documents;
                for (idx, val) in documents.iter_mut().enumerate() {
                    let exist = &exists_result[idx];
                    val["exist"] = Value::Bool(*exist);
                }
                Some(documents)
            } else {
                None
            }
        }
        Err(_) => {
            None
        }
    }
}

fn build_text_term(schema: &Schema, field_name: &str, field_value: &str) -> Box<dyn Query> {
    let field = schema.get_field(field_name).unwrap();
    let term = Term::from_field_text(field, field_value);
    Box::new(TermQuery::new(term, IndexRecordOption::WithFreqs))
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
async fn key_scan_match(query: &str, redis_pool: &State<'_, RedisPool>, limit: usize) -> anyhow::Result<Vec<Value>> {
    let mut conn = {
        let arc = redis_pool.get_active_connection();
        let binding = arc.await;
        let mut mutex = binding.lock().await;
        mutex.deref_mut().clone()
    };

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
                .query_async(&mut conn)
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
        let cloned_keys = final_results.clone();
        let mut pipe = redis::pipe();
        final_results.iter().for_each(|k| {
            pipe.cmd("TYPE").arg(k);
        });
        let types: Vec<String> = pipe.query_async(&mut conn).await.unwrap();
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
        let ret: RedisResult<String> = cmd("TYPE").arg(query).query_async(&mut conn).await;
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

/// search user favor keys.
async fn search_favor(query: &str, indexer: &State<'_, TantivyIndexer>, redis_pool: &State<'_, RedisPool>, limit: usize) -> Option<Vec<Value>> {
    let index = {
        let idx = indexer.indexes.lock().unwrap();
        idx.get(IDX_NAME_FAVOR).unwrap().clone()
    };
    let result = TantivyIndexer::searching_with_params(&index, |index, search_params| {
        let schema = index.schema();
        let datasource_term_query = build_text_term(&schema, "datasource.keyword", "datasource01");
        let key_kw_term_query = build_text_term(&schema, "key", query);

        let mut should_query = vec![
            (Occur::Should, key_kw_term_query)
        ];

        let field = schema.get_field("key.keyword").unwrap();
        let mut query_str = String::from(".*");
        query_str.push_str(query);
        query_str.push_str(".*");
        match RegexQuery::from_pattern(query_str.as_str(), field) {
            Ok(regex_query) => {
                should_query.push((Occur::Should, Box::new(regex_query)))
            }
            Err(err) => {}
        }

        let should_sub_query = Box::new(BooleanQuery::new(should_query));
        let mut sub_query = vec![
            (Occur::Must, datasource_term_query),
            (Occur::Must, should_sub_query),
        ];

        let query = BooleanQuery::new(sub_query);
        search_params.with_limit_offset(5, 0).with_query(Box::new(query));
    }).await;

    match result {
        Ok(search_result) => {
            if search_result.hits > 0 {
                let mut pipe = redis::pipe();
                search_result.documents.iter().for_each(|k| {
                    pipe.cmd("EXISTS").arg(k.get("key").unwrap().as_array().unwrap()[0].as_str().unwrap());
                });

                let mut conn = {
                    let arc = redis_pool.get_active_connection();
                    let binding = arc.await;
                    let mut mutex = binding.lock().await;
                    mutex.deref_mut().clone()
                };
                let exists_result: Vec<bool> = pipe.query_async(&mut conn).await.unwrap();
                let mut documents = search_result.documents;
                for (idx, val) in documents.iter_mut().enumerate() {
                    let exist = &exists_result[idx];
                    val["exist"] = Value::Bool(*exist);
                }
                Some(documents)
            } else {
                None
            }
        }
        Err(_) => {
            None
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

#[tauri::command]
pub async fn record_key_access_history<R: Runtime>(
    datasource: &str,
    key: &str,
    key_type: &str,
    redis_indexer: State<'_, RedisIndexer>,
    _handle: tauri::AppHandle<R>,
    window: tauri::Window<Wry>,
) -> Result<String> {
    redis_indexer.record_key_access_history(datasource, key, key_type).await;
    Ok(json!({}).to_string())
}