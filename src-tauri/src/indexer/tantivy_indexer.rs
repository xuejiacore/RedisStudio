use std::collections::HashMap;
use std::fmt;
use std::fmt::{Formatter, Write};
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tantivy::{
    DocId, Document, Index, ReloadPolicy, Score, SegmentOrdinal, SegmentReader, TantivyDocument,
    TantivyError,
};
use tantivy::collector::{Collector, SegmentCollector, TopDocs};
use tantivy::query::QueryParser;
use tantivy::schema::{Field, Schema};
use thiserror::Error;
use tokio::sync::Mutex;

pub struct Count;

pub type Result<T> = std::result::Result<T, TantivyError>;

#[derive(Default)]
pub struct SegmentCountCollector {
    count: usize,
}

impl SegmentCollector for SegmentCountCollector {
    type Fruit = usize;

    fn collect(&mut self, _: DocId, _: Score) {
        self.count += 1;
    }

    fn harvest(self) -> usize {
        self.count
    }
}

impl Collector for Count {
    type Fruit = usize;

    type Child = SegmentCountCollector;

    fn for_segment(&self, _: SegmentOrdinal, _: &SegmentReader) -> Result<SegmentCountCollector> {
        Ok(SegmentCountCollector::default())
    }

    fn requires_scoring(&self) -> bool {
        false
    }

    fn merge_fruits(&self, segment_counts: Vec<usize>) -> Result<usize> {
        Ok(segment_counts.into_iter().sum())
    }
}

pub struct TantivyIndexer {
    database_dir: PathBuf,
    indexes: Mutex<HashMap<String, Index>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    hits: usize,
    documents: Vec<Value>,
}

impl fmt::Display for SearchResult {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        let option = serde_json::to_string(self);
        match option {
            Ok(str) => f.write_str(str.as_str()),
            Err(_) => f.write_str("err")
        }
    }
}

impl TantivyIndexer {
    pub fn init(indexer_root: PathBuf) -> Self {
        println!("index document root: {:?}", indexer_root);
        TantivyIndexer {
            database_dir: indexer_root.clone(),
            indexes: Mutex::new(HashMap::new()),
        }
    }

    pub fn create_schema(self, index_name: &str) {}

    pub fn database_dir(&self) -> &PathBuf {
        &self.database_dir
    }

    pub async fn add_index(&self, index_name: String, index: Index) {
        let mut res = self.indexes.lock().await;
        res.insert(index_name, index);
    }

    pub async fn search(&self, index_name: &str, query_str: &str, limit: usize, offset: usize) -> Result<SearchResult> {
        let res = self.indexes.lock().await;
        match res.get(&index_name.to_string()) {
            Some(index) => {
                let reader = index
                    .reader_builder()
                    .reload_policy(ReloadPolicy::OnCommitWithDelay)
                    .try_into()
                    .unwrap();

                let searcher = reader.searcher();

                let schema = index.schema();
                let default_fields: Vec<Field> = schema
                    .fields()
                    .map(|(field, _)| field)
                    .collect();

                // TODO: should be cached
                let query_parser = QueryParser::for_index(&index, default_fields);
                let query = query_parser.parse_query(query_str).unwrap();
                let collector = &(TopDocs::with_limit(limit).and_offset(offset), Count);
                let (top_docs, num_hits) = searcher.search(&query, collector).unwrap();
                let mut result: Vec<Value> = vec![];
                for (_score, doc_address) in top_docs {
                    let retrieved_doc: TantivyDocument = searcher.doc(doc_address).unwrap();
                    result.push(serde_json::from_str(retrieved_doc.to_json(&schema).as_str())?);
                }
                Ok(SearchResult {
                    hits: num_hits,
                    documents: result,
                })
            }
            None => {
                Err(TantivyError::FieldNotFound(String::from("index not exists.")))
            }
        }
    }

    pub async fn write_json(&self, index_name: &str, document: Value) -> Result<()> {
        self.write(index_name, document.to_string().as_str()).await
    }

    pub async fn write(&self, index_name: &str, document_json: &str) -> Result<()> {
        let res = self.indexes.lock().await;

        match res.get(index_name) {
            Some(index) => {
                let schema = index.schema();
                let mut writer = index.writer(15000000).unwrap();
                let doc = serde_json::from_str(document_json).unwrap();
                let document = Self::from_json_object(&schema, doc).unwrap();
                writer.add_document(document)?;
                writer.commit()?;
                Ok(())
            }
            None => Ok(()),
        }
    }

    /// Build a document object from a json-object.
    pub fn from_json_object(
        schema: &Schema,
        json_obj: Map<String, serde_json::Value>,
    ) -> Result<TantivyDocument> {
        let mut doc = TantivyDocument::default();
        for (field_name, json_value) in json_obj {
            if let Ok(field) = schema.get_field(&field_name) {
                let field_entry = schema.get_field_entry(field);
                let field_type = field_entry.field_type();
                match json_value {
                    serde_json::Value::Array(json_items) => {
                        for json_item in json_items {
                            let value = field_type
                                .value_from_json(json_item)
                                .map_err(|e| DocParsingError::ValueError(field_name.clone()))
                                .unwrap();
                            doc.add_field_value(field, value);
                        }
                    }
                    _ => {
                        let value = field_type
                            .value_from_json(json_value)
                            .map_err(|e| DocParsingError::ValueError(field_name.clone()))
                            .unwrap();
                        doc.add_field_value(field, value);
                    }
                }
            }
        }
        Ok(doc)
    }
}

/// Error that may happen when deserializing
/// a document from JSON.
#[derive(Debug, Error, PartialEq)]
pub enum DocParsingError {
    /// The payload given is not valid JSON.
    #[error("The provided string is not valid JSON")]
    InvalidJson(String),
    /// One of the value node could not be parsed.
    #[error("The field '{0:?}' could not be parsed")]
    ValueError(String),
}
