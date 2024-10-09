use redisstudio::indexer::key_tokenize::RedisKeyTokenizer;
use redisstudio::indexer::redis_indexer::RedisIndexer;
use redisstudio::indexer::simple_infer_pattern::{PatternInferenceEngine, PatternInferenceEngines};
use redisstudio::indexer::tantivy_indexer::TantivyIndexer;
use regex::Regex;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tantivy::tokenizer::Tokenizer;

#[test]
fn do_simple_test() {
    let mut inference = PatternInferenceEngine::new();
    inference.load_known_pattern(vec![
        (r"^[a-zA-Z0-9]+:commodity:\d+$".to_string(), 0.5),
        (r"^\d+:commodity:\d+$".to_string(), 0.2),
    ]);

    let mut tests = vec!["129:commodity:512".to_string()];

    let mut generated_pattern = inference.infer_from_items(&tests);
    if let Some(pattern) = generated_pattern {
        println!("Generated Pattern: {}, score {}, by tests: {:?}", pattern.recognized_pattern, pattern.score, &tests);
    } else {
        println!("Not found any pattern by tests: {:?}", &tests);
    }

    tests.push("12x9:commodity:130".to_string());
    generated_pattern = inference.infer_from_items(&tests);
    if let Some(pattern) = generated_pattern {
        println!("Generated Pattern: {}, score {}, by tests: {:?}", pattern.recognized_pattern, pattern.score, &tests);
    } else {
        println!("Not found any pattern by tests: {:?}", &tests);
    }
}

#[test]
fn test_direct_recognize() {
    let mut inference = PatternInferenceEngine::new();

    let mut test = vec!["129:commodity:331".to_string()];
    if let Some(pattern) = inference.infer_from_items(&test) {
        println!("Generated pattern: {}, score = {}", pattern.recognized_pattern, pattern.score);
    } else {
        println!("Not found any pattern by tests: {:?}", &test);
    }

    test.push("1341:commodity:3412".to_string());
    if let Some(pattern) = inference.infer_from_items(&test) {
        println!("Generated pattern1: {}, score = {}", &pattern.recognized_pattern, &pattern.score);
        inference.add_known_pattern((Regex::new(pattern.recognized_pattern.as_str()).unwrap(), pattern.score))
    } else {
        println!("Not found any pattern by tests: {:?}", &test);
    }

    test = vec!["65x1:commodity:2412".to_string()];
    if let Some(pattern) = inference.infer_from_items(&test) {
        println!("Generated pattern2: {}, score = {}", &pattern.recognized_pattern, &pattern.score);
    } else {
        println!("Not found any pattern by tests: {:?}", &test);
    }
}

#[tokio::test]
async fn test_initialize_datasource_pattern() {
    let datasource_id = "testdatasource0";
    initialize_datasource(datasource_id).await;
}

#[tokio::test]
async fn test_infer_with_exists_pattern() {
    let datasource_id = "testdatasource0";
    let indexer = initialize_redis_indexer().await;
    let infer_result = indexer.fast_infer(datasource_id, &vec!["12x1:commodity:412"]).await;
    match infer_result {
        None => {
            println!("Could not infer from");
        }
        Some(result) => {
            println!("infer result: {:?}", result);
        }
    }
}

#[test]
fn test_tokenize() {
    let mut tokenizer = RedisKeyTokenizer;
    // 使用自定义分词器生成令牌流
    let mut token_stream = tokenizer.token_stream("3221:foo:23");

    // 遍历令牌并打印
    while token_stream.advance() {
        let token = token_stream.token();
        println!("Token: {:?}", token.text);
    }
}

#[tokio::test]
async fn test_infer_new_pattern() {
    let datasource_id = "datasource01";
    let indexer = initialize_redis_indexer().await;

    simple_test(&indexer, datasource_id, "user:10001904:attr").await;
    simple_test(&indexer, datasource_id, "user:10001905:attr").await;
    simple_test(&indexer, datasource_id, "user:10001904:params").await;
    simple_test(&indexer, datasource_id, "user:10001905:params").await;
    simple_test(&indexer, datasource_id, "user:10001904:privilege").await;
    simple_test(&indexer, datasource_id, "user:10001905:privilege").await;
    simple_test(&indexer, datasource_id, "user:10001904:adv").await;
    simple_test(&indexer, datasource_id, "user:10001907:adv").await;
    simple_test(&indexer, datasource_id, "user:10001903:daily:20240826").await;
    simple_test(&indexer, datasource_id, "user:10001907:daily:20240827").await;
    simple_test(&indexer, datasource_id, "match:info:10002248:1724062323935_6npl22hb6l8g0").await;
    simple_test(&indexer, datasource_id, "match:info:10002160:1723010547265_6npkvykwb162o").await;
    // simple_test(&indexer, datasource_id, "3221:commodity:24").await;
    // simple_test(&indexer, datasource_id, "3311:foo:1234").await;
    // simple_test(&indexer, datasource_id, "Ax23:commodity:24").await;
    // simple_test(&indexer, datasource_id, "42:foo:12").await;
}

#[tokio::test]
async fn test_record_key_access_history() {
    let datasource_id = "datasource01";
    let indexer = initialize_redis_indexer().await;
    indexer.record_key_access_history(datasource_id, "user:10001904:attr", "hash").await;
}

#[tokio::test]
async fn test_record_favor_key() {
    let datasource_id = "datasource01";
    let indexer = initialize_redis_indexer().await;

    let op_add_favor = 1;
    let op_rm_favor = -1;
    // add new favor key
    indexer.operate_favor(datasource_id, "user:10001904:attr", "hash", op_add_favor).await;

    // remove favor key
    indexer.operate_favor(datasource_id, "user:10001904:attr", "hash", op_rm_favor).await;
}

async fn simple_test(redis_indexer: &RedisIndexer, datasource: &str, key: &str) {
    let result = &redis_indexer.infer(datasource, key).await;
    match result {
        None => println!("Unrecognized key: {}", key),
        Some(r) => {
            let normalization = r.normalized();
            println!("{} => {:?}, normalization: {}", key, r, normalization);
        }
    }
}

async fn initialize_datasource(datasource_id: &str) -> RedisIndexer {
    let redis_indexer = initialize_redis_indexer().await;
    redis_indexer.initialize_datasource_pattern(datasource_id).await;
    redis_indexer
}

async fn initialize_redis_indexer() -> RedisIndexer {
    // prepare tantivy indexer
    let tantivy_indexer = prepare_tantivy_indexer().await;
    // prepare inference engine
    let inference_engine = prepare_inference_engine().await;

    let arc_indexer = Arc::new(Mutex::new(tantivy_indexer));
    let arc_inference_engine = Arc::new(Mutex::new(inference_engine));
    // create core redis indexer
    let redis_indexer = RedisIndexer::new(arc_indexer, arc_inference_engine);
    redis_indexer.initialize_datasource_pattern("datasource01").await;
    redis_indexer
}

async fn prepare_inference_engine() -> PatternInferenceEngines {
    PatternInferenceEngines::new()
}

async fn prepare_tantivy_indexer() -> TantivyIndexer {
    let path = "/Users/nigel/Library/Application Support/org.nigel.redisstudio";
    let path = PathBuf::from(path);
    TantivyIndexer::init(path).init_indexer().await
}

fn assert_send_sync<T: Send + Sync>() {}

#[test]
fn te() {
    assert_send_sync::<RedisIndexer>();
}