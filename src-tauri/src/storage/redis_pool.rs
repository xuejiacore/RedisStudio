use crate::dao::types::TblDatasource;
use deadpool_redis::{Runtime, Timeouts};
use futures::FutureExt;
use redis::aio::MultiplexedConnection;
use redis::{cmd, AsyncCommands, ConnectionAddr, ConnectionInfo, IntoConnectionInfo, RedisConnectionInfo, RedisResult};
use sqlx::{Error, Pool, Sqlite};
use std::collections::HashMap;
use std::ops::DerefMut;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, MutexGuard};
use tokio::time;

const DEFAULT_RESPONSE_TIMEOUT_SECS: u64 = 2;
const DEFAULT_CONNECT_TIMEOUT_SECS: u64 = 2;

#[derive(Clone)]
pub struct RedisProp {
    host: String,
    port: u16,
    password: Option<String>,
    default_database: Option<u16>,
}

impl RedisProp {
    pub fn simple<T: AsRef<str>>(host: T) -> Self {
        Self::new(host, 6379, None, None)
    }

    pub fn new<T: AsRef<str>>(
        host: T,
        port: u16,
        password: Option<String>,
        database: Option<u16>,
    ) -> Self {
        RedisProp {
            host: host.as_ref().to_string(),
            port,
            password,
            default_database: database,
        }
    }

    pub fn select_db(&self, database: u16) -> Self {
        let mut cloned = self.clone();
        cloned.default_database = Some(database);
        cloned
    }
}

impl IntoConnectionInfo for RedisProp {
    fn into_connection_info(self) -> RedisResult<ConnectionInfo> {
        let addr = ConnectionAddr::Tcp(self.host, self.port);
        let redis = RedisConnectionInfo {
            db: self.default_database.unwrap_or(0) as i64,
            username: None,
            password: self.password,
            protocol: Default::default(),
        };
        Ok(ConnectionInfo { addr, redis })
    }
}

pub struct DataSourceManager {
    pool: Option<Pool<Sqlite>>,
    configs: Arc<Mutex<HashMap<String, RedisProp>>>,
}

