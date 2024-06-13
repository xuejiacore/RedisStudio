use futures_core::future::BoxFuture;
use url::Url;

use xstorage_core::connection::ConnectOptions;
use xstorage_core::error::Error;

use crate::connection::RedisConnection;
use crate::options::RedisConnectOptions;

impl ConnectOptions for RedisConnectOptions {

    type Connection = RedisConnection;

    /// parse connection options from provided url
    fn from_url(url: &Url) -> Result<Self, Error> {
        Self::parse_from_url(url)
    }

    /// connect to redis
    fn connect(&self) -> BoxFuture<'_, Result<Self::Connection, Error>> where Self::Connection: Sized {
        unimplemented!();
    }
}