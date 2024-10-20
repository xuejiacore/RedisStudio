use crate::constant;
use crate::indexer::indexer_initializer::{IDX_NAME_FAVOR, IDX_NAME_KEY_PATTERN, IDX_NAME_RECENTLY_ACCESS, IDX_NAME_UNRECOGNIZED_PATTERN};
use crate::indexer::key_tokenize::RedisKeyTokenizer;
use crate::indexer::simple_infer_pattern::{InferResult, PatternInferenceEngine, PatternInferenceEngines};
use crate::indexer::tantivy_indexer::{SearchResult, TantivyIndexer};
use chrono::Utc;
use regex::Regex;
use serde_json::{json, Value};
use std::fmt::Display;
use std::sync::{Arc, Mutex};
use tantivy::query::{BooleanQuery, Occur, Query, TermQuery};
use tantivy::schema::{IndexRecordOption, Schema};
use tantivy::tokenizer::Tokenizer;
use tantivy::{IndexWriter, TantivyDocument, Term};
use uuid::Uuid;

const SCOPE_SYS: u64 = 0;
const SCOPE_SUER: u64 = 1;

#[derive(Debug, thiserror::Error)]
pub enum IndexError {
    #[error("unsupported datatype: {0}")]
    Unknown(String),
    #[error("index value {0} exists.")]
    IndexExists(String),
    #[error("system error: {0}")]
    SystemErr(String),
    #[error("inference engine for datasource: {0} have not been initialized.")]
    PatternInferenceNotReady(String),
}

type Result<T> = std::result::Result<T, IndexError>;

pub struct RedisIndexer {
    tantivy_indexer: Arc<Mutex<TantivyIndexer>>,
    inference_engine: Arc<Mutex<PatternInferenceEngines>>,
}

impl RedisIndexer {
    pub fn new(indexer: Arc<Mutex<TantivyIndexer>>, inference_engine: Arc<Mutex<PatternInferenceEngines>>) -> Self {
        Self {
            tantivy_indexer: indexer,
            inference_engine,
        }
    }

    /// initialize datasource's exists pattern.
    ///
    /// ## Parameters
    ///
    /// * `datasource` - datasource id
    /// * `tantivy_indexer` - tantivy indexer implementation.
    /// * `engines` - pattern inference engines.
    pub async fn initialize_datasource_pattern(&self, datasource: &str) {
        let query_result = {
            let tantivy_indexer = self.tantivy_indexer.lock().unwrap();

            // 1. read all recorded pattern data in tantivy which own by specify `datasource`.
            let query_result = tantivy_indexer.search_with_params(IDX_NAME_KEY_PATTERN, |index, search_params| {
                let schema = index.schema();
                let keyword_pattern = schema.get_field("datasource.keyword").unwrap();
                let term = Term::from_field_text(keyword_pattern, datasource);
                let query = TermQuery::new(term, IndexRecordOption::Basic);
                search_params.with_limit_offset(100, 0).with_query(Box::new(query));
            }).await;
            query_result.clone()
        };

        // 2. pick up the pattern and put them into engines.
        let known_patterns: Vec<(String, f32)>;
        if let Ok(result) = query_result {
            known_patterns = result.documents.into_iter().map(|d| {
                // collect origin pattern keyword string.
                let pattern_str = d.get("pattern.keyword")
                    .and_then(Value::as_array)
                    .and_then(|v| v[0].as_str())
                    .unwrap_or_else(|| "").to_string();

                // collect origin pattern's score
                let score = d.get("score")
                    .and_then(Value::as_array)
                    .and_then(|v| v[0].as_f64())
                    .map(|v| v as f32).unwrap_or_else(|| 0f32);
                (pattern_str, score)
            }).collect();
        } else {
            known_patterns = vec![];
        }

        // loading all fetched patterns form tantivy index.
        let engines = self.inference_engine.lock().unwrap();
        let mut engine_map = engines.datasource_pattern.lock().unwrap();
        if let Some(eng) = engine_map.get_mut(datasource) {
            eng.load_known_pattern(known_patterns);
        } else {
            let mut eng = PatternInferenceEngine::new();
            eng.load_known_pattern(known_patterns);
            engine_map.insert(String::from(datasource), eng);
        }
    }

