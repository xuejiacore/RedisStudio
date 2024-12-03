use crate::dao::types::TblDatasource;
use crate::dao::DEFAULT_SQLITE_NAME;
use crate::storage::sqlite_storage::SqliteStorage;
use crate::{CmdError, CmdResult};
use sqlx::Error;
use std::ops::DerefMut;
use tauri::State;

type Db = sqlx::sqlite::Sqlite;

pub async fn query_flat_datasource(
    keyword: Option<String>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<Vec<TblDatasource>> {
    let mut mutex = sqlite.pool.lock().await;
    let map = mutex.deref_mut();
    let pool = map.get(DEFAULT_SQLITE_NAME).expect("Could not load system database.");

    let result: Result<Vec<TblDatasource>, Error>;
    match keyword {
        None => {
            result = sqlx::query_as("SELECT * FROM tbl_datasource").fetch_all(&*pool).await;
        }
        Some(kw) => {
            result = sqlx::query_as(r#"
                 SELECT *
                 FROM tbl_datasource
                 WHERE datasource_name LIKE CONCAT('%', ?, '%')
                    OR host LIKE CONCAT('%', ?, '%');
                 "#)
                .bind(&kw)
                .bind(&kw)
                .fetch_all(&*pool)
                .await;
        }
    }

    match result {
        Ok(r) => Ok(r),
        Err(e) => Err(CmdError::Datasource(e.to_string()))
    }
}

pub async fn query_datasource(
    datasource: i64,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<TblDatasource> {
    let mut mutex = sqlite.pool.lock().await;
    let map = mutex.deref_mut();
    let pool = map.get(DEFAULT_SQLITE_NAME).expect("Could not load system database.");
    let result: Result<TblDatasource, Error> = sqlx::query_as("SELECT * FROM tbl_datasource WHERE id = ?")
        .bind(datasource)
        .fetch_one(&*pool)
        .await;
    match result {
        Ok(r) => Ok(r),
        Err(e) => Err(CmdError::Datasource(e.to_string()))
    }
}

pub async fn add_datasource(
    datasource_name: String,
    host: String,
    port: u16,
    user_name: String,
    password: Option<String>,
    default_database: u16,
    color: Option<String>,
    path: Option<String>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<bool> {
    let mut mutex = sqlite.pool.lock().await;
    let map = mutex.deref_mut();
    let pool = map.get(DEFAULT_SQLITE_NAME).expect("Could not load system database.");
    let t = sqlx::query(r#"
    INSERT INTO tbl_datasource(datasource_name, host, port, user_name, password, default_database, color, path)
    VALUES ();
    "#)
        .bind(datasource_name)
        .bind(host)
        .bind(port)
        .bind(user_name)
        .bind(password)
        .bind(default_database)
        .bind(color)
        .bind(path)
        .execute(&*pool)
        .await;
    Ok(true)
}