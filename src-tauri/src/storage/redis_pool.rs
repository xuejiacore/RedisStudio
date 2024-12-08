use crate::dao::types::TblDatasource;
use futures::FutureExt;
use redis::aio::MultiplexedConnection;
use redis::{
    cmd, AsyncConnectionConfig, ConnectionAddr, ConnectionInfo, IntoConnectionInfo,
    RedisConnectionInfo, RedisResult,
};
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
    pool: Arc<Mutex<HashMap<String, Arc<Mutex<MultiplexedConnection>>>>>,
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
                if let Ok(m) = cloned_pool_map.try_lock() {
                    // collect connections which could be removed.
                    Self::iter_ping_connections(&ping_callback, &mut remove_enabled_key, m).await;

                    // evict all lost connections from current pool.
                    Self::evict_dead_connections(&cloned_pool_map, remove_enabled_key);
                }
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

    pub async fn get_pool(
        &self,
    ) -> MutexGuard<'_, HashMap<String, Arc<Mutex<MultiplexedConnection>>>> {
        self.pool.lock().await
    }

    pub async fn add_new_connection(
        &self,
        datasource_id: String,
        connection: MultiplexedConnection,
    ) {
        let mut mutex = self.pool.lock();
        mutex
            .await
            .insert(datasource_id, Arc::new(Mutex::new(connection)));
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
                let client = redis::Client::open(redis_prop).unwrap();
                let conf = AsyncConnectionConfig::new()
                    .set_response_timeout(Duration::from_secs(1))
                    .set_connection_timeout(Duration::from_secs(10));

                match client
                    .get_multiplexed_async_connection_with_config(&conf)
                    .await
                {
                    Ok(con) => {
                        cached_connection.insert(with_db_key.clone(), Arc::new(Mutex::new(con)));
                        match cached_connection.get(&with_db_key) {
                            None => panic!("Fail to find datasource {datasource_id}"),
                            Some(_) => true,
                        }
                    }
                    Err(_) => false,
                }
            }
            Some(_) => true,
        }
    }

    pub async fn select_connection(
        &self,
        datasource_id: i64,
        selected_db: Option<i64>,
    ) -> Arc<Mutex<MultiplexedConnection>> {
        let ds_id = datasource_id.to_string();
        let mut cached_connection = self.pool.lock().await;
        let ds_prop = self.data_source_manager.lock().await;
        let ds = ds_prop.query_prop(datasource_id).await;
        let redis_prop = match ds {
            None => panic!("Fail to find datasource {ds_id}"),
            Some(ds_prop) => match selected_db {
                None => ds_prop.clone(),
                Some(db) => ds_prop.select_db(db as u16),
            },
        };

        let database = redis_prop.default_database.unwrap_or(0);
        let with_db_key = format!("{ds_id}#{database}");
        let size = cached_connection.len();
        match cached_connection.get(&with_db_key) {
            None => {
                let client = redis::Client::open(redis_prop).unwrap();
                let conf = AsyncConnectionConfig::new()
                    .set_response_timeout(Duration::from_secs(DEFAULT_RESPONSE_TIMEOUT_SECS))
                    .set_connection_timeout(Duration::from_secs(DEFAULT_CONNECT_TIMEOUT_SECS));

                match client
                    .get_multiplexed_async_connection_with_config(&conf)
                    .await
                {
                    Ok(con) => {
                        if size == 0 {
                            let mut act = self.active_connection.lock().await;
                            *act = Some(with_db_key.clone());
                        }

                        let arc = Arc::new(Mutex::new(con));
                        let cloned = arc.clone();
                        {
                            let mut t = cloned.lock().await;
                            let _: String = cmd("CLIENT")
                                .arg("SETNAME")
                                .arg("REDIS_STUDIO")
                                .query_async(t.deref_mut())
                                .await
                                .unwrap();
                        }

                        cached_connection.insert(with_db_key.clone(), arc);
                        match cached_connection.get(&with_db_key) {
                            None => panic!("Fail to find datasource {ds_id}"),
                            Some(ds) => Arc::clone(ds),
                        }
                    }
                    Err(_) => panic!("Fail to connect database."),
                }
            }
            Some(ds) => Arc::clone(ds),
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
        let mutex = self.pool.lock();
        Arc::clone(mutex.await.get(datasource_id).unwrap())
    }

    /// check all connection's status, collect connections which is unavailable.
    async fn iter_ping_connections<T: FnMut(i64, i64) + Send + 'static>(
        ping_callback: &Arc<Mutex<T>>,
        mut remove_enabled_key: &mut Vec<String>,
        m: MutexGuard<'_, HashMap<String, Arc<Mutex<MultiplexedConnection>>>>,
    ) {
        let keys = m.keys();
        for key in keys {
            let cloned_key = key.clone();
            let cloned_for_split = key.clone();
            let info = cloned_for_split.split("#").collect::<Vec<&str>>();
            let datasource_id = info[0].to_string().parse::<i64>().unwrap_or(0);
            let database = info[1];
            match m.get(key) {
                None => {}
                Some(conn) => {
                    Self::ping(
                        &ping_callback,
                        &mut remove_enabled_key,
                        cloned_key,
                        datasource_id,
                        database,
                        conn,
                    )
                    .await;
                }
            };
        }
    }

    fn evict_dead_connections(
        cloned_pool_map: &Arc<Mutex<HashMap<String, Arc<Mutex<MultiplexedConnection>>>>>,
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
        conn: &Arc<Mutex<MultiplexedConnection>>,
    ) {
        match conn.try_lock() {
            Ok(mut conn) => match cmd("PING").query_async::<String>(conn.deref_mut()).await {
                Ok(_) => {}
                Err(_) => {
                    let mut cbk = ping_callback.lock().await;
                    let callback = cbk.deref_mut();
                    callback(datasource_id, database.parse::<i64>().unwrap_or(0));
                    remove_enabled_key.push(cloned_key);
                }
            },
            Err(_) => {}
        }
    }
}
