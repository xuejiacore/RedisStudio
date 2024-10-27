use crate::indexer::indexer_initializer::IDX_NAME_FAVOR;
use crate::indexer::redis_indexer::RedisIndexer;
use crate::indexer::tantivy_indexer::TantivyIndexer;
use crate::storage::sqlite_storage::SqliteStorage;
use crate::view::command::CommandDispatcher;
use crate::CmdError;
use serde_json::json;
use sqlx::Row;
use tantivy::query::{BooleanQuery, Occur, Query, TermQuery};
use tantivy::schema::{IndexRecordOption, Schema};
use tantivy::Term;
use tauri::{AppHandle, Runtime, State, Window};

type Result<T> = std::result::Result<T, CmdError>;

/// query key favor status by provided key name
#[tauri::command]
pub async fn key_favor_status<R: Runtime>(
    datasource: &str,
    key: &str,
    handler: AppHandle<R>,
    window: Window<R>,
    tantivy_indexer: State<'_, TantivyIndexer>,
    redis_indexer: State<'_, RedisIndexer>,
) -> Result<String> {
    let result = tantivy_indexer.search_with_params(IDX_NAME_FAVOR, |index, params_builder| {
        let schema = index.schema();
        let key_kw_term_query = build_text_term(&schema, "key.keyword", key);
        let datasource_term_query = build_text_term(&schema, "datasource.keyword", datasource);
        let sub_query = vec![
            (Occur::Must, datasource_term_query),
            (Occur::Must, key_kw_term_query),
        ];
        let query = BooleanQuery::new(sub_query);
        params_builder.with_query(Box::new(query));
    }).await;
    let favored = match result {
        Ok(docs) => {
            docs.hits > 0
        }
        Err(_) => false
    };
    Ok(json!({"favored": favored}).to_string())
}

/// add or remove key from favor list.
#[tauri::command]
pub async fn operate_key_favor<R: Runtime>(
    datasource: &str,
    database: i64,
    key: &str,
    op_type: i16,
    key_type: &str,
    handler: AppHandle<R>,
    window: Window<R>,
    tantivy_indexer: State<'_, TantivyIndexer>,
    redis_indexer: State<'_, RedisIndexer>,
) -> Result<String> {
    redis_indexer.operate_favor(datasource, database, key, key_type, op_type).await;
    Ok(json!({"success": true}).to_string())
}

#[tauri::command]
pub async fn sys_prop(storage: State<'_, SqliteStorage>, property: &str) -> std::result::Result<String, tauri_plugin_sql::Error> {
    let mut instance = storage.pool.lock().await;
    let db = instance.get_mut("default").unwrap();
    let rows = sqlx::query("select value from tbl_system where field = $1")
        .bind(property)
        .fetch_all(&*db)
        .await?;
    if rows.len() > 0 {
        Ok(rows[0].try_get("value").unwrap())
    } else {
        Ok("".to_string())
    }
}

// receive action from front
#[tauri::command]
pub fn action(data: &str, dispatcher: tauri::State<'_, CommandDispatcher>) -> String {
    dispatcher.dispatch(data)
}

fn build_text_term(schema: &Schema, field_name: &str, field_value: &str) -> Box<dyn Query> {
    let field = schema.get_field(field_name).unwrap();
    let term = Term::from_field_text(field, field_value);
    Box::new(TermQuery::new(term, IndexRecordOption::WithFreqs))
}
