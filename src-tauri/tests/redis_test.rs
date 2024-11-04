use redis::{cmd, Cmd};
use redisstudio::storage::redis_pool::{DataSourceManager, RedisPool, RedisProp};
use redisstudio::utils::redis_util;
use serde_json::json;
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

#[test]
fn test_redis_info_parse() {
    let info_str = r#"
# Server
redis_version:5.0.14
redis_git_sha1:00000000
redis_git_dirty:0
redis_build_id:73200918f4a4fb0e
redis_mode:standalone
os:Linux 3.10.0-957.21.3.el7.x86_64 x86_64
arch_bits:64
multiplexing_api:epoll
atomicvar_api:atomic-builtin
gcc_version:4.8.5
process_id:20814
run_id:1b2eab2c0dc8ae567d05c2b326486e129b56e636
tcp_port:6379
uptime_in_seconds:28072023
uptime_in_days:324
hz:10
configured_hz:10
lru_clock:1957017
executable:/usr/local/bin/./redis-server
config_file:/usr/local/bin/redis.conf

# Clients
connected_clients:752
client_recent_max_input_buffer:4
client_recent_max_output_buffer:0
blocked_clients:24

# Memory
used_memory:132251264
used_memory_human:126.12M
used_memory_rss:138817536
used_memory_rss_human:132.39M
used_memory_peak:162642288
used_memory_peak_human:155.11M
used_memory_peak_perc:81.31%
used_memory_overhead:20204806
used_memory_startup:791392
used_memory_dataset:112046458
used_memory_dataset_perc:85.23%
allocator_allocated:132387144
allocator_active:142819328
allocator_resident:147824640
total_system_memory:8201076736
total_system_memory_human:7.64G
used_memory_lua:78848
used_memory_lua_human:77.00K
used_memory_scripts:15048
used_memory_scripts_human:14.70K
number_of_cached_scripts:25
maxmemory:0
maxmemory_human:0B
maxmemory_policy:noeviction
allocator_frag_ratio:1.08
allocator_frag_bytes:10432184
allocator_rss_ratio:1.04
allocator_rss_bytes:5005312
rss_overhead_ratio:0.94
rss_overhead_bytes:-9007104
mem_fragmentation_ratio:1.05
mem_fragmentation_bytes:6567568
mem_not_counted_for_evict:0
mem_replication_backlog:0
mem_clients_slaves:0
mem_clients_normal:13544838
mem_aof_buffer:0
mem_allocator:jemalloc-5.1.0
active_defrag_running:0
lazyfree_pending_objects:0

# Persistence
loading:0
rdb_changes_since_last_save:9804
rdb_bgsave_in_progress:0
rdb_last_save_time:1730010180
rdb_last_bgsave_status:ok
rdb_last_bgsave_time_sec:0
rdb_current_bgsave_time_sec:-1
rdb_last_cow_size:4501504
aof_enabled:0
aof_rewrite_in_progress:0
aof_rewrite_scheduled:0
aof_last_rewrite_time_sec:-1
aof_current_rewrite_time_sec:-1
aof_last_bgrewrite_status:ok
aof_last_write_status:ok
aof_last_cow_size:0

# Stats
total_connections_received:87626886
total_commands_processed:9903853058
instantaneous_ops_per_sec:202
total_net_input_bytes:819631105860
total_net_output_bytes:597431704433
instantaneous_input_kbps:14.58
instantaneous_output_kbps:2.73
rejected_connections:0
sync_full:0
sync_partial_ok:0
sync_partial_err:0
expired_keys:1344617
expired_stale_perc:0.21
expired_time_cap_reached_count:0
evicted_keys:0
keyspace_hits:1592289582
keyspace_misses:1116807232
pubsub_channels:11
pubsub_patterns:0
latest_fork_usec:2136
migrate_cached_sockets:0
slave_expires_tracked_keys:0
active_defrag_hits:0
active_defrag_misses:0
active_defrag_key_hits:0
active_defrag_key_misses:0

# Replication
role:master
connected_slaves:0
master_replid:f5ed3f7c8baf09f82c41ce434a885fc3343ecd1a
master_replid2:0000000000000000000000000000000000000000
master_repl_offset:0
second_repl_offset:-1
repl_backlog_active:0
repl_backlog_size:1048576
repl_backlog_first_byte_offset:0
repl_backlog_histlen:0

# CPU
used_cpu_sys:90170.765128
used_cpu_user:74705.263009
used_cpu_sys_children:10302.253146
used_cpu_user_children:109567.258609

# Cluster
cluster_enabled:0

# Keyspace
db0:keys=109840,expires=1678,avg_ttl=443953988302574
db1:keys=77,expires=71,avg_ttl=284416295193
db10:keys=4060,expires=1190,avg_ttl=1163748616275
db11:keys=509,expires=394,avg_ttl=3960455060
db12:keys=2,expires=0,avg_ttl=0
    "#;

    let result = redis_util::parse_redis_info(info_str);
    match result {
        None => {
            println!("Fail to parse info.")
        }
        Some(data) => {
            println!("Success: {}", json!(data));
        }
    }
}

#[tokio::test]
pub async fn test_analysis() {
    // prepare test datasource
    let dsm = DataSourceManager::new();
    let props = RedisProp::simple("172.31.65.68");
    dsm.add_prop("datasource01".to_string(), props).await;
    let redis_pool = RedisPool::new(dsm, Arc::new(Mutex::new(|datasource_id, database| {})));
    let connection = redis_pool.select_connection("datasource01", None).await;

    // DO TEST
    let key_pattern = Some("*".to_string());
    let scan_count = Some(10000);
    let page_size = 200;
    let ns_layer = 2;
    let separator = "[:]";

    redis_util::async_analysis_database(
        connection,
        key_pattern,
        scan_count,
        page_size,
        separator,
        ns_layer, |r| {
            if r.finished {
                // output result
                println!("Receive Reporter: {}", json!(r));
            } else {
                println!("Analysing ... {}", r.progress);
            }
        },
    ).await;
}