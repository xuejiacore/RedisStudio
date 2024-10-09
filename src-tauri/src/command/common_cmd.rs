use crate::indexer::indexer_initializer::IDX_NAME_FAVOR;
use crate::indexer::redis_indexer::RedisIndexer;
use crate::indexer::tantivy_indexer::TantivyIndexer;
use crate::CmdError;
use serde_json::json;
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
    key: &str,
    op_type: i16,
    key_type: &str,
    handler: AppHandle<R>,
    window: Window<R>,
    tantivy_indexer: State<'_, TantivyIndexer>,
    redis_indexer: State<'_, RedisIndexer>,
) -> Result<String> {
    redis_indexer.operate_favor(datasource, key, key_type, op_type).await;
    Ok(json!({"success": true}).to_string())
}

fn build_text_term(schema: &Schema, field_name: &str, field_value: &str) -> Box<dyn Query> {
    let field = schema.get_field(field_name).unwrap();
    let term = Term::from_field_text(field, field_value);
    Box::new(TermQuery::new(term, IndexRecordOption::WithFreqs))
}
