use std::fmt::{Debug, Formatter};

use xstorage_core::connection::Connection;

use crate::options::RedisConnectOptions;
use crate::storage::Redis;

pub struct RedisConnection {}

impl Debug for RedisConnection {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RedisConnection").finish()
    }
}

impl Connection for RedisConnection {
    type Storage = Redis;
    type Options = RedisConnectOptions;
}