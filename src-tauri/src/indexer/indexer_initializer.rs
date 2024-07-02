use std::path::PathBuf;

use tantivy::directory::MmapDirectory;
use tantivy::Index;
use tantivy::schema::{FAST, IndexRecordOption, Schema, SchemaBuilder, STORED, STRING, TEXT, TextFieldIndexing, TextOptions};
use tantivy::tokenizer::NgramTokenizer;

use crate::indexer::tantivy_indexer::TantivyIndexer;

fn create_tantivy_index(index_directory: PathBuf, schema_builder: SchemaBuilder) -> Option<Index> {
    if !index_directory.exists() {
        match std::fs::create_dir_all(&index_directory) {
            Ok(_) => {}
            Err(e) => {}
        }
    }

    let dir = MmapDirectory::open(index_directory).unwrap_or_else(|e| {
        eprintln!("Error opening directory: {}", e);
        std::process::exit(1);
    });
    let schema = schema_builder.build();
    return match Index::open_or_create(dir, schema) {
        Ok(index) => Some(index),
        Err(err) => None,
    };
}

/// specify the directory of indexes.
const C_INDEX_DIRECTORY: &str = "tantivy_index";

impl TantivyIndexer {
    /// initializer the indexer schema
    pub async fn init_indexer(self) -> Self {
        let mut key_pattern_schema_builder = Schema::builder();
        let text_field_indexing = TextFieldIndexing::default()
            .set_tokenizer("ngram3")
            .set_index_option(IndexRecordOption::WithFreqsAndPositions);
        let text_options: TextOptions = TextOptions::default()
            .set_indexing_options(text_field_indexing)
            .set_stored();

        let custom_options: TextOptions = text_options;
        let exactly_options = STRING | STORED | FAST;
        key_pattern_schema_builder.add_text_field("pattern", TEXT | STORED);
        key_pattern_schema_builder.add_text_field("pattern.keyword", exactly_options.clone());

        key_pattern_schema_builder.add_text_field("desc", custom_options.clone());

        key_pattern_schema_builder.add_text_field("categoryA.keyword", exactly_options.clone());
        key_pattern_schema_builder.add_text_field("categoryB.keyword", exactly_options.clone());

        key_pattern_schema_builder.add_text_field("datasource.keyword", exactly_options.clone());
        key_pattern_schema_builder.add_u64_field("ts", FAST | STORED);

        key_pattern_schema_builder.add_text_field("payload", STRING | STORED);
        key_pattern_schema_builder.add_text_field("typical_sample", STRING | STORED);

        self.open_or_create_index("key_pattern", key_pattern_schema_builder).await;

        self
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
                self.add_index(String::from(index_name), index).await
            }
        }
    }
}
