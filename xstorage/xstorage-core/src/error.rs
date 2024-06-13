use std::error::Error as StdError;

/// A specialized `Result` type for xstorage.
pub type Result<T, E = Error> = ::std::result::Result<T, E>;

pub type BoxDynError = Box<dyn StdError + 'static + Send + Sync>;

#[derive(thiserror::Error, Debug)]
#[error("unexpected null; try decoding as an `Option`")]
pub struct UnexpectedNullError;

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum Error {
    #[error("error with configuration: {0}")]
    Configuration(#[source] BoxDynError)
}

impl Error {
    #[doc(hidden)]
    #[inline]
    pub fn config(err: impl StdError + Send + Sync + 'static) -> Self {
        Error::Configuration(err.into())
    }
}