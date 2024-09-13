use redis::{cmd, Cmd};
use redisstudio::storage::redis_pool::RedisPool;
use std::ops::DerefMut;
use std::time::Instant;
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
    let pool = RedisPool::new();
    let mut start = Instant::now();
    let client = redis::Client::open("redis://172.31.72.5/10").unwrap();
    let con = client.get_multiplexed_async_connection().await.unwrap();
    println!("创建连接耗时：{:?}", start.elapsed());
    pool.add_new_connection("test".into(), con).await;

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
    let pool = RedisPool::new();
    let mut start = Instant::now();
    let client = redis::Client::open("redis://172.31.72.5/10").unwrap();
    let con = client.get_multiplexed_async_connection().await.unwrap();
    println!("创建连接耗时：{:?}", start.elapsed());
    pool.add_new_connection("test".into(), con).await;
}