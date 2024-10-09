use chrono::format::strftime;
use chrono::{DateTime, Local, NaiveDateTime};
use env_logger::{Builder, Env};
use log::debug;
use std::fmt::{Debug, Formatter};
use std::io::Write;

pub fn init_logger() {
    debug!("logger initialized.")
}
