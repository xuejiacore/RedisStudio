use crate::dao::datasource_dao;
use crate::indexer::indexer_initializer::{
    IDX_NAME_FAVOR, IDX_NAME_KEY_PATTERN, IDX_NAME_RECENTLY_ACCESS,
};
use crate::indexer::redis_indexer::RedisIndexer;
use crate::indexer::tantivy_indexer::{SearchResult, TantivyIndexer};
use crate::storage::redis_pool::RedisPool;
use crate::storage::sqlite_storage::SqliteStorage;
use crate::CmdError;
use futures::FutureExt;
use redis::{cmd, RedisResult};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::ops::DerefMut;
use tantivy::query::{BooleanQuery, Occur, Query, RegexQuery, TermQuery};
use tantivy::schema::{IndexRecordOption, Schema};
use tantivy::{doc, Index, TantivyError, Term};
use tauri::{AppHandle, Emitter, Runtime, State};
use tokio::time::Instant;

type Result<T> = std::result::Result<T, CmdError>;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SearchResultItem {
    scene: String,
    hits: usize,
    documents: Vec<Value>,
    elapsed: Option<u128>,
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
        self.results.push(SearchResultItem {
            scene,
            hits,
            documents,
            elapsed: None,
        });
    }
}

#[tauri::command]
pub async fn initialize_datasource_pattern<R: Runtime>(
    datasource: i64,
    redis_indexer: State<'_, RedisIndexer>,
    handle: AppHandle<R>,
) -> Result<Value> {
    redis_indexer
        .initialize_datasource_pattern(datasource)
        .await;
    Ok(json!({}))
}

