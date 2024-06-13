use std::path::PathBuf;

use serde_json::json;
use tantivy::TantivyError;

use redisstudio::indexer::tantivy_indexer::TantivyIndexer;

#[tokio::test]
async fn test() -> Result<(), TantivyError> {
    let path = PathBuf::from("/tmp/test-tantivy-indexer");
    let indexer = TantivyIndexer::init(path).init_indexer().await;
    let write = false;
    if write {
        indexer.write_json("key_pattern", json!({
          "pattern": "{}:中文部分1:{}",
          "pattern_keyword": "{}:中文部分1:{}",
          "placeholder": "{}:Commodity:{}"
        })).await.unwrap();

        indexer.write_json("key_pattern", json!({
          "pattern": "{}:中文部分2:{}",
          "pattern_keyword": "{}:中文部分2:{}",
          "placeholder": "{}:Commodity:{}"
        })).await.unwrap();

        indexer.write_json("key_pattern", json!({
          "pattern": "{}:Frankenstein:{}",
          "placeholder": "{}:Frankenstein:{}"
        })).await.unwrap();


        indexer.write_json("key_pattern", json!({
          "pattern": "{}:中文部分3:{}",
          "pattern_keyword": "{}:中文部分3:{}",
          "placeholder": "{}:Commodity:{}"
        })).await.unwrap();

        indexer.write_json("key_pattern", json!({
          "pattern": "{}:中文部分4:{}",
          "pattern_keyword": "{}:中文部分4:{}",
          "placeholder": "{}:Commodity:{}"
        })).await.unwrap();
    }

    let docs = indexer.search("key_pattern", r#"pattern_keyword:"中文""#, 3, 0).await?;
    println!("{}", docs);

    println!("----------------");
    let docs = indexer.search("key_pattern", r#"pattern:"中文""#, 3, 0).await?;
    println!("{}", docs);

    // indexer.write_index("core_index", r#"{"title": "test key1", "body": "is a demo1 body"}"#).await;
    // indexer.write_index("core_index", r#"{"title": "test key2", "body": "is a demo2 body"}"#).await;
    // indexer.search("core_index", r#"body:demo"#).await;
    // indexer.search("core_index", r#"body:demo2"#).await

    Ok(())
}