    /// infer key pattern from known patterns.
    /// ## Parameters
    /// * `datasource_id` - id of datasource
    /// * `key` - key name for infer
    pub async fn fast_infer<T: AsRef<str>>(&self, datasource_id: &str, key: &Vec<T>) -> Option<InferResult> {
        let try_engine = {
            let mut engine = self.inference_engine.lock().unwrap();
            let mut inference = engine.datasource_pattern.lock().unwrap();
            inference.get(datasource_id).cloned()
        };
        let inference_input = key.iter().map(|v| v.as_ref().to_string()).collect();
        try_engine?.infer_from_items(&inference_input)
    }

    /// infer key pattern from known patterns or save new pattern when unrecognized.
    /// ## Parameters
    /// * `datasource_id` - id of datasource
    /// * `key` - key name for infer
    pub async fn infer<T: AsRef<str> + Display + Copy>(&self, datasource_id: &str, key: T) -> Option<InferResult> {
        let opt = {
            self.fast_infer(datasource_id, &vec![key]).await
        };
        match opt {
            None => {
                /*
                We could not infer from known patterns. So we try to extract unrecognized keys from
                history temporary index. Combine test key into history keys, or save this key into
                temporary index.
                 */
                let key_ref = key.as_ref();
                let segment: Vec<&str> = key_ref.split(constant::REDIS_KEY_SEPARATOR).collect();

                // query all current unrecognized key name. try to group by separator and infer.
                let result = {
                    let segment_len = segment.len();
                    self.search_similar_key_names(datasource_id, key_ref, segment_len).await
                };

                let search_result = result.unwrap();
                if search_result.hits > 0 {
                    /*
                    unwrap the result from index, which documents matched by `key.keyword` and `datasource.keyword`.
                    then extract keys and doc_ids (for delete after recognized pattern).
                    */
                    let (mut keys, doc_ids) = Self::unwrap_unrecognized_pattern(search_result);
                    // combine current key to history for inferring.
                    keys.push(key_ref.to_string());

                    match self.fast_infer(datasource_id, &keys).await {
                        None => None,
                        Some(result) => self.save_new_recognized_pattern(datasource_id, &mut keys, &doc_ids, result).await
                    }
                } else {
                    if segment.len() > 1 {
                        // insert into temporary index.
                        self.save_unrecognized(datasource_id, segment, key_ref).await;
                    }
                    None
                }
            }
            Some(result) => Some(result)
        }
    }

    async fn save_unrecognized(&self, datasource_id: &str, segment: Vec<&str>, key_ref: &str) {
        let now = Utc::now();
        let timestamp_millis = now.timestamp_millis();
        let segment_len = segment.len().to_string();
        let doc_id = Uuid::new_v4().to_string();
        let doc = json!({
            "doc_id": doc_id,
            "key.keyword": key_ref,
            "key": key_ref,
            "datasource.keyword": datasource_id,
            "ts": timestamp_millis,
            "segment": segment_len,
        });
        let indexer = self.tantivy_indexer.lock().unwrap();
        let index_map = indexer.indexes.lock().unwrap();
        let index = index_map.get(IDX_NAME_UNRECOGNIZED_PATTERN).cloned();

        let doc_json = doc.to_string();
        TantivyIndexer::write_json_doc(&doc_json, &index.unwrap()).unwrap();
    }

