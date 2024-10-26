use redis::{cmd, Cmd};
use redisstudio::storage::redis_pool::{DataSourceManager, RedisPool, RedisProp};
use std::ops::DerefMut;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

#[test]
fn test() {
    let client = redis::Client::open("redis://127.0.0.1/").unwrap();
    let mut con = client.get_connection().unwrap();

    match Cmd::new()
        .arg("HGETALL")
        .arg("newbattle:750001449")
        .query::<Vec<String>>(&mut con)
    {
        Ok(val) => {
            println!("{:?}", val);
        }
        Err(e) => {}
    };
}

#[test]
fn test_connection_reuse() {
    let client = redis::Client::open("redis://172.31.72.5/10").unwrap();
    let mut start = Instant::now();
    let mut con;
    {
        con = client.get_connection().unwrap();
        println!("首次获取connection耗时：{:?}", start.elapsed());

        start = Instant::now();
        let dbsize: i64 = cmd("DBSIZE").query(&mut con).unwrap();
        println!("执行指令耗时1：{:?}", start.elapsed());
        println!("dbsize: {}", dbsize);
    }

    {
        start = Instant::now();
        let dbsize: i64 = cmd("DBSIZE").query(&mut con).unwrap();
        println!("执行指令耗时2：{:?}", start.elapsed());
        println!("dbsize: {}", dbsize);
    }
}

#[tokio::test]
async fn test_datasource_pool() {
    let dsm = DataSourceManager::new();
    let props = RedisProp::simple("172.31.65.68");
    dsm.add_prop("datasource01".to_string(), props).await;
    let pool = RedisPool::new(dsm, Arc::new(Mutex::new(|s, d| {})));
    let mut start = Instant::now();
    {
        start = Instant::now();
        let c1 = pool.fetch_connection("datasource01".into());
        println!("获得连接耗时：{:?}", start.elapsed());
        let binding = c1.await;
        let mut mutex = binding.lock().await;
        start = Instant::now();
        let dbsize: i64 = cmd("DBSIZE").query_async(mutex.deref_mut()).await.unwrap();
        println!("dbsize = {}, 耗时: {:?}", dbsize, start.elapsed());
    }

    {
        start = Instant::now();
        let c1 = pool.fetch_connection("datasource01".into());
        println!("获得连接耗时：{:?}", start.elapsed());
        let binding = c1.await;
        let mut mutex = binding.lock().await;
        start = Instant::now();
        let dbsize: i64 = cmd("DBSIZE").query_async(mutex.deref_mut()).await.unwrap();
        println!("dbsize = {}, 耗时: {:?}", dbsize, start.elapsed());
    }

    {
        start = Instant::now();
        let c1 = pool.fetch_connection("datasource01".into());
        println!("获得连接耗时：{:?}", start.elapsed());
        let binding = c1.await;
        let mut mutex = binding.lock().await;
        start = Instant::now();
        let dbsize: i64 = cmd("DBSIZE").query_async(mutex.deref_mut()).await.unwrap();
        println!("dbsize = {}, 耗时: {:?}", dbsize, start.elapsed());
    }
}

#[tokio::test]
async fn async_test() {
    let dsm = DataSourceManager::new();
    let pool = RedisPool::new(dsm, Arc::new(Mutex::new(|s, d| {})));
    let mut start = Instant::now();
    let client = redis::Client::open("redis://172.31.72.5/10").unwrap();
    let con = client.get_multiplexed_async_connection().await.unwrap();
    println!("创建连接耗时：{:?}", start.elapsed());
    pool.add_new_connection("test".into(), con).await;
}

#[tokio::test]
async fn test_db_select() {
    let dsm = DataSourceManager::new();
    let props = RedisProp::simple("172.31.65.68");
    dsm.add_prop("datasource01".to_string(), props).await;

    let pool = RedisPool::new(dsm, Arc::new(Mutex::new(|datasource_id, database| {
        println!("connection lost: {datasource_id}, {database}");
    })));
    {
        let t = pool.select_connection("datasource01", None).await;
        println!("finished");
    }

    {
        let t = pool.select_connection("datasource01", Some(10)).await;
        println!("finished");
    }

    tokio::time::sleep(Duration::from_secs(30)).await
}