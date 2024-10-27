use regex::Regex;
use serde::{Deserialize, Serialize};

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


