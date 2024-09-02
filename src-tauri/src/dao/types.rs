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