    async fn save_new_recognized_pattern(&self, datasource_id: &str, keys: &mut Vec<String>, doc_ids: &Vec<String>, infer_result: InferResult) -> Option<InferResult> {
        let pattern = infer_result.recognized_pattern.clone();
        let score = infer_result.score;
        let normalized_pattern = infer_result.normalized();
        let mut try_engine = {
            let engines = self.inference_engine.lock().unwrap();
            let mut inference = engines.datasource_pattern.lock().unwrap();
            inference.get_mut(datasource_id).cloned()
        };

        if let Some(mut eng) = try_engine {
            eng.load_known_pattern(vec![(pattern.clone(), score)]);

            // index or update exists document record when pattern was recognized.
            let now = Utc::now();
            let timestamp_millis = now.timestamp_millis();

            let doc = json!({
                "pattern.keyword": pattern,
                "pattern": pattern,
                "datasource.keyword": datasource_id,
                "score": score,
                "scope": SCOPE_SYS,
                "ts": timestamp_millis,
                "typical_samples": &keys,
                "normalization": normalized_pattern,
            });

            // check exists document by `pattern.keyword`
            let index = {
                let indexer = self.tantivy_indexer.lock().unwrap();
                let indexes = indexer.indexes.lock().unwrap();
                indexes.get(IDX_NAME_KEY_PATTERN)?.clone()
            };
            let pattern_ref = pattern.as_str();

            let query_exists_result = TantivyIndexer::searching_with_params(&index, |index, search_params| {
                let schema = index.schema();
                let query = build_text_term(&schema, "pattern.keyword", pattern_ref);
                search_params.with_limit_offset(1, 0).with_query(Box::new(query));
            }).await;

            let _ = match query_exists_result {
                Ok(result) => {
                    if result.size() > 0 {
                        let index = {
                            let indexer = self.tantivy_indexer.lock().unwrap();
                            let indexes = indexer.indexes.lock().unwrap();
                            indexes.get(IDX_NAME_KEY_PATTERN)?.clone()
                        };
                        let schema = index.schema();
                        let pattern_keyword = schema.get_field("pattern.keyword").unwrap();
                        let delete_term = Term::from_field_text(pattern_keyword, pattern_ref);
                        // if !tantivy_indexer.delete(IDX_NAME_KEY_PATTERN, delete_term).await.unwrap() {
                        //     return Err(IndexError::SystemErr(String::from("fail to delete old document.")));
                        // }
                    }
                    let doc_json = doc.to_string();
                    match TantivyIndexer::write_json_doc(&doc_json, &index) {
                        Ok(_result) => Ok(()),
                        Err(_err) => Err(IndexError::Unknown(String::from(""))),
                    }
                }
                Err(err) => Err(IndexError::Unknown(err.to_string())),
            };

            // delete temporary similar keys data.
            self.clean_temporary_similar_keys(&doc_ids).await;
        }
        Some(infer_result)
    }

    async fn clean_temporary_similar_keys(&self, doc_ids: &Vec<String>) {
        let indexer = {
            let indexer = self.tantivy_indexer.lock().unwrap();
            let indexes = indexer.indexes.lock().unwrap();
            indexes.get(IDX_NAME_UNRECOGNIZED_PATTERN).unwrap().clone()
        };
        for doc_id in doc_ids {
            let schema = indexer.schema();
            let doc_id_field = schema.get_field("doc_id").unwrap();
            let delete_term = Term::from_field_text(doc_id_field, doc_id);
            let mut writer: IndexWriter<TantivyDocument> = indexer.writer(15000000).unwrap();
            writer.delete_term(delete_term);
            writer.commit().unwrap();
        }
    }
    /// unwrap from tantivy search result
    ///
    /// ## Parameters
    /// * `search_result` - tantivy search result
    ///
    /// ## Return
    /// * (Vec<String>, Vec<String>) - (keys, doc_ids)
    fn unwrap_unrecognized_pattern(search_result: SearchResult) -> (Vec<String>, Vec<String>) {
        let mut keys: Vec<String> = vec![];
        let mut doc_ids: Vec<String> = vec![];
        for doc in search_result.documents {
            let kw = doc.get("key.keyword").expect("Value not exists")
                .as_array().expect("Value not an array")[0]
                .as_str().expect("Value not str")
                .to_string();
            keys.push(kw);

            let doc_id = doc.get("doc_id").expect("Value not exists")
                .as_array().expect("Value not an array")[0]
                .as_str().expect("Value not str")
                .to_string();
            doc_ids.push(doc_id);
        }
        (keys, doc_ids)
    }

