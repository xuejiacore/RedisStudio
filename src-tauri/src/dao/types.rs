use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, FromRow)]
pub struct TblRedisCustomTag {
    // id
    id: i64,
    // redis key pattern
    pattern: String,
    // pattern name
    name: Option<String>,
    // pattern description
    description: Option<String>,
    // pattern meta json data
    meta: Option<String>,
    // last time saved variable values
    last_vars: Option<String>,
    // id of datasource
    datasource_id: i64,
    // create time
    create_time: i64,
    // update time
    update_time: Option<i64>,
    // mode
    mode: Option<i64>,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct TblDatasource {
    pub id: i64,
    pub datasource_name: String,
    pub host: String,
    pub port: Option<u16>,
    pub user_name: Option<String>,
    pub password: Option<String>,
    pub default_database: Option<u16>,
    pub color: Option<String>,
    pub path: String,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct DataViewDto {
    pub dv_id: i64,
    pub name: String,
    pub dv_sort: i64,

    pub data_view_item_id: i64,
    pub path: String,
    pub key: String,
    pub key_type: String,
    pub item_sort: i64,
    pub last_var: Option<String>,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct DataViewHistoryDto {
    pub history_var: String,
    pub max_id: i64,
}