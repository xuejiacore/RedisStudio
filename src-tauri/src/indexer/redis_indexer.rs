use chrono::Utc;
use serde_json::json;
use tantivy::query::{FuzzyTermQuery, TermQuery};
use tantivy::schema::IndexRecordOption;
use tantivy::Term;

use crate::indexer::tantivy_indexer::{SearchResult, TantivyIndexer};

const INDEX_NAME: &str = "key_pattern";

#[derive(Debug, thiserror::Error)]
pub enum IndexError {
    #[error("unsupported datatype: {0}")]
    Unknown(String),
    #[error("index value {0} exists.")]
    IndexExists(String),
    #[error("system error: {0}")]
    SystemErr(String),
}

type Result<T> = std::result::Result<T, IndexError>;

pub async fn match_pattern(
    datasource: &str,
    pattern: &str,
    tantivy_indexer: &TantivyIndexer,
) -> Result<SearchResult> {
    let knife = pattern.split(":");
    let x = tantivy_indexer
        .search_with_params(INDEX_NAME, |index, params| {
            let schema = index.schema();
            let pattern_field = schema.get_field("pattern").unwrap();
            let term = Term::from_field_text(pattern_field, pattern);
            let query = FuzzyTermQuery::new(term, 2, true);
            params.with_limit_offset(5, 0).with_query(Box::new(query));
        })
        .await;
    match x {
        Ok(result) => Ok(result),
        Err(err) => Err(IndexError::SystemErr(err.to_string())),
    }
}

pub async fn index_or_update(
    datasource: &str,
    pattern: &str,
    tantivy_indexer: &TantivyIndexer,
) -> Result<()> {
    // TODO: 分析key的组成结构，如按照 ":" 进行分割
    let now = Utc::now();
    let timestamp_millis = now.timestamp_millis();
    let doc = json!({
        "pattern.keyword": pattern,
        "pattern": pattern,
        "datasource.keyword": datasource,
        "ts": timestamp_millis
    });

    // check exists document by `pattern.keyword`
    let query_exists_result = tantivy_indexer
        .search_with_params(INDEX_NAME, |index, mut search_params| {
            let schema = index.schema();
            let keyword_pattern = schema.get_field("pattern.keyword").unwrap();
            let term = Term::from_field_text(keyword_pattern, pattern);
            let query = TermQuery::new(term, IndexRecordOption::Basic);
            search_params
                .with_limit_offset(1, 0)
                .with_query(Box::new(query));
        })
        .await;

    match query_exists_result {
        Ok(result) => {
            if result.size() > 0 {
                let indexer = tantivy_indexer.get_indexer(INDEX_NAME).await.unwrap();
                let schema = indexer.schema();
                let pattern_keyword = schema.get_field("pattern.keyword").unwrap();
                let delete_term = Term::from_field_text(pattern_keyword, pattern);
                if !tantivy_indexer
                    .delete(INDEX_NAME, delete_term)
                    .await
                    .unwrap()
                {
                    return Err(IndexError::SystemErr(String::from(
                        "fail to delete old document.",
                    )));
                }
            }
            match tantivy_indexer.write_json(INDEX_NAME, doc).await {
                Ok(result) => Ok(()),
                Err(err) => Err(IndexError::Unknown(String::from(""))),
            }
        }
        Err(err) => Err(IndexError::Unknown(err.to_string())),
    }
}

pub async fn index(datasource: &str, key: &str, tantivy_indexer: &TantivyIndexer) -> Result<()> {
    // TODO: 分析key的组成结构，如按照 ":" 进行分割
    let now = Utc::now();
    let timestamp_millis = now.timestamp_millis();
    let doc = json!({
        "pattern.keyword": key,
        "pattern": key,
        "datasource": datasource,
        "ts": timestamp_millis
    });

    let mut query_str = String::new();
    query_str.push_str("pattern.keyword:");
    query_str.push_str("\"");
    query_str.push_str(key);
    query_str.push_str("\"");

    let check_exists_result = tantivy_indexer
        .search_with_params(INDEX_NAME, |index, mut search_params| {
            search_params
                .with_limit_offset(1, 0)
                .with_query_str(query_str.as_str());
        })
        .await;

    match check_exists_result {
        Ok(result) => {
            if result.size() > 0 {
                return Err(IndexError::IndexExists(String::from(key)));
            }
            match tantivy_indexer.write_json(INDEX_NAME, doc).await {
                Ok(result) => Ok(()),
                Err(err) => Err(IndexError::Unknown(String::from(""))),
            }
        }
        Err(err) => Err(IndexError::Unknown(String::from("tantivy error"))),
    }
}