    /// search similar key names from temporary index.
    ///
    /// ## Parameters
    /// * `datasource_id` - id of datasource
    /// * `key_ref` - key name
    /// * `indexer` - tantivy indexer manager
    /// * `segment_len` - length of key separated by separator.
    async fn search_similar_key_names(
        &self,
        datasource_id: &str,
        key_ref: &str,
        segment_len: usize,
    ) -> crate::indexer::tantivy_indexer::Result<SearchResult> {
        let index = {
            let indexer = self.tantivy_indexer.lock()?;
            let idx = indexer.indexes.lock()?;
            idx.get(IDX_NAME_UNRECOGNIZED_PATTERN).unwrap().clone()
        };

        TantivyIndexer::searching_with_params(&index, |index, search_params| {
            let schema = index.schema();
            let datasource_term_query = build_text_term(&schema, "datasource.keyword", datasource_id);
            let key_kw_term_query = build_text_term(&schema, "key.keyword", key_ref);
            let seg_len_term_query = build_text_term(&schema, "segment", &segment_len.to_string());

            let mut sub_query = vec![
                (Occur::Must, datasource_term_query),
                (Occur::Must, seg_len_term_query),
                (Occur::MustNot, key_kw_term_query),
            ];
            Self::construct_sub_query(key_ref, schema, &mut sub_query);
            let query = BooleanQuery::new(sub_query);

            search_params.with_limit_offset(50, 0).with_query(Box::new(query));
        }).await
    }

    /// construct sub query by provided tokenizer.
    fn construct_sub_query(key_ref: &str, schema: Schema, mut sub_query: &mut Vec<(Occur, Box<dyn Query>)>) {
        let mut tokenizer = RedisKeyTokenizer;
        let mut token_stream = tokenizer.token_stream(key_ref);
        // build effective (exclude number) subquery by `Should` condition.
        let mut pattern_sub_query = vec![];
        let regex = Regex::new("^[a-zA-Z]+$").unwrap();
        while token_stream.advance() {
            let token = token_stream.token();
            if token.text.parse::<i32>().is_err() {
                let is_pure_alphabet = regex.is_match(&token.text);
                if is_pure_alphabet {
                    let key_field = schema.get_field("key").unwrap();
                    let key_term = Term::from_field_text(key_field, &token.text);
                    let key_query: Box<dyn Query> = Box::new(TermQuery::new(key_term, IndexRecordOption::WithFreqsAndPositions));
                    pattern_sub_query.push((Occur::Must, key_query));
                }
            }
        }
        if !pattern_sub_query.is_empty() {
            let bq = BooleanQuery::new(pattern_sub_query);
            sub_query.push((Occur::Must, Box::new(bq)));
        }
    }

