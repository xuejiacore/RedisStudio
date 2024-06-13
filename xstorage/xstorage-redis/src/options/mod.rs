use std::str::FromStr;

use url::Url;

use xstorage_core::error::Error;

mod connect;
mod parse;

/// Redis Connection Options.
///
/// ```text
/// parse url:
/// redis://host:port
/// redis://uname:pwd@host:port
/// ```
#[derive(Debug, Clone)]
pub struct RedisConnectOptions {
    pub(crate) host: String,
    pub(crate) port: u16,
    pub(crate) username: Option<String>,
    pub(crate) password: Option<String>,
}

impl Default for RedisConnectOptions {
    fn default() -> Self {
        Self::new()
    }
}

impl RedisConnectOptions {
    pub fn new() -> Self {
        Self {
            port: 6379,
            host: String::from("localhost"),
            username: None,
            password: None,
        }
    }

    pub fn host(mut self, host: &str) -> Self {
        self.host = host.to_owned();
        self
    }

    pub fn port(mut self, port: u16) -> Self {
        self.port = port;
        self
    }

    pub fn username(mut self, username: &str) -> Self {
        self.username = Some(username.to_owned());
        self
    }

    pub fn password(mut self, password: &str) -> Self {
        self.password = Some(password.to_owned());
        self
    }
}

impl FromStr for RedisConnectOptions {
    type Err = Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let url: Url = s.parse().map_err(Error::config)?;
        Self::parse_from_url(&url)
    }
}

#[test]
fn tests() -> Result<(), Error> {
    let opt0 = RedisConnectOptions::from_str("redis://127.0.0.1")?;
    println!("{:?}", opt0);

    let opt1 = RedisConnectOptions::from_str("redis://127.0.0.1:6378")?;
    println!("{:?}", opt1);

    let opt2 = RedisConnectOptions::from_str("redis://uname:password@127.0.0.1:6379")?;
    println!("{:?}", opt2);
    Ok(())
}