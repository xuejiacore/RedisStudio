use std::fmt::Debug;
use std::str::FromStr;

use futures_core::future::BoxFuture;
use url::Url;

use crate::error::Error;
use crate::storage::Storage;

/// Represents a single storage connection.
pub trait Connection: Send {

    type Storage: Storage<Connection=Self>;

    type Options: ConnectOptions<Connection=Self>;
}

pub trait ConnectOptions: 'static + Send + Sync + FromStr<Err=Error> + Debug + Clone {
    type Connection: Connection<Options=Self> + ?Sized;

    /// Parse the `ConnectOptions` from a URL.
    fn from_url(url: &Url) -> Result<Self, Error>;

    /// Establish a new database connection with the options specified by `self`.
    fn connect(&self) -> BoxFuture<'_, Result<Self::Connection, Error>>
        where Self::Connection: Sized;
}