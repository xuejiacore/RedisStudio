use std::path::PathBuf;

use crate::indexer::key_tokenize::RedisKeyTokenizer;
use crate::indexer::tantivy_indexer::TantivyIndexer;
use tantivy::directory::MmapDirectory;
use tantivy::schema::{
    IndexRecordOption, Schema, SchemaBuilder, TextFieldIndexing, TextOptions, FAST, STORED, STRING,
    TEXT,
};
use tantivy::tokenizer::{NgramTokenizer, TextAnalyzer};
use tantivy::Index;

/// specify the directory of indexes.
const C_INDEX_DIRECTORY: &str = "tantivy_index";

/// common key pattern index name.
pub const IDX_NAME_KEY_PATTERN: &str = "key_pattern";
/// unrecognized key pattern, temporary index.
pub const IDX_NAME_UNRECOGNIZED_PATTERN: &str = "key_unrecognized";

fn create_tantivy_index(index_directory: PathBuf, schema_builder: SchemaBuilder) -> Option<Index> {
    if !index_directory.exists() {
        match std::fs::create_dir_all(&index_directory) {
            Ok(_) => {}
            Err(_e) => {}
        }
    }

    let dir = MmapDirectory::open(index_directory).unwrap_or_else(|e| {
        eprintln!("Error opening directory: {}", e);
        std::process::exit(1);
    });
    let schema = schema_builder.build();
    match Index::open_or_create(dir, schema) {
        Ok(index) => Some(index),
        Err(_err) => None,
    }
}

impl TantivyIndexer {
    /// initializer the indexer schema
    pub async fn init_indexer(self) -> Self {
        self.initialize_key_pattern().await;
        self.initialize_unrecognized_keys().await;
        self
    }

    /// initialize temporary unrecognized keys index.
    ///
    /// ## Document structure
    ///
    /// ```json
    /// {
    ///     "doc_id": "foo001",
    ///     "datasource.keyword": "ds01",
    ///     "key": "12:commodity:31",
    ///     "key.keyword": "12:commodity:31",
    ///     "ts": 1724217484327,
    ///     "segment": "3"
    /// }
    /// ```
    async fn initialize_unrecognized_keys(&self) {
        let mut schema_builder = Schema::builder();
        let text_field_indexing = TextFieldIndexing::default()
            .set_tokenizer("redis_key_tokenize") // 使用自定义分词器
            .set_index_option(IndexRecordOption::WithFreqsAndPositions);
        let text_options: TextOptions = TextOptions::default()
            .set_indexing_options(text_field_indexing)
            .set_stored();

        let exactly_options = STRING | STORED | FAST;
        schema_builder.add_text_field("doc_id", exactly_options.clone());
        schema_builder.add_text_field("datasource.keyword", exactly_options.clone());
        schema_builder.add_text_field("key", text_options);
        schema_builder.add_text_field("key.keyword", exactly_options.clone());
        schema_builder.add_u64_field("ts", FAST | STORED);
        schema_builder.add_text_field("segment", exactly_options);
        self.open_or_create_index(IDX_NAME_UNRECOGNIZED_PATTERN, schema_builder).await;
    }

    /// initialize core key pattern index.
    ///
    /// ## Document structure
    ///
    /// ```json
    /// {
    ///     "doc_id": "bar001"
    ///     "normalization": "*:foo:*"
    ///     "datasource.keyword": "ds001",
    ///     "pattern": "\d+:foo:\d+",
    ///     "pattern.keyword": "\d+:foo:\d+",
    ///     "desc": "tmp",
    ///     "scope": 0,
    ///     "ts": 1724217484327,
    ///     "typical_samples": ["12:foo:32","43:foo:321"]
    /// }
    /// ```
    async fn initialize_key_pattern(&self) {
        let mut schema_builder = Schema::builder();
        let text_field_indexing = TextFieldIndexing::default()
            .set_tokenizer("ngram3")
            .set_index_option(IndexRecordOption::WithFreqsAndPositions);
        let text_options: TextOptions = TextOptions::default()
            .set_indexing_options(text_field_indexing)
            .set_stored();

        let custom_options: TextOptions = text_options;
        let exactly_options = STRING | STORED | FAST;

        // document unique id
        schema_builder.add_text_field("doc_id", exactly_options.clone());
        // normalized pattern, like `12:commodity:321` will be normalized as `*:commodity:*`
        schema_builder.add_text_field("normalization", exactly_options.clone());
        // id of datasource
        schema_builder.add_text_field("datasource.keyword", exactly_options.clone());
        // pattern value
        schema_builder.add_text_field("pattern", TEXT | STORED);
        // pattern keyword
        schema_builder.add_text_field("pattern.keyword", exactly_options.clone());
        // description
        schema_builder.add_text_field("desc", custom_options.clone());
        // 0:sys, 1:user
        schema_builder.add_text_field("scope", exactly_options.clone());
        // timestamp
        schema_builder.add_u64_field("ts", FAST | STORED);
        // pattern score
        schema_builder.add_f64_field("score", FAST | STORED);
        // typical samples
        schema_builder.add_text_field("typical_samples", STRING | STORED);
        self.open_or_create_index(IDX_NAME_KEY_PATTERN, schema_builder).await;
    }

    /// open or create index by provided index name and schema builder. Indexes will be hold on `TantivyIndexer`
    async fn open_or_create_index(&self, index_name: &str, schema_builder: SchemaBuilder) {
        let mut index_dir = self.database_dir().clone();
        index_dir.push(C_INDEX_DIRECTORY);
        index_dir.push(index_name);
        let index_opt = create_tantivy_index(index_dir, schema_builder);
        match index_opt {
            None => {}
            Some(index) => {
                let ngram = NgramTokenizer::new(2, 3, false).unwrap();
                index.tokenizers().register("ngram3", ngram);

                let redis_key_analyzer = TextAnalyzer::from(RedisKeyTokenizer);
                index.tokenizers().register("redis_key_tokenize", redis_key_analyzer);

                self.add_index(String::from(index_name), index).await
            }
        }
    }
}
