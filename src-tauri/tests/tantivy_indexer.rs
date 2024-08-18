use std::path::PathBuf;

use tantivy::{Order, TantivyError};

use redisstudio::indexer;
use redisstudio::indexer::tantivy_indexer::TantivyIndexer;

#[tokio::test]
async fn test() -> Result<(), TantivyError> {
    let path = PathBuf::from(
        "/Users/nigel/Library/Application Support/org.nigel.redisstudio/tantivy_index",
    );
    let indexer = TantivyIndexer::init(path).init_indexer().await;
    let write = true;
    if write {
        indexer::redis_indexer::index_or_update("testdatasource0", "130:commodity:32156", &indexer)
            .await
            .unwrap();
        indexer::redis_indexer::index_or_update("testdatasource0", "131:commodity:32157", &indexer)
            .await
            .unwrap();
        indexer::redis_indexer::index_or_update("testdatasource0", "133:commodity:32153", &indexer)
            .await
            .unwrap();
        // indexer::redis_indexer::index_or_update(
        //     "testdatasource4",
        //     r"[a-zA-Z0-9]+:commodity:\d+",
        //     &indexer,
        // )
        // .await
        // .unwrap();
    }

    // let docs = indexer.search_with_params(
    //     "key_pattern",
    //     |index, mut search_params| {
    //         search_params.with("ts", Order::Asc)
    //             .with_limit_offset(15, 0)
    //             .with_query_str(r#"pattern:"133""#);
    //     },
    // ).await?;
    // println!("{}", docs);
    // println!("----------------");
    //
    // let docs = indexer.search("key_pattern", r#"pattern.keyword:"130:commodity:32155""#, 3, 0).await?;
    // println!("{}", docs);
    //
    // println!("----------------");
    // let docs = indexer.search("key_pattern", r#"pattern:"commodity""#, 9, 0).await?;
    // println!("{}", docs);

    let result = indexer::redis_indexer::match_pattern("datasource", ":commodity:", &indexer)
        .await
        .unwrap();
    println!("{}", result);
    // indexer.write_index("core_index", r#"{"title": "test key1", "body": "is a demo1 body"}"#).await;
    // indexer.write_index("core_index", r#"{"title": "test key2", "body": "is a demo2 body"}"#).await;
    // indexer.search("core_index", r#"body:demo"#).await;
    // indexer.search("core_index", r#"body:demo2"#).await
    Ok(())
}
