use sqlx::Pool;
use std::collections::HashMap;
use tokio::sync::Mutex;

type Db = sqlx::sqlite::Sqlite;

#[derive(Default)]
pub struct SqliteStorage {
    pub sqlite_path: String,
    pub pool: Mutex<HashMap<String, Pool<Db>>>,
}

impl SqliteStorage {
    pub fn echo(&self) -> String {
        "echo".to_string()
    }

    // pub async fn sys_prop(&self, property: &str) -> String {
    //     println!("查询property:{}", property);
    //     let _: Result<(), Error> = tauri::async_runtime::block_on(async move {
    //         let mut lock = self.pool.lock().unwrap();
    //         *lock.unwrap();
    //         Ok(())
    //     });
    //
    //     "333".to_string()
    // }
}
