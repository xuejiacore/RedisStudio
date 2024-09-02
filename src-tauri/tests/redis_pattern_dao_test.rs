use redisstudio::dao::redis_pattern_dao;
use sqlx::Pool;

type Db = sqlx::Sqlite;

#[tokio::test]
async fn test() {
    let mut db = prepare().await;
    let t = redis_pattern_dao::query_by_pattern(&mut db, "user:*:attr".to_string(), "1".to_string()).await;
}

async fn prepare() -> Pool<Db> {
    let database_path = "/Users/nigel/Library/Application Support/org.nigel.redisstudio/redisstudio.db";
    let protocol = format!("sqlite:{}", database_path);
    Pool::connect(&protocol.as_str()).await.unwrap()
}