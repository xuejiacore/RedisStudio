use crate::dao::types::TblRedisCustomTag;
use sqlx::{Pool, Row};

type Db = sqlx::sqlite::Sqlite;
type Result<T> = std::result::Result<T, tauri_plugin_sql::Error>;

pub async fn query_by_pattern(pool: &mut Pool<Db>, pattern: String, datasource: String) -> Result<()> {
    let rows: Vec<TblRedisCustomTag> = sqlx::query_as("select * from tbl_redis_custom_tag where pattern = $1 and datasource_id = $2")
        .bind(pattern)
        .bind(datasource)
        .fetch_all(&*pool)
        .await?;
    for row in rows {
        println!("result = {:?}", row);
    }
    Ok(())
}