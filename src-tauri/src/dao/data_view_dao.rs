use crate::dao::types::{DataViewDto, DataViewHistoryDto};
use crate::dao::DEFAULT_SQLITE_NAME;
use crate::storage::sqlite_storage::SqliteStorage;
use crate::{CmdError, CmdResult};
use sqlx::Error;
use std::ops::DerefMut;
use tauri::State;

type Db = sqlx::sqlite::Sqlite;

const QUERY_DATA_VIEW_SQL: &str = r#"
select V.id                         as dv_id,
       V.name                       as name,
       V.sort                       as dv_sort,
       VI.id                        as data_view_item_id,
       concat(?, V.name, ?, VI.key) as path,
       VI.key_type                  as key,
       VI.key_type                  as key_type,
       VI.sort                      as item_sort,
       H.value                      as last_var
from tbl_data_view V
         left join tbl_data_view_items VI
                   on V.id = VI.data_view_id
         left join
     (select VAR.data_view_item_id, VAR.value
      from tbl_data_view_vars VAR
               inner join (select A1.id as item_id, max(B1.id) as max_id
                           from tbl_data_view A1
                                    left join tbl_data_view_vars B1
                                              on A1.id = B1.data_view_item_id) V_MAX
                          on VAR.data_view_item_id = V_MAX.item_id
                              and VAR.id = V_MAX.max_id) H
     on V.id = H.data_view_item_id
where V.datasource = ?
  and V.database = ?
order by V.sort, VI.sort;
"#;

const QUERY_DATA_VIEW_VAR_HISTORY_SQL: &str = r#"
select history_var, max(id) max_id
from (select json_extract(value, concat('$.', ?)) as history_var, id
      from tbl_data_view_vars
      where data_view_item_id = ?)
group by history_var
order by max_id desc
limit ?
"#;

const INSERT_NEW_DATA_VIEW_ITEM: &str = r#"
insert into tbl_data_view_items (data_view_id, key, key_type)
values ($1, $2, $3)
"#;

const DELETE_DATA_VIEW_ITEM: &str = r#"delete from tbl_data_view_items where id = $1"#;

/// query data view
pub async fn query_data_view(
    datasource: i64,
    database: i64,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<Vec<DataViewDto>> {
    let mut mutex = sqlite.pool.lock().await;
    let map = mutex.deref_mut();
    let pool = map
        .get(DEFAULT_SQLITE_NAME)
        .expect("Could not load system database.");
    let result: Result<Vec<DataViewDto>, Error> = sqlx::query_as(QUERY_DATA_VIEW_SQL)
        .bind(":")
        .bind(":")
        .bind(datasource)
        .bind(database)
        .fetch_all(&*pool)
        .await;
    match result {
        Ok(r) => Ok(r),
        Err(e) => Err(CmdError::Datasource(e.to_string())),
    }
}

pub async fn query_data_view_var_history<T: AsRef<str>>(
    data_view_id: i64,
    var_name: T,
    limit: u32,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<Vec<String>> {
    let mut mutex = sqlite.pool.lock().await;
    let map = mutex.deref_mut();
    let pool = map
        .get(DEFAULT_SQLITE_NAME)
        .expect("Could not load system database");
    let result: Result<Vec<DataViewHistoryDto>, Error> =
        sqlx::query_as(QUERY_DATA_VIEW_VAR_HISTORY_SQL)
            .bind(var_name.as_ref())
            .bind(data_view_id)
            .bind(limit)
            .fetch_all(&*pool)
            .await;
    match result {
        Ok(mut r) => {
            let ret = r
                .into_iter()
                .map(|h| h.history_var)
                .collect::<Vec<String>>();
            Ok(ret)
        }
        Err(e) => Err(CmdError::Datasource(e.to_string())),
    }
}

pub async fn add_data_view_item(
    data_view_id: i64,
    key: String,
    key_type: Option<String>,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<()> {
    let mut mutex = sqlite.pool.lock().await;
    let map = mutex.deref_mut();
    let pool = map
        .get(DEFAULT_SQLITE_NAME)
        .expect("Could not load system database");
    sqlx::query(INSERT_NEW_DATA_VIEW_ITEM)
        .bind(data_view_id)
        .bind(key)
        .bind(key_type)
        .execute(&*pool)
        .await
        .expect("sss");
    Ok(())
}

pub async fn delete_data_view_item(
    data_view_item_id: i64,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<()> {
    let mut mutex = sqlite.pool.lock().await;
    let map = mutex.deref_mut();
    let pool = map
        .get(DEFAULT_SQLITE_NAME)
        .expect("Could not load system database");
    sqlx::query(DELETE_DATA_VIEW_ITEM)
        .bind(data_view_item_id)
        .execute(&*pool)
        .await
        .expect("sss");
    Ok(())
}
