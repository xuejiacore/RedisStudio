use xstorage_core::storage::Storage;

use crate::connection::RedisConnection;

#[derive(Debug)]
pub struct Redis;

impl Storage for Redis {
    type Connection = RedisConnection;
}