/// search documents by provided query string.
#[tauri::command]
pub async fn spotlight_search<R: Runtime>(
    datasource: i64,
    unique_id: i64,
    query: &str,
    limit: usize,
    scan_size: usize,
    offset: usize,
    indexer: State<'_, TantivyIndexer>,
    redis_pool: State<'_, RedisPool>,
    sqlite: State<'_, SqliteStorage>,
    handle: AppHandle<R>,
) -> Result<String> {
    let timer = Instant::now();
    let mut search_result = SearchResultDto::new();

    let list_database = list_database(query, &redis_pool, &handle);
    let search_from_index = search_from_tantivy(query, limit, offset, &indexer, &handle);
    let recently_search = recently_search(query, datasource, &indexer, &redis_pool, &handle);
    let search_from_datasource = datasource_search(query, sqlite, &redis_pool, &handle);
    let scanned_keys = key_scan_match(query, &redis_pool, scan_size);
    let favor_list = search_favor(query, datasource, &indexer, &redis_pool);

    let (
        list_database_result,
        datasource_result,
        index_result,
        scanned_keys,
        favor,
        recently_result,
    ) = tokio::join!(
        list_database,
        search_from_datasource,
        search_from_index,
        scanned_keys,
        favor_list,
        recently_search,
    );

    let elapsed = timer.elapsed().as_millis();
    let finish_event = json!({
        "uniqueId": unique_id,
        "elapsed": elapsed
    });
    handle
        .emit("spotlight/search-finished", finish_event)
        .unwrap();

    if let Some(result) = list_database_result {
        let len = result.len();
        search_result.add("database".to_string(), len, result);
    }

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

async fn search_from_tantivy<R: Runtime>(
    query: &str,
    limit: usize,
    offset: usize,
    indexer: &State<'_, TantivyIndexer>,
    handle: &AppHandle<R>,
) -> std::result::Result<SearchResult, TantivyError> {
    let timer = Instant::now();
    let index_opt: Option<Index> = {
        let res = indexer.indexes.lock()?;
        res.get(IDX_NAME_KEY_PATTERN).cloned()
    };
    match index_opt {
        Some(index) => {
            TantivyIndexer::searching_with_params(&index, |index, params_builder| {
                let schema = index.schema();
                let normalize_field = schema.get_field("normalization").unwrap();

                let mut query_str = String::from(".*");
                query_str.push_str(query);
                query_str.push_str(".*");
                // TODO: with datasource condition
                match RegexQuery::from_pattern(query_str.as_str(), normalize_field) {
                    Ok(regex_query) => {
                        params_builder
                            .with_limit_offset(limit, offset)
                            .with_query(Box::new(regex_query));
                    }
                    Err(_) => {}
                }
            })
            .then(|result| async {
                match result {
                    Ok(data) => {
                        let hits = &data.hits;
                        let documents = &data.documents;
                        let elapsed = timer.elapsed().as_millis();
                        let dto = SearchResultItem {
                            scene: "key_pattern".to_string(),
                            hits: *hits,
                            documents: documents.clone(),
                            elapsed: Some(elapsed),
                        };

                        handle.emit("spotlight/search-result", dto).unwrap();
                        Ok(data)
                    }
                    Err(e) => Err(e),
                }
            })
            .await
        }
        None => Err(TantivyError::FieldNotFound(String::from(
            "index not exists.",
        ))),
    }
}

async fn list_database<R: Runtime>(
    query: &str,
    redis_pool: &State<'_, RedisPool>,
    handle: &AppHandle<R>,
) -> Option<Vec<Value>> {
    let timer = Instant::now();
    let query_lowercase = query.to_lowercase();
    if query_lowercase.starts_with("db") || query_lowercase.starts_with("database") {
        async {
            let info = redis_pool.get_active_info().await;
            let active_database = info.1;

            let arc = redis_pool.get_active_connection().await;
            let mut mutex = arc.lock().await;

            // databases key space info.
            let re =
                Regex::new(r"(?<name>db(?<index>\d+)):keys=(?<keys>\d+),expires=(\d+)").unwrap();
            let keyspace: String = cmd("INFO")
                .arg("KEYSPACE")
                .query_async(mutex.deref_mut())
                .await
                .unwrap();

            let key_space_info: Vec<Value> = keyspace
                .split("\n")
                .filter(|line| line.len() > 0 && !line.starts_with("#"))
                .map(|line| {
                    let cap = re.captures(line).unwrap();
                    let name = String::from(cap.name("name").unwrap().as_str());
                    let index: usize = cap.name("index").unwrap().as_str().parse().unwrap();
                    let keys: i64 = cap.name("keys").unwrap().as_str().parse().unwrap();
                    let active = index as i64 == active_database;
                    json!({"name": name, "index": index, "keys": keys, "active": active})
                })
                .collect();
            key_space_info
        }
        .then(|data| async {
            let hits = &data.len();
            let documents = &data;
            let elapsed = timer.elapsed().as_millis();
            let dto = SearchResultItem {
                scene: "database".to_string(),
                hits: *hits,
                documents: documents.clone(),
                elapsed: Some(elapsed),
            };

            handle.emit("spotlight/search-result", dto).unwrap();
            Some(data)
        })
        .await
    } else {
        None
    }
}

async fn recently_search<R: Runtime>(
    query: &str,
    datasource: i64,
    indexer: &State<'_, TantivyIndexer>,
    redis_pool: &State<'_, RedisPool>,
    handle: &AppHandle<R>,
) -> Option<Vec<Value>> {
    let timer = Instant::now();
    let index = {
        let idx = indexer.indexes.lock().unwrap();
        idx.get(IDX_NAME_RECENTLY_ACCESS).unwrap().clone()
    };
    let result = TantivyIndexer::searching_with_params(&index, |index, search_params| {
        let schema = index.schema();
        let datasource_term_query =
            build_text_term(&schema, "datasource.keyword", &datasource.to_string());
        let key_kw_term_query = build_text_term(&schema, "key", query);

        let mut should_query = vec![(Occur::Should, key_kw_term_query)];

        let field = schema.get_field("key.keyword").unwrap();
        let mut query_str = String::from(".*");
        query_str.push_str(query);
        query_str.push_str(".*");
        match RegexQuery::from_pattern(query_str.as_str(), field) {
            Ok(regex_query) => should_query.push((Occur::Should, Box::new(regex_query))),
            Err(_) => {}
        }

        let should_sub_query = Box::new(BooleanQuery::new(should_query));
        let sub_query = vec![
            (Occur::Must, datasource_term_query),
            (Occur::Must, should_sub_query),
        ];

        let query = BooleanQuery::new(sub_query);
        search_params
            .with_limit_offset(5, 0)
            .with_query(Box::new(query));
    })
    .await;

    async {
        match result {
            Ok(search_result) => {
                if search_result.hits > 0 {
                    let mut pipe = redis::pipe();
                    search_result.documents.iter().for_each(|k| {
                        pipe.cmd("EXISTS").arg(
                            k.get("key").unwrap().as_array().unwrap()[0]
                                .as_str()
                                .unwrap(),
                        );
                    });

                    let mut conn = {
                        let arc = redis_pool.get_active_connection();
                        let binding = arc.await;
                        let mut mutex = binding.lock().await;
                        mutex.deref_mut().clone()
                    };
                    match pipe.query_async::<Vec<bool>>(&mut conn).await {
                        Ok(exists_result) => {
                            let mut documents = search_result.documents;
                            for (idx, val) in documents.iter_mut().enumerate() {
                                let exist = &exists_result[idx];
                                val["exist"] = Value::Bool(*exist);
                            }
                            Some(documents)
                        }
                        _ => None,
                    }
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    }
    .then(|r| async {
        match r {
            None => None,
            Some(values) => {
                let elapsed = timer.elapsed().as_millis();
                let hits = &values.len();
                let documents = &values;
                let dto = SearchResultItem {
                    scene: "recently".to_string(),
                    hits: *hits,
                    documents: documents.clone(),
                    elapsed: Some(elapsed),
                };

                handle.emit("spotlight/search-result", dto).unwrap();
                Some(values)
            }
        }
    })
    .await
}

fn build_text_term(schema: &Schema, field_name: &str, field_value: &str) -> Box<dyn Query> {
    let field = schema.get_field(field_name).unwrap();
    let term = Term::from_field_text(field, field_value);
    Box::new(TermQuery::new(term, IndexRecordOption::WithFreqs))
}

/// search matched datasource from all configurations.
async fn datasource_search<R: Runtime>(
    query: &str,
    sqlite: State<'_, SqliteStorage>,
    redis_pool: &State<'_, RedisPool>,
    handle: &AppHandle<R>,
) -> Option<Vec<Value>> {
    let timer = Instant::now();
    datasource_dao::query_flat_datasource(Some(query.to_string()), sqlite)
        .then(|result| async {
            match result {
                Ok(r) => {
                    let elapsed = timer.elapsed().as_millis();
                    let connected_ds = {
                        let m = redis_pool.get_pool().await;
                        m.keys()
                            .map(|k| {
                                let datasource = k
                                    .split("#")
                                    .collect::<Vec<&str>>()
                                    .get(0)
                                    .expect("unrecognized pattern")
                                    .to_string();
                                datasource
                            })
                            .collect::<HashSet<String>>()
                    };

                    let documents = r
                        .iter()
                        .map(|t| {
                            let id = t.id.to_string();
                            let host = t.host.clone();
                            let desc = t.datasource_name.clone();
                            let connected = connected_ds.contains(&id);
                            json!({"hostport": host,"desc": desc, "connected": connected})
                        })
                        .collect::<Vec<Value>>();
                    let hits = documents.len();
                    let dto = SearchResultItem {
                        scene: "recently".to_string(),
                        hits: hits,
                        documents: documents.clone(),
                        elapsed: Some(elapsed),
                    };
                    handle.emit("spotlight/search-result", dto).unwrap();
                    Some(documents)
                }
                Err(_) => None,
            }
        })
        .await
}

/// exactly matched key name and type.
async fn key_scan_match(
    query: &str,
    redis_pool: &State<'_, RedisPool>,
    limit: usize,
) -> anyhow::Result<Vec<Value>> {
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
                .await?;

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

        anyhow::Ok(
            map.iter()
                .map(|(key, tp)| json!({"key": key, "type": tp}))
                .collect::<Vec<Value>>(),
        )
    } else {
        let ret: RedisResult<String> = cmd("TYPE").arg(query).query_async(&mut conn).await;
        match &ret {
            Ok(tp) => {
                if !tp.eq("none") {
                    Ok(vec![json!({"key": query, "type": tp})])
                } else {
                    Ok(vec![])
                }
            }
            Err(_) => Ok(vec![]),
        }
    }
}

/// search user favor keys.
async fn search_favor(
    query: &str,
    datasource: i64,
    indexer: &State<'_, TantivyIndexer>,
    redis_pool: &State<'_, RedisPool>,
) -> Option<Vec<Value>> {
    let index = {
        let idx = indexer.indexes.lock().unwrap();
        idx.get(IDX_NAME_FAVOR).unwrap().clone()
    };
    let result = TantivyIndexer::searching_with_params(&index, |index, search_params| {
        let schema = index.schema();
        let datasource_term_query =
            build_text_term(&schema, "datasource.keyword", &datasource.to_string());
        let key_kw_term_query = build_text_term(&schema, "key", query);

        let mut should_query = vec![(Occur::Should, key_kw_term_query)];

        let field = schema.get_field("key.keyword").unwrap();
        let mut query_str = String::from(".*");
        query_str.push_str(query);
        query_str.push_str(".*");
        match RegexQuery::from_pattern(query_str.as_str(), field) {
            Ok(regex_query) => should_query.push((Occur::Should, Box::new(regex_query))),
            Err(_) => {}
        }

        let should_sub_query = Box::new(BooleanQuery::new(should_query));
        let sub_query = vec![
            (Occur::Must, datasource_term_query),
            (Occur::Must, should_sub_query),
        ];

        let query = BooleanQuery::new(sub_query);
        search_params
            .with_limit_offset(5, 0)
            .with_query(Box::new(query));
    })
    .await;

    match result {
        Ok(search_result) => {
            if search_result.hits > 0 {
                let mut conn = {
                    let arc = redis_pool.get_active_connection();
                    let binding = arc.await;
                    let mut mutex = binding.lock().await;
                    mutex.deref_mut().clone()
                };

                let mut pipe = redis::pipe();
                search_result.documents.iter().for_each(|k| {
                    pipe.cmd("EXISTS").arg(
                        k.get("key").unwrap().as_array().unwrap()[0]
                            .as_str()
                            .unwrap(),
                    );
                });
                match pipe.query_async::<Vec<bool>>(&mut conn).await {
                    Ok(exists_result) => {
                        let mut documents = search_result.documents;
                        for (idx, val) in documents.iter_mut().enumerate() {
                            let exist = &exists_result[idx];
                            val["exist"] = Value::Bool(*exist);
                        }
                        Some(documents)
                    }
                    _ => None,
                }
            } else {
                None
            }
        }
        Err(_) => None,
    }
}

/// add document to index.
#[tauri::command]
pub async fn write_index<R: Runtime>(
    index_name: &str,
    document: &str,
    indexer: State<'_, TantivyIndexer>,
    _handle: AppHandle<R>,
) -> Result<String> {
    match indexer.write(index_name, document).await {
        Ok(_) => Ok(json!({"success": true}).to_string()),
        Err(_err) => Err(CmdError::Unknown(String::from("sdd"))),
    }
}

#[tauri::command]
pub async fn infer_redis_key_pattern<R: Runtime>(
    datasource: i64,
    database: i64,
    key: &str,
    redis_indexer: State<'_, RedisIndexer>,
    _handle: AppHandle<R>,
) -> Result<String> {
    match redis_indexer.infer(datasource, key).await {
        None => Ok(json!({
            "recognized": false
        })
        .to_string()),
        Some(infer_result) => {
            let pattern = &infer_result.recognized_pattern;
            let normalized = infer_result.normalized();
            Ok(json!({
                "recognized": true,
                "pattern": pattern,
                "normalized": normalized
            })
            .to_string())
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
) -> Result<String> {
    redis_indexer
        .record_key_access_history(datasource, key, key_type)
        .await;
    Ok(json!({}).to_string())
}