    /// search known pattern from `KEY_PATTERN_INDEX_NAME` index.
    ///
    /// ## Parameters
    /// * `datasource` - id of datasource
    /// * `pattern` - pattern
    pub async fn search_known_pattern(&self, datasource: &str, pattern: &str) -> Result<SearchResult> {
        let tantivy_indexer = self.tantivy_indexer.lock().unwrap();

        // search known patterns by provided pattern. (limit 5 records)
        match tantivy_indexer.search_with_params(IDX_NAME_KEY_PATTERN, |index, params| {
            let schema = index.schema();
            let pattern_field = schema.get_field("pattern.keyword").unwrap();
            let term = Term::from_field_text(pattern_field, pattern);
            let pattern_query = TermQuery::new(term, IndexRecordOption::WithFreqs);

            let datasource_field = schema.get_field("datasource.keyword").unwrap();
            let datasource_term = Term::from_field_text(datasource_field, datasource);
            let datasource_query = TermQuery::new(datasource_term, IndexRecordOption::WithFreqs);

            let bool_query = BooleanQuery::new(vec![
                (Occur::Must, Box::new(pattern_query)),
                (Occur::Must, Box::new(datasource_query))
            ]);
            params.with_limit_offset(5, 0).with_query(Box::new(bool_query));
        }).await {
            Ok(result) => Ok(result),
            Err(err) => Err(IndexError::SystemErr(err.to_string())),
        }
    }

    //noinspection ALL
    /// record key access history
    ///
    /// ## Parameters
    /// * `datasource` - id of datasource
    /// * `key` - key name
    /// * `key_type` - type of key
    pub async fn record_key_access_history(&self, datasource: &str, key: &str, key_type: &str) {
        let now = Utc::now();
        let timestamp_millis = now.timestamp_millis();
        let doc_id = Uuid::new_v4().to_string();
        let doc = json!({
            "doc_id": doc_id,
            "key.keyword": key,
            "key": key,
            "datasource.keyword": datasource,
            "ts": timestamp_millis,
            "key_type": key_type
        });
        let idx = {
            let indexer = self.tantivy_indexer.lock().unwrap();
            let index_map = indexer.indexes.lock().unwrap();
            index_map.get(IDX_NAME_RECENTLY_ACCESS).cloned()
        };

        match idx {
            None => {}
            Some(index) => {
                // check data exists
                let result = TantivyIndexer::searching_with_params(&index, |idx, params| {
                    let schema = index.schema();
                    let datasource_term_query = build_text_term(&schema, "datasource.keyword", datasource);
                    let key_kw_term_query = build_text_term(&schema, "key.keyword", key);
                    let mut sub_query = vec![
                        (Occur::Must, datasource_term_query),
                        (Occur::Must, key_kw_term_query),
                    ];
                    let query = BooleanQuery::new(sub_query);
                    params.with_query(Box::new(query));
                }).await;
                match result {
                    Ok(r) => {
                        if r.hits > 0 {
                            let doc_id_value = r.documents.first().unwrap().get("doc_id").unwrap()
                                .as_array().expect("not array")[0].as_str().expect("not string");
                            let schema = index.schema();
                            let doc_id_field = schema.get_field("doc_id").unwrap();
                            let delete_term = Term::from_field_text(doc_id_field, doc_id_value);
                            let mut writer: IndexWriter<TantivyDocument> = index.writer(15000000).unwrap();
                            writer.delete_term(delete_term);
                            writer.commit().unwrap();
                        }
                    }
                    Err(_) => {}
                }

                let doc_json = doc.to_string();
                TantivyIndexer::write_json_doc(&doc_json, &index).unwrap();
            }
        }
    }