impl DataSourceManager {
    pub fn new() -> Self {
        DataSourceManager {
            pool: None,
            configs: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn with_protocol(protocol: &str) -> Self {
        let pool = Pool::connect(protocol).await.unwrap();
        DataSourceManager {
            pool: Some(pool),
            configs: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn add_prop<T: AsRef<str>>(&self, id: T, prop: RedisProp) {
        let mut m = {
            let mutex = self.configs.lock();
            mutex.await
        };
        let id_str = id.as_ref();
        match m.get(id_str) {
            None => {
                m.insert(id_str.to_string(), prop);
            }
            Some(_) => {}
        }
    }

    pub async fn query_prop(&self, ds_id: i64) -> Option<RedisProp> {
        match &self.pool {
            None => None,
            Some(p) => {
                let rows: Result<Vec<TblDatasource>, Error> =
                    sqlx::query_as("select * from tbl_datasource where id = $1")
                        .bind(ds_id)
                        .fetch_all(&*p)
                        .await;
                match rows {
                    Ok(row) => row.first().map(|t| {
                        let host = t.host.clone();
                        let port = t.port.clone();
                        let password = t.password.clone();
                        let default_database = t.default_database;
                        let redis_prop =
                            RedisProp::new(host, port.unwrap_or(6379), password, default_database);
                        redis_prop
                    }),
                    Err(_) => None,
                }
            }
        }
    }
}

pub struct RedisPool {
    data_source_manager: Arc<Mutex<DataSourceManager>>,
    active_connection: Arc<Mutex<Option<String>>>,
    pool: Arc<Mutex<HashMap<String, deadpool_redis::Pool>>>,
}

impl RedisPool {
    pub fn new<T: FnMut(i64, i64) + Send + 'static>(
        data_source_manager: DataSourceManager,
        ping_callback: Arc<Mutex<T>>,
    ) -> Self {
        let pool_map = Arc::new(Mutex::new(HashMap::new()));
        let cloned_pool_map = pool_map.clone();
        let redis_pool_instance = Self {
            data_source_manager: Arc::new(Mutex::new(data_source_manager)),
            pool: pool_map,
            active_connection: Arc::new(Mutex::new(None)),
        };

        // start heartbeat to monitor connection is alive.
        let heartbeat_interval = Duration::from_secs(5);
        tokio::spawn(async move {
            let mut interval = time::interval(heartbeat_interval);
            loop {
                interval.tick().await;

                let mut remove_enabled_key = vec![];
                // collect connections which could be removed.
                Self::iter_ping_connections(&ping_callback, &mut remove_enabled_key, cloned_pool_map.clone()).await;

                // evict all lost connections from current pool.
                Self::evict_dead_connections(cloned_pool_map.clone(), remove_enabled_key);
            }
        });
        redis_pool_instance
    }

    pub async fn get_all_connection_infos(&self) -> Vec<String> {
        let mutex = self.pool.lock().await;
        let keys = mutex.keys();
        let key_string = keys.map(|k| k.to_string()).collect::<Vec<String>>();
        key_string
    }

    pub async fn get_all_keys(&self) -> Vec<String> {
        self.pool.lock().await.keys().map(|k| k.to_string()).collect()
    }

    /** release connection */
    pub async fn release_connection(
        &self,
        datasource_id: i64,
        database: Option<i64>,
    ) -> bool {
        let exists = {
            let ds_prop = self.data_source_manager.lock().await;
            ds_prop.query_prop(datasource_id).await
        };

        if let Some(_) = exists {
            if let Some(spec_database) = database {
                let with_db_key = format!("{datasource_id}#{spec_database}");
                let mut mutex = self.pool.lock().await;
                let mut removed_connection = mutex.remove(&with_db_key);
                if let Some(connection) = removed_connection {
                    drop(connection);
                    true
                } else {
                    false
                }
            } else {
                // release all database with id `datasource_id`
                let mut mutex = self.pool.lock().await;
                let keys = mutex.keys();
                let mut rm_keys = vec![];
                for key in keys {
                    let cloned_key = key.clone();
                    let ds_prefix = format!("{datasource_id}#").to_string();
                    if cloned_key.starts_with(ds_prefix.as_str()) {
                        rm_keys.push(key.clone());
                    }
                }

                for key in rm_keys {
                    mutex.remove(&key);
                }
                true
            }
        } else {
            panic!("Datasource not exists.");
        }
    }

    pub async fn try_connect(
        &self,
        datasource_id: i64,
        selected_db: Option<i64>,
    ) -> bool {
        let mut cached_connection = self.pool.lock().await;
        let ds_prop = self.data_source_manager.lock().await;

        let ds = ds_prop.query_prop(datasource_id).await;
        let redis_prop = match ds {
            None => panic!("Fail to find datasource {datasource_id}"),
            Some(ds_prop) => match selected_db {
                None => ds_prop.clone(),
                Some(db) => ds_prop.select_db(db as u16),
            },
        };

        let database = redis_prop.default_database.unwrap_or(0);
        let with_db_key = format!("{datasource_id}#{database}");
        match cached_connection.get(&with_db_key) {
            None => {
                let connection_info = redis_prop.into_connection_info().unwrap();
                let deadpool_redis_connection_info = deadpool_redis::ConnectionInfo::from(connection_info);
                let cfg = deadpool_redis::Config::from_connection_info(deadpool_redis_connection_info);
                let pool = cfg.create_pool(Some(Runtime::Tokio1)).unwrap();

                match pool.timeout_get(&Timeouts::wait_millis(3000)).await {
                    Ok(con) => {
                        cached_connection.insert(with_db_key, pool);
                        true
                    }
                    Err(_) => false
                }
            }
            Some(_) => true,
        }
    }

    pub async fn select_connection(
        &self,
        datasource_id: i64,
        selected_db: Option<i64>,
    ) -> MultiplexedConnection {
        let ds_id = datasource_id.to_string();
        let redis_prop = {
            let ds_prop = self.data_source_manager.lock().await;
            let ds = ds_prop.query_prop(datasource_id).await;
            match ds {
                None => panic!("Fail to find datasource {ds_id}"),
                Some(ds_prop) => match selected_db {
                    None => ds_prop.clone(),
                    Some(db) => ds_prop.select_db(db as u16),
                },
            }
        };

        let database = redis_prop.default_database.unwrap_or(0);
        let with_db_key = format!("{ds_id}#{database}");
        let (opt, size) = {
            let mut cached_connection = self.pool.lock().await;
            let size = cached_connection.len();
            (cached_connection.get(&with_db_key).cloned(), size)
        };
        match opt {
            None => {
                let connection_info = redis_prop.into_connection_info().unwrap();
                let deadpool_redis_connection_info = deadpool_redis::ConnectionInfo::from(connection_info);
                let cfg = deadpool_redis::Config::from_connection_info(deadpool_redis_connection_info);
                let pool = cfg.create_pool(Some(Runtime::Tokio1)).unwrap();
                match pool.timeout_get(&Timeouts::wait_millis(3000)).await {
                    Ok(con) => {
                        if size == 0 {
                            self.active_connection.lock().await.replace(with_db_key.clone());
                        }

                        let mut cached_connection = self.pool.lock().await;
                        cached_connection.insert(with_db_key.clone(), pool);
                        let mut multiplexed_connection = con.to_owned();
                        multiplexed_connection
                    }
                    Err(_) => panic!("Fail to connect database.")
                }
            }
            Some(pool) => {
                let mut multiplexed_connection = pool.get().await.unwrap().to_owned();
                multiplexed_connection
            }
        }
    }

    pub async fn get_active_info(&self) -> (i64, i64) {
        let cloned = {
            let mutex = self.active_connection.lock().await;
            let cloned = mutex.clone();
            cloned
        };
        cloned
            .map(|t| {
                let cloned = t.clone();
                let info = cloned.split("#").collect::<Vec<&str>>();

                let datasource = info[0].to_string().parse::<i64>().unwrap();
                let database = info[1].parse::<i64>().unwrap_or(0);
                (datasource, database)
            })
            .expect("No active connection.")
    }

    pub async fn change_active_connection(
        &self,
        datasource: Option<i64>,
        database: Option<i64>,
    ) {
        let old = self.get_active_info().await;
        let new_datasource = datasource.unwrap_or(old.0);
        let new_database = database.unwrap_or(old.1);
        let with_db_key = format!("{new_datasource}#{new_database}");
        self.try_connect(new_datasource, Some(new_database)).await;
        let mut act = self.active_connection.lock().await;
        *act = Some(with_db_key.clone());
    }

    pub async fn get_active_connection(&self) -> Arc<Mutex<MultiplexedConnection>> {
        let act = self.active_connection.lock().await;
        let cloned_active = act.clone();
        let s = cloned_active.unwrap();
        let datasource_id = s.as_str();
        let mutex = self.pool.lock().await;
        let t = mutex.get(datasource_id).unwrap();
        let c = t.get().await.unwrap().to_owned();
        Arc::new(Mutex::new(c))
    }

    /// check all connection's status, collect connections which is unavailable.
    async fn iter_ping_connections<T: FnMut(i64, i64) + Send + 'static>(
        ping_callback: &Arc<Mutex<T>>,
        mut remove_enabled_key: &mut Vec<String>,
        m: Arc<Mutex<HashMap<String, deadpool_redis::Pool>>>,
    ) {
        let keys = {
            let map = m.try_lock();
            match map {
                Ok(m) => {
                    Some(m.keys().cloned().collect::<Vec<String>>())
                },
                Err(_) => None,
            }
        };

        match keys {
            None => {}
            Some(key_list) => {
                for key in key_list {
                    let cloned_key = key.clone();
                    let cloned_for_split = key.clone();
                    let info = cloned_for_split.split("#").collect::<Vec<&str>>();
                    let datasource_id = info[0].to_string().parse::<i64>().unwrap_or(0);
                    let database = info[1];

                    let pool_opt = {
                        match m.try_lock() {
                            Ok(map) => {
                                map.get(&key).cloned()
                            }
                            Err(_) => None
                        }
                    };

                    match pool_opt {
                        None => {}
                        Some(pool) => {
                            let mut connection = pool.get().await.unwrap().to_owned();
                            connection.set_response_timeout(Duration::from_secs(3));
                            Self::ping(
                                &ping_callback,
                                &mut remove_enabled_key,
                                cloned_key,
                                datasource_id,
                                database,
                                connection,
                            ).await;
                        }
                    }
                }
            }
        }
    }

    fn evict_dead_connections(
        cloned_pool_map: Arc<Mutex<HashMap<String, deadpool_redis::Pool>>>,
        mut remove_enabled_key: Vec<String>,
    ) {
        if !remove_enabled_key.is_empty() {
            match cloned_pool_map.try_lock() {
                Ok(mut m) => {
                    remove_enabled_key.iter().for_each(|k| {
                        m.remove(k);
                    });
                }
                Err(_) => {}
            }
        }
    }

    async fn ping<T: FnMut(i64, i64) + Send + 'static>(
        ping_callback: &Arc<Mutex<T>>,
        mut remove_enabled_key: &mut Vec<String>,
        cloned_key: String,
        datasource_id: i64,
        database: &str,
        mut connection: MultiplexedConnection,
    ) {
        match cmd("PING").query_async::<String>(&mut connection).await {
            Ok(_) => {}
            Err(_) => {
                let mut cbk = ping_callback.lock().await;
                let callback = cbk.deref_mut();
                callback(datasource_id, database.parse::<i64>().unwrap_or(0));
                remove_enabled_key.push(cloned_key);
            }
        }
    }
}
