use crate::indexer::redis_indexer::RedisIndexer;
use crate::storage::sqlite_storage::SqliteStorage;
use crate::CmdError;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::State;

type Result<T> = std::result::Result<T, CmdError>;

#[tauri::command]
pub async fn pattern_add_tag(datasource_id: &str,
                             key: &str,
                             pin_field: &str,
                             op: &str,
                             sqlite: State<'_, SqliteStorage>,
                             redis_indexer: State<'_, RedisIndexer>,
) -> Result<Value> {
    let result = redis_indexer.fast_infer(datasource_id, &vec![key]).await;
    let is_add = op.eq("add");
    match result {
        None => {
            Err(CmdError::Unknown(String::from("")))
        }
        Some(infer_result) => {
            let normalized = infer_result.normalized();
            let mut databases = sqlite.pool.lock().await;
            let db = databases.get_mut("default").unwrap();

            let rows = sqlx::query("select pin_meta from tbl_redis_custom_tag where pattern = $1 and datasource_id = $2")
                .bind(&normalized)
                .bind(&datasource_id)
                .fetch_all(&*db)
                .await
                .unwrap();
            if rows.len() > 0 {
                let pin_meta_str: &str = rows[0].try_get("pin_meta").unwrap();
                let mut metas = pin_meta_str.split(";").collect::<Vec<&str>>();
                if is_add {
                    if !metas.contains(&pin_field) {
                        metas.push(&pin_field);
                    }
                } else {
                    if metas.contains(&pin_field) {
                        if let Some(pos) = metas.iter().position(|&x| x.eq(pin_field)) {
                            metas.remove(pos);
                        };
                    }
                }
                let pin_meta_value = metas.join(";");
                sqlx::query("update tbl_redis_custom_tag set pin_meta = $1 where pattern = $2 and datasource_id = $3")
                    .bind(&pin_meta_value)
                    .bind(&normalized)
                    .bind(&datasource_id)
                    .execute(&*db)
                    .await
                    .unwrap();
                Ok(json!({
                    "status": "success",
                    "fields": &metas
                }))
            } else {
                sqlx::query("insert into tbl_redis_custom_tag (pattern, pin_meta, datasource_id) values ($1, $2, $3)")
                    .bind(&normalized)
                    .bind(pin_field.to_string())
                    .bind(datasource_id)
                    .execute(&*db)
                    .await
                    .unwrap();
                Ok(json!({
                    "status": "success",
                    "fields": vec![pin_field.to_string()]
                }))
            }
        }
    }
}