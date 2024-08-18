use redis::aio::MultiplexedConnection;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct RedisPool {
    pool: Arc<Mutex<HashMap<String, Arc<Mutex<MultiplexedConnection>>>>>,
}

impl RedisPool {
    pub fn new() -> Self {
        Self {
            pool: Arc::new(Mutex::new(HashMap::new()))
        }
    }

    pub async fn add_new_connection(&self, datasource_id: String, connection: MultiplexedConnection) {
        let mut mutex = self.pool.lock();
        mutex.await.insert(datasource_id, Arc::new(Mutex::new(connection)));
    }

    pub async fn fetch_connection(&self, datasource_id: &str) -> Arc<Mutex<MultiplexedConnection>> {
        let mutex = self.pool.lock();
        Arc::clone(mutex.await.get(datasource_id).unwrap())
    }
}