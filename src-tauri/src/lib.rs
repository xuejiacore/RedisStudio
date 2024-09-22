#![feature(mapped_lock_guards)]

use serde::{Serialize, Serializer};

use crate::net::net_launcher;

pub mod command;
mod graph;
pub mod indexer;
pub mod log;
mod net;
pub mod storage;
pub mod view;

pub mod constant;
pub mod dao;
pub mod menu;
pub mod spotlight_command;
pub mod win;

#[derive(Debug, thiserror::Error)]
pub enum CmdError {
    #[error("unsupported datatype: {0}")]
    Unknown(String),
}

impl Serialize for CmdError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub fn setup() {
    println!("launching");
    let launcher = Launcher::new();
    launcher.setup();
}

/// Create byte studio system launcher
///
/// # Examples
///
/// ```
/// use redisstudio::Launcher;
/// let launcher = Launcher::new();
/// ```
#[derive(Copy, Clone)]
pub struct Launcher {}

impl Launcher {
    pub fn new() -> Self {
        println!("construct launcher.");
        Launcher {}
    }

    /// core setup function
    pub fn setup(&self) {
        // setup network manager
        net_launcher::setup();

        // setup graph computing engine
    }
}
