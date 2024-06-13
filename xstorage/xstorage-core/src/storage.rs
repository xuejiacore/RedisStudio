use std::fmt::Debug;

use crate::connection::Connection;

pub trait Storage: 'static + Sized + Send + Debug {
    type Connection: Connection<Storage=Self>;
}