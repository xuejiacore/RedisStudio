use chrono::Local;
use futures::TryFutureExt;
use redis::aio::MultiplexedConnection;
use redis::cmd;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::mpsc::Sender;

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Info {
    server: Option<Server>,
    clients: Option<Clients>,
    memory: Option<Memory>,
    stats: Option<Stats>,
    cpu: Option<Cpu>,
    keyspace: Option<Vec<KeySpace>>,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Server {
    redis_version: Option<String>,
    os: Option<String>,
    config_file: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Clients {
    connected_clients: Option<u64>,
    client_recent_max_input_buffer: Option<u64>,
    client_recent_max_output_buffer: Option<u64>,
    blocked_clients: Option<u32>,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Memory {
    used_memory: Option<u128>,
    used_memory_human: Option<String>,
    used_memory_rss: Option<u128>,
    used_memory_rss_human: Option<String>,
    total_system_memory: Option<u128>,
    total_system_memory_human: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Stats {
    total_connections_received: Option<u64>,
    total_commands_processed: Option<u64>,
    instantaneous_ops_per_sec: Option<u64>,
    total_net_input_bytes: Option<u64>,
    total_net_output_bytes: Option<u64>,
    instantaneous_input_kbps: Option<f32>,
    instantaneous_output_kbps: Option<f32>,
    rejected_connections: Option<u64>,
    sync_full: Option<u64>,
    sync_partial_ok: Option<u64>,
    sync_partial_err: Option<u64>,
    expired_keys: Option<u64>,
    expired_stale_perc: Option<f32>,
    expired_time_cap_reached_count: Option<u64>,
    evicted_keys: Option<u64>,
    keyspace_hits: Option<u64>,
    keyspace_misses: Option<u64>,
    pubsub_channels: Option<u64>,
    pubsub_patterns: Option<u64>,
    latest_fork_usec: Option<u64>,
    migrate_cached_sockets: Option<u64>,
    slave_expires_tracked_keys: Option<u64>,
    active_defrag_hits: Option<u64>,
    active_defrag_misses: Option<u64>,
    active_defrag_key_hits: Option<u64>,
    active_defrag_key_misses: Option<u64>,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct Cpu {
    used_cpu_sys: Option<f64>,
    used_cpu_user: Option<f64>,
    used_cpu_sys_children: Option<f64>,
    used_cpu_user_children: Option<f64>,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct KeySpace {
    database: Option<u32>,
    keys: Option<u128>,
    expires: Option<u64>,
    avg_ttl: Option<u64>,
}

pub fn parse_redis_info<T: AsRef<str>>(info_str: T) -> Option<Info> {
    let info_string = info_str.as_ref();
    let mut info = Info::default();

    let mut current_section = "";
    let re = Regex::new(r"(?<name>db(?<index>\d+)):keys=(?<keys>\d+),expires=(?<expires>\d+),avg_ttl=(?<avg_ttl>\d+)").unwrap();
    for line in info_string.lines() {
        if line.is_empty() || line.starts_with("#") {
            if line.starts_with("#") {
                current_section = line[1..].trim();
            }
            continue;
        }

        if let Some((key, value)) = line.split_once(":") {
            match current_section {
                "Server" => {
                    let mut server = info.server.unwrap_or_else(|| Server::default());
                    match key {
                        "redis_version" => server.redis_version = value.parse::<String>().map(|v| Some(v)).unwrap_or(None),
                        "os" => server.os = value.parse::<String>().map(|v| Some(v)).unwrap_or(None),
                        "config_file" => server.config_file = value.parse::<String>().map(|v| Some(v)).unwrap_or(None),
                        &_ => {}
                    }
                    info.server = Some(server);
                }
                "Clients" => {
                    let mut clients = info.clients.unwrap_or_else(|| Clients::default());
                    match key {
                        "connected_clients" => clients.connected_clients = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "client_recent_max_input_buffer" => clients.client_recent_max_input_buffer = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "client_recent_max_output_buffer" => clients.client_recent_max_output_buffer = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "blocked_clients" => clients.blocked_clients = value.parse::<u32>().map(|v| Some(v)).unwrap_or(None),
                        &_ => {}
                    }
                    info.clients = Some(clients);
                }
                "CPU" => {
                    let mut cpu = info.cpu.unwrap_or_else(|| Cpu::default());
                    match key {
                        "used_cpu_sys" => cpu.used_cpu_sys = value.parse::<f64>().map(|v| Some(v)).unwrap_or(None),
                        "used_cpu_user" => cpu.used_cpu_user = value.parse::<f64>().map(|v| Some(v)).unwrap_or(None),
                        "used_cpu_sys_children" => cpu.used_cpu_sys_children = value.parse::<f64>().map(|v| Some(v)).unwrap_or(None),
                        "used_cpu_user_children" => cpu.used_cpu_user_children = value.parse::<f64>().map(|v| Some(v)).unwrap_or(None),
                        &_ => {}
                    }
                    info.cpu = Some(cpu);
                }
                "Memory" => {
                    let mut memory = info.memory.unwrap_or_else(|| Memory::default());
                    match key {
                        "used_memory" => memory.used_memory = value.parse::<u128>().map(|v| Some(v)).unwrap_or(None),
                        "used_memory_human" => memory.used_memory_human = Some(value.to_string()),
                        "used_memory_rss" => memory.used_memory_rss = value.parse::<u128>().map(|v| Some(v)).unwrap_or(None),
                        "used_memory_rss_human" => memory.used_memory_rss_human = Some(value.to_string()),
                        "total_system_memory" => memory.total_system_memory = value.parse::<u128>().map(|v| Some(v)).unwrap_or(None),
                        "total_system_memory_human" => memory.total_system_memory_human = value.parse::<String>().map(|v| Some(v)).unwrap_or(None),
                        &_ => {}
                    }
                    info.memory = Some(memory);
                }
                "Stats" => {
                    let mut stats = info.stats.unwrap_or_else(|| Stats::default());
                    match key {
                        "total_connections_received" => stats.total_connections_received = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "total_commands_processed" => stats.total_commands_processed = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "instantaneous_ops_per_sec" => stats.instantaneous_ops_per_sec = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "total_net_input_bytes" => stats.total_net_input_bytes = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "total_net_output_bytes" => stats.total_net_output_bytes = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "instantaneous_input_kbps" => stats.instantaneous_input_kbps = value.parse::<f32>().map(|v| Some(v)).unwrap_or(None),
                        "instantaneous_output_kbps" => stats.instantaneous_output_kbps = value.parse::<f32>().map(|v| Some(v)).unwrap_or(None),
                        "rejected_connections" => stats.rejected_connections = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "sync_full" => stats.sync_full = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "sync_partial_ok" => stats.sync_partial_ok = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "sync_partial_err" => stats.sync_partial_err = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "expired_keys" => stats.expired_keys = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "expired_stale_perc" => stats.expired_stale_perc = value.parse::<f32>().map(|v| Some(v)).unwrap_or(None),
                        "expired_time_cap_reached_count" => stats.expired_time_cap_reached_count = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "evicted_keys" => stats.evicted_keys = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "keyspace_hits" => stats.keyspace_hits = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "keyspace_misses" => stats.keyspace_misses = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "pubsub_channels" => stats.pubsub_channels = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "pubsub_patterns" => stats.pubsub_patterns = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "latest_fork_usec" => stats.latest_fork_usec = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "migrate_cached_sockets" => stats.migrate_cached_sockets = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "slave_expires_tracked_keys" => stats.slave_expires_tracked_keys = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "active_defrag_hits" => stats.active_defrag_hits = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "active_defrag_misses" => stats.active_defrag_misses = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "active_defrag_key_hits" => stats.active_defrag_key_hits = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        "active_defrag_key_misses" => stats.active_defrag_key_misses = value.parse::<u64>().map(|v| Some(v)).unwrap_or(None),
                        &_ => {}
                    }
                    info.stats = Some(stats);
                }
                "Keyspace" => {
                    match re.captures(line) {
                        None => {}
                        Some(cap) => {
                            let mut vec = info.keyspace.unwrap_or_else(|| vec![]);

                            let mut keyspace = KeySpace::default();
                            keyspace.keys = cap.name("keys").map_or_else(|| None, |v| {
                                v.as_str().parse::<u128>().map(|vv| Some(vv)).unwrap_or(None)
                            });
                            keyspace.database = cap.name("index").map_or_else(|| None, |v| {
                                v.as_str().parse::<u32>().map(|vv| Some(vv)).unwrap_or(None)
                            });
                            keyspace.expires = cap.name("expires").map_or_else(|| None, |v| {
                                v.as_str().parse::<u64>().map(|vv| Some(vv)).unwrap_or(None)
                            });
                            keyspace.avg_ttl = cap.name("avg_ttl").map_or_else(|| None, |v| {
                                v.as_str().parse::<u64>().map(|vv| Some(vv)).unwrap_or(None)
                            });

                            vec.push(keyspace);
                            info.keyspace = Some(vec);
                        }
                    };
                }
                &_ => {}
            }
        }
    }

    Some(info)
}

#[derive(Clone, Serialize, Deserialize, Default, Debug)]
pub struct TtlAgg {
    total: usize,
    lv: u16,
    group_by_ns: HashMap<String, usize>,
}

#[derive(Clone, Serialize, Deserialize, Default, Debug)]
pub struct AnalysisResult {
    /// key count group by key type.
    pub type_count: HashMap<String, usize>,
    /// memory usage group by key type.
    pub type_memory: HashMap<String, usize>,
    /// key count group by namespace
    pub ns_count: HashMap<String, usize>,
    /// memory group by namespace
    pub ns_memory: HashMap<String, usize>,
    /// TTL group by time unit.
    pub ttl_sec: HashMap<String, TtlAgg>,
    /// analysis had finished.
    pub finished: bool,
    /// scan total count.
    pub scan_total: usize,
    /// scan total memory.
    pub mem_total: usize,
    /// scan progress
    pub progress: f64,
    /// scan start timestamp.
    pub start_time: i64,
    /// analysis elapsed.
    pub elapsed: i64,
    /// dbsize
    pub dbsize: usize,
}

/// analysis the database
/// ## Parameters
/// * `scan_count` - scan count limit
/// * `callback` - report snippet
pub async fn async_analysis_database<F, S>(
    mut connection: MultiplexedConnection,
    key_pattern: Option<String>,
    scan_count: Option<usize>,
    page_size: usize,
    separator: S,
    ns_layer: usize,
    mut callback: F,
)
where
    F: FnMut(AnalysisResult) + Send + 'static,
    S: AsRef<str>,
{
    let current_db_size = {
        cmd("DBSIZE").query_async(&mut connection).await.unwrap_or(0usize)
    };
    let scan_total = std::cmp::min(current_db_size, scan_count.unwrap_or(current_db_size));

    let match_pattern = key_pattern.unwrap_or("*".to_string());
    let regex = Regex::new(separator.as_ref()).unwrap_or(Regex::new(":").unwrap());
    let mut cloned_connection = connection.clone();
    let ch = tokio::sync::mpsc::channel::<Vec<String>>(128);
    let sender = ch.0;

    let now = Local::now();
    let start_time = now.timestamp_millis();
    let scan_key_handle = tokio::spawn(async move {
        // scan keys and emit to another
        scan_keys_and_emit(connection, sender, scan_total, page_size, &match_pattern).await;
    });

    let mut receiver = ch.1;
    let calculate_handle = tokio::spawn(async move {
        let mut result = AnalysisResult::default();
        result.start_time = start_time;
        // query key types
        result.dbsize = {
            cmd("DBSIZE").query_async(&mut cloned_connection).await.unwrap()
        };

        loop {
            if let Some(keys) = receiver.recv().await {
                let count = keys.len();
                let mut type_pipeline = redis::pipe();
                let mut memory_pipeline = redis::pipe();
                let mut ttl_pipeline = redis::pipe();

                let cloned_keys = keys.clone();
                keys.iter().for_each(|k| {
                    type_pipeline.cmd("TYPE").arg(&k);
                    memory_pipeline.cmd("MEMORY").arg("USAGE").arg(&k);
                    ttl_pipeline.cmd("TTL").arg(&k);
                });

                // query key types
                let types: Vec<String> = {
                    type_pipeline.query_async(&mut cloned_connection).await.unwrap()
                };

                // query key memory
                let memories: Vec<usize> = memory_pipeline.query_async(&mut cloned_connection).await.unwrap();

                // query key TTL
                let ttls: Vec<i64> = ttl_pipeline.query_async(&mut cloned_connection).await.unwrap();

                result.scan_total += count;
                for idx in 0..cloned_keys.len() {
                    let key_name = &cloned_keys[idx];
                    let type_name = &types[idx];
                    let memory = &memories[idx];
                    let ttl = &ttls[idx];
                    let (lv, ttl_time_unit) = time_unit_from_ttl(*ttl);

                    result.mem_total += memory;

                    if let Some(val) = result.ttl_sec.get_mut(&ttl_time_unit) {
                        (*val).total += 1;
                    } else {
                        let mut ttl_agg = TtlAgg::default();
                        ttl_agg.total += 1;
                        ttl_agg.lv = lv;
                        result.ttl_sec.insert(ttl_time_unit.clone(), ttl_agg);
                    }

                    // type statistics
                    if let Some(val) = result.type_memory.get_mut(type_name) {
                        *val += memory;
                    } else {
                        result.type_memory.insert(type_name.clone(), *memory);
                    }
                    if let Some(val) = result.type_count.get_mut(type_name) {
                        *val += 1;
                    } else {
                        result.type_count.insert(type_name.clone(), 1);
                    }

                    // namespace statistics
                    let replaced = regex.replace_all(key_name, "\0").to_string();
                    let knife = replaced.split("\0").collect::<Vec<&str>>();

                    let ns_max_layer = knife.len() - 1;
                    for this_layer in 0..ns_layer {
                        if this_layer >= ns_max_layer {
                            break;
                        }

                        let mut joined_ns = knife[0..this_layer + 1].join("\0");
                        let namespace = joined_ns.as_str();

                        // aggregate by ttl time unit, namespace
                        if let Some(val) = result.ttl_sec.get_mut(&ttl_time_unit) {
                            if let Some(ns_val) = (*val).group_by_ns.get_mut(namespace) {
                                *ns_val += 1;
                            } else {
                                (*val).group_by_ns.insert(namespace.to_string(), 1);
                            };
                        } else {
                            let mut ttl_agg = TtlAgg::default();
                            ttl_agg.total += 1;
                            ttl_agg.lv = lv;
                            ttl_agg.group_by_ns.insert(namespace.to_string(), 1);
                            result.ttl_sec.insert(ttl_time_unit.to_string(), ttl_agg);
                        }

                        // memory usage group by namespace
                        if let Some(val) = result.ns_memory.get_mut(namespace) {
                            *val += memory;
                        } else {
                            result.ns_memory.insert(namespace.to_string(), *memory);
                        }

                        // key count group by namespace
                        if let Some(val) = result.ns_count.get_mut(namespace) {
                            *val += 1;
                        } else {
                            result.ns_count.insert(namespace.to_string(), 1);
                        }
                    }
                }

                let had_finished = keys.is_empty();
                result.finished = had_finished;

                let progress = result.scan_total as f64 / scan_total as f64;
                result.progress = progress.min(1f64);
                if had_finished {
                    let now = Local::now();
                    result.elapsed = now.timestamp_millis() - result.start_time;
                }
                callback(result.clone());
                if had_finished {
                    break;
                }
            };
        }
    });

    let _ = scan_key_handle.await;
    let _ = calculate_handle.await;
}

/// scan keys by provided count total and page size.
async fn scan_keys_and_emit(
    mut connection: MultiplexedConnection,
    sender: Sender<Vec<String>>,
    scan_count: usize,
    page_size: usize,
    key_pattern: &str,
) {
    let mut cursor = 0;
    let mut scanned = 0;
    if scan_count == 0 {
        let _ = sender.send(vec![]).await;
        return;
    }
    loop {
        let remain = std::cmp::min(page_size + scanned, scan_count) - scanned;
        let (new_cursor, results): (u64, Vec<String>) = {
            cmd("SCAN").arg(cursor).arg("MATCH").arg(key_pattern).arg("COUNT").arg(remain)
                .query_async(&mut connection)
                .await
                .unwrap()
        };

        scanned = scanned + results.len();
        let _ = sender.send(results).await;

        cursor = new_cursor;
        if scanned >= scan_count || cursor == 0 {
            let _ = sender.send(vec![]).await;
            break;
        }
    }
}

fn time_unit_from_ttl(ttl: i64) -> (u16, String) {
    if ttl < 0 {
        (999, "perm".to_string())
    } else if ttl >= 60 && ttl < 60 * 10 {
        (0, "＜10min".to_string())
    } else if ttl >= 60 * 10 && ttl < 60 * 30 {
        (1, "＜30min".to_string())
    } else if ttl >= 60 * 30 && ttl < 3600 {
        (2, "＜1hrs".to_string())
    } else if ttl >= 3600 && ttl < 3600 * 3 {
        (3, "＜3hrs".to_string())
    } else if ttl >= 3600 * 3 && ttl < 3600 * 7 {
        (4, "＜7hrs".to_string())
    } else if ttl >= 3600 * 7 && ttl < 86400 {
        (5, "＜1d".to_string())
    } else if ttl >= 86400 && ttl < 86400 * 3 {
        (6, "＜3d".to_string())
    } else if ttl >= 86400 * 3 && ttl < 86400 * 7 {
        (7, "＜1w".to_string())
    } else if ttl >= 86400 * 7 && ttl < 86400 * 30 {
        (8, "＜1mon".to_string())
    } else if ttl >= 86400 * 30 && ttl < 86400 * 90 {
        (9, "＜3mon".to_string())
    } else {
        (10, "≥3mon".to_string())
    }
}