use url::Url;

use xstorage_core::error::Error;

use crate::options::RedisConnectOptions;

impl RedisConnectOptions {
    pub(crate) fn parse_from_url(url: &Url) -> Result<Self, Error> {
        let mut options = Self::new();
        if let Some(host) = url.host_str() {
            options = options.host(host);
        }

        if let Some(port) = url.port() {
            options = options.port(port);
        }

        if let username = url.username() {
            if !username.is_empty() {
                options = options.username(username);
            }
        }

        if let Some(password) = url.password() {
            options = options.password(password);
        }

        Ok(options)
    }
}