    //noinspection ALL
    /// record user favor key
    /// ## Parameters
    /// * `datasource` - id of datasource
    /// * `key` - key name
    /// * `key_type` - type of key
    /// * `op_type` - operate type, -1: delete, 1: add
    pub async fn operate_favor(&self, datasource: &str, key: &str, key_type: &str, op_type: i16) {
        let now = Utc::now();
        let timestamp_millis = now.timestamp_millis();
        let doc_id = Uuid::new_v4().to_string();
        let doc = json!({
            "doc_id": doc_id,
            "key.keyword": key,
            "key": key,
            "datasource.keyword": datasource,
            "ts": timestamp_millis,
            "key_type": key_type
        });
        let idx = {
            let indexer = self.tantivy_indexer.lock().unwrap();
            let index_map = indexer.indexes.lock().unwrap();
            index_map.get(IDX_NAME_FAVOR).cloned()
        };

        match idx {
            None => {}
            Some(index) => {
                // check data exists
                let result = TantivyIndexer::searching_with_params(&index, |idx, params| {
                    let schema = index.schema();
                    let datasource_term_query = build_text_term(&schema, "datasource.keyword", datasource);
                    let key_kw_term_query = build_text_term(&schema, "key.keyword", key);
                    let mut sub_query = vec![
                        (Occur::Must, datasource_term_query),
                        (Occur::Must, key_kw_term_query),
                    ];
                    let query = BooleanQuery::new(sub_query);
                    params.with_query(Box::new(query));
                }).await;

                match result {
                    Ok(r) => {
                        if r.hits > 0 {
                            if op_type == -1 {
                                let doc_id_value = r.documents.first().unwrap().get("doc_id").unwrap()
                                    .as_array().expect("not array")[0].as_str().expect("not string");
                                let schema = index.schema();
                                let doc_id_field = schema.get_field("doc_id").unwrap();
                                let delete_term = Term::from_field_text(doc_id_field, doc_id_value);
                                let mut writer: IndexWriter<TantivyDocument> = index.writer(15000000).unwrap();
                                writer.delete_term(delete_term);
                                writer.commit().unwrap();
                            }
                        } else {
                            if op_type == 1 {
                                // add new document
                                let doc_json = doc.to_string();
                                TantivyIndexer::write_json_doc(&doc_json, &index).unwrap();
                            }
                        }
                    }
                    Err(_) => {}
                }
            }
        }
    }
}

async fn index_or_update(
    datasource: &str,
    pattern: &str,
    score: f32,
    tantivy_indexer: &TantivyIndexer,
    normalized_pattern: String,
    similar_keys: &Vec<String>,
    scope: u64,
) -> Result<()> {

    //
    // match query_exists_result {
    //     Ok(result) => {
    //         if result.size() > 0 {
    //             let indexer = tantivy_indexer.get_indexer(IDX_NAME_KEY_PATTERN).await.unwrap();
    //             let schema = indexer.schema();
    //             let pattern_keyword = schema.get_field("pattern.keyword").unwrap();
    //             let delete_term = Term::from_field_text(pattern_keyword, pattern);
    //             if !tantivy_indexer.delete(IDX_NAME_KEY_PATTERN, delete_term).await.unwrap() {
    //                 return Err(IndexError::SystemErr(String::from("fail to delete old document.")));
    //             }
    //         }
    //         match tantivy_indexer.write_json(IDX_NAME_KEY_PATTERN, doc).await {
    //             Ok(_result) => Ok(()),
    //             Err(_err) => Err(IndexError::Unknown(String::from(""))),
    //         }
    //     }
    //     Err(err) => Err(IndexError::Unknown(err.to_string())),
    // }
    Ok(())
}

/// index redis key name by tantivy indexer.
///
/// # parameters
///
/// * `datasource` - datasource id of key
/// * `key` - key name of redis.
/// * `tantivy_indexer` - custom implementation with tantivy index engine.
///
pub async fn index(datasource: &str, key: &str, tantivy_indexer: &TantivyIndexer, _engines: PatternInferenceEngines) -> Result<()> {
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
        .search_with_params(IDX_NAME_KEY_PATTERN, |_index, search_params| {
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
            match tantivy_indexer.write_json(IDX_NAME_KEY_PATTERN, doc).await {
                Ok(_result) => Ok(()),
                Err(_err) => Err(IndexError::Unknown(String::from(""))),
            }
        }
        Err(_err) => Err(IndexError::Unknown(String::from("tantivy error"))),
    }
}

fn build_text_term(schema: &Schema, field_name: &str, field_value: &str) -> Box<dyn Query> {
    let field = schema.get_field(field_name).unwrap();
    let term = Term::from_field_text(field, field_value);
    Box::new(TermQuery::new(term, IndexRecordOption::WithFreqs))
}
