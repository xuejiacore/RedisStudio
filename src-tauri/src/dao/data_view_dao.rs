use crate::dao::types::DataViewDto;
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
       T.id                         as data_view_item_id,
       concat(?, V.name, ?, T.key)  as path,
       T.key                        as key,
       T.key_type                   as key_type,
       T.sort                       as item_sort,
       H.value                      as last_var
from tbl_data_view V
         left join tbl_data_view_items T
                    on V.id = T.data_view_id
         left join (select VAR.data_view_item_id, VAR.value
                    from tbl_data_view_vars VAR
                             inner join (select A1.id as item_id, max(B1.id) as max_id
                                         from tbl_data_view_items A1
                                                  left join tbl_data_view_vars B1
                                                            on A1.id = B1.data_view_item_id) V_MAX
                                        on VAR.data_view_item_id = V_MAX.item_id
                                            and VAR.id = V_MAX.max_id) H
                   on T.id = H.data_view_item_id
where V.datasource = ?
  and V.database = ?
order by V.sort, T.sort
"#;

/// query data view
pub async fn query_data_view(
    datasource: i64,
    database: i64,
    sqlite: State<'_, SqliteStorage>,
) -> CmdResult<Vec<DataViewDto>> {
    let mut mutex = sqlite.pool.lock().await;
    let map = mutex.deref_mut();
    let pool = map.get(DEFAULT_SQLITE_NAME).expect("Could not load system database.");
    let result: Result<Vec<DataViewDto>, Error> = sqlx::query_as(QUERY_DATA_VIEW_SQL)
        .bind(":")
        .bind(":")
        .bind(datasource)
        .bind(database)
        .fetch_all(&*pool)
        .await;
    match result {
        Ok(r) => Ok(r),
        Err(e) => Err(CmdError::Datasource(e.to_string()))
    }
}