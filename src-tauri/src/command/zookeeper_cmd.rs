use std::cmp::Ordering;
use std::path::Path;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::Wry;
use zookeeper::{
    Acl, CreateMode, Stat, WatchedEvent, Watcher, ZkError, ZkResult, ZooKeeper, ZooKeeperExt,
};

#[tauri::command]
pub fn zk_invoke(
    cmd: &str,
    params: &str,
    app: tauri::AppHandle,
    window: tauri::Window<Wry>,
) -> String {
    match dispatch_zk_cmd(cmd, params) {
        Ok(json) => json.to_string(),
        Err(e) => json!({"error": e.to_string()}).to_string(),
    }
}

#[derive(Serialize, Deserialize, Default)]
pub struct NodeStat {
    /// The transaction ID that created the znode.
    pub czxid: i64,
    /// The last transaction that modified the znode.
    pub mzxid: i64,
    /// Milliseconds since epoch when the znode was created.
    pub ctime: i64,
    /// Milliseconds since epoch when the znode was last modified.
    pub mtime: i64,
    /// The number of changes to the data of the znode.
    pub version: i32,
    /// The number of changes to the children of the znode.
    pub cversion: i32,
    /// The number of changes to the ACL of the znode.
    pub aversion: i32,
    /// The session ID of the owner of this znode, if it is an ephemeral entry.
    pub ephemeral_owner: i64,
    /// The length of the data field of the znode.
    pub data_length: i32,
    /// The number of children this znode has.
    pub num_children: i32,
    /// The transaction ID that last modified the children of the znode.
    pub pzxid: i64,
}

impl Into<NodeStat> for Stat {
    fn into(self) -> NodeStat {
        NodeStat {
            czxid: self.czxid,
            mzxid: self.mzxid,
            ctime: self.ctime,
            mtime: self.mtime,
            version: self.version,
            cversion: self.cversion,
            aversion: self.aversion,
            ephemeral_owner: self.ephemeral_owner,
            data_length: self.data_length,
            num_children: self.num_children,
            pzxid: self.pzxid,
        }
    }
}

#[derive(Serialize, Deserialize, Default)]
struct NodeInfo {
    node: String,
    parent: String,
    children: Vec<NodeInfo>,
    unknown_children: bool,
    stat: Option<NodeStat>,
}

impl Eq for NodeInfo {}

impl PartialEq<Self> for NodeInfo {
    fn eq(&self, other: &Self) -> bool {
        self.node.eq(&other.node) && self.parent.eq(&other.parent)
    }
}

impl PartialOrd<Self> for NodeInfo {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for NodeInfo {
    fn cmp(&self, other: &Self) -> Ordering {
        let mut n1_children = 1;
        if let Some(stat) = &self.stat {
            if stat.num_children > 0 {
                n1_children = 0;
            }
        }

        let mut n2_children = 1;
        if let Some(stat) = &other.stat {
            if stat.num_children > 0 {
                n2_children = 0;
            }
        }
        n1_children.cmp(&n2_children)
    }
}

struct LoggingWatcher;

impl Watcher for LoggingWatcher {
    fn handle(&self, e: WatchedEvent) {
        println!("{:?}", e)
    }
}

pub fn dispatch_zk_cmd(cmd: &str, param_json: &str) -> Result<Value, ZkError> {
    let zk_urls = "172.31.65.68:2181";
    let zk = ZooKeeper::connect(&*zk_urls, Duration::from_secs(15), LoggingWatcher).unwrap();

    let start = Instant::now();
    let mut json = Default::default();
    match cmd {
        "list_children" => {
            let mut data = vec![];
            list_children(&zk, serde_json::from_str(param_json).unwrap(), 0, &mut data)?;
            data.sort();
            let end = Instant::now();
            let duration = end.duration_since(start);

            json = json!({"success": true, "data": &data, "elapsed": duration.as_millis()});
        }
        "get_data" => {
            match get_data(&zk, serde_json::from_str(param_json).unwrap()) {
                Ok(value) => json = value,
                Err(error) => json = json!({"success": false, "error": error.to_string()}),
            };
        }
        "set_data" => json = set_data(&zk, serde_json::from_str(param_json).unwrap())?,
        "delete_node" => match delete_node(&zk, serde_json::from_str(param_json).unwrap()) {
            Ok(value) => json = value,
            Err(error) => json = json!({"success": false, "error": error.to_string()}),
        },
        _ => json = json!({"success": false, "error": "unsupported zookeeper command"}),
    }
    zk.close()?;
    Ok(json)
}

#[derive(Serialize, Deserialize)]
struct ListChildrenParam {
    #[serde(default)]
    path: String,
    #[serde(default)]
    depth: usize,
}

/// list zookeeper children by provided path and depth.
fn list_children(
    zk: &ZooKeeper,
    param: ListChildrenParam,
    depth: usize,
    nodes: &mut Vec<NodeInfo>,
) -> Result<(), ZkError> {
    let children = zk.get_children(&param.path.as_str(), false)?;
    for node in &children {
        let mut node_info = NodeInfo::default();
        node_info.parent = param.path.clone();
        node_info.node = node.clone();
        let mut child_path = param.path.clone();
        if child_path.ends_with("/") {
            child_path.push_str(node.as_str());
        } else {
            child_path.push_str("/");
            child_path.push_str(node.as_str());
        }
        let state = zk.exists(&child_path.as_str(), false)?;
        if let Some(s) = state {
            node_info.stat = Some(s.into());
        }

        if depth < param.depth {
            node_info.unknown_children = false;
            list_children(
                &zk,
                ListChildrenParam {
                    path: child_path,
                    depth: param.depth,
                },
                depth + 1,
                &mut node_info.children,
            )?;
        } else {
            node_info.unknown_children = true;
        }

        nodes.push(node_info);
    }
    Ok(())
}

#[derive(Serialize, Deserialize)]
struct GetDataParam {
    path: String,
}

/// get data from zookeeper by provided path
fn get_data(zk: &ZooKeeper, param: GetDataParam) -> Result<Value, ZkError> {
    let data = zk.get_data(&param.path, false)?;
    let maybe_str = String::from_utf8(data.0.clone());
    match maybe_str {
        Ok(content) => {
            let stat: NodeStat = data.1.into();
            Ok(json!({"success": true, "type": "string", "content": content, "stat": stat}))
        }
        Err(e) => {
            let base64_content = base64::encode(data.0);
            Ok(json!({"success": true, "type": "base64","content": base64_content}))
        }
    }
}

#[derive(Serialize, Deserialize)]
struct SetDataParam {
    path: String,
    data: Option<String>,
}

/// set data into zookeeper node
fn set_data(zk: &ZooKeeper, param: SetDataParam) -> Result<Value, ZkError> {
    let this_node = zk.exists(&param.path, false)?;
    let mut set_already = false;
    if let None = this_node {
        let path = Path::new(&param.path);
        if let Some(parent) = path.parent() {
            set_data(
                &zk,
                SetDataParam {
                    path: parent.to_string_lossy().to_string(),
                    data: None,
                },
            )?;
        }

        if let Some(data) = &param.data {
            zk.create(
                &param.path,
                data.clone().into_bytes(),
                Acl::open_unsafe().clone(),
                CreateMode::Persistent,
            )?;
            set_already = true;
        } else {
            zk.create(
                &param.path,
                Vec::new(),
                Acl::open_unsafe().clone(),
                CreateMode::Persistent,
            )?;
        }
    }
    if !set_already {
        if let Some(data) = &param.data {
            zk.set_data(&param.path, data.clone().into_bytes(), None)?;
        }
    }
    Ok(json!({"success": true}))
}

#[derive(Serialize, Deserialize)]
struct DeleteNodeParam {
    path: String,
    recursion: bool,
}

/// delete node from zookeeper
fn delete_node(zk: &ZooKeeper, param: DeleteNodeParam) -> Result<Value, ZkError> {
    if param.recursion {
        zk.delete_recursive(&param.path)?;
    } else {
        zk.delete(&param.path, None)?;
    }
    Ok(json!({"success": true}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        // let result = dispatch_zk_cmd("list_children", r#"{"path":"/","depth":0}"#).unwrap();
        // println!("{}", result);
        //
        let set_data_result = dispatch_zk_cmd("set_data", r#"{"path":"/PaymentCentre/security/access-key-strategy.yaml","data":"\nDEV-BUDUODUO-MALL:\n  biz-application: \"100001\"\n  pub-key-location: \"/data/payment-centre/security/pub-key/key-demo-foo1.pub\"\n  pri-key-location: \"/data/payment-centre/security/pub-key/key-demo-foo1\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n\n# 多多旅行，开发使用\nDEV-DUODUO-TRAVEL:\n  biz-application: \"100021\"\n  pub-key-location: \"/data/payment-centre/security/pub-key/key-demo-foo1.pub\"\n  pri-key-location: \"/data/payment-centre/security/pub-key/key-demo-foo1\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n\n\n# 步多多商城测试环境调用，大数据\n2485b5266d8ef24b:\n  biz-application: \"100001-mall\"\n  pub-key-location: \"/data/payment-centre/security/buduoduo_test_access_key/buduoduo_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/buduoduo_test_access_key/buduoduo_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n# 步多多健身模块 测试环境调用\n0476d6e8e5fe4b07:\n  biz-application: \"100001\"\n  pub-key-location: \"/data/payment-centre/security/buduoduo_test_access_key/buduoduo_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/buduoduo_test_access_key/buduoduo_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"UPDATE_ORDER\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n# 看图猜成语测试环境调用\n08bc03c70a7b1d08:\n  biz-application: \"100018\"\n  pub-key-location: \"/data/payment-centre/security/kantucaichengyu_test_access_key/kantu_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/kantucaichengyu_test_access_key/kantu_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"UPDATE_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"CHECK_OPPO\"\n    - \"CHECK_VIVO\"\n    - \"CHECK_MI\"\n    - \"CHECK_HUAWEI\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n# 萌宠快乐消测试环境调用\nmengchong_test:\n  biz-application: \"100025\"\n  pub-key-location: \"/data/payment-centre/security/mengchong_test_access_key/mengchong_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/mengchong_test_access_key/mengchong_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"CHECK_OPPO\"\n    - \"UPDATE_ORDER\"\n    - \"CHECK_YYB\"\n    - \"CHECK_VIVO\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n# 刺客传说测试环境调用\na08dd59db21f4577b7:\n  biz-application: \"100024\"\n  pub-key-location: \"/data/payment-centre/security/cike_test_access_key/cike_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/cike_test_access_key/cike_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"CHECK_YYB\"\n    - \"CHECK_233_LEYUAN\"\n    - \"CHECK_JRTTM_PAY\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.86.29\"\n\n\n# 明日斗地主测试环境调用\n05fb1cc8582e46d985:\n  biz-application: \"100011\"\n  pub-key-location: \"/data/payment-centre/security/mrddz_test_access_key/mrddz_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/mrddz_test_access_key/mrddz_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"CHECK_YYB\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n# 轻甜测试环境调用\n73a909b98d764836a5:\n  biz-application: \"100027\"\n  pub-key-location: \"/data/payment-centre/security/qingtian_test_access_key/qingtian_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/qingtian_test_access_key/qingtian_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n# 多多守护环境调用\nfecec792b48943d39b:\n  biz-application: \"100031\"\n  pub-key-location: \"/data/payment-centre/security/duoduoshouhu_test_access_key/duoduoshouhu_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/duoduoshouhu_test_access_key/duoduoshouhu_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n# 欢乐玩麻将测试环境调用\n86d0ebab717447ba98:\n  biz-application: \"100033\"\n  pub-key-location: \"/data/payment-centre/security/huanlewanmajiang_test_access_key/huanlewanmajiang_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/huanlewanmajiang_test_access_key/huanlewanmajiang_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"CHECK_VIVO\"\n    - \"CHECK_HUAWEI\"\n    - \"CHECK_OPPO\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n# 星际飞战测试环境调用\nea93d3a6675740b9ac:\n  biz-application: \"100028\"\n  pub-key-location: \"/data/payment-centre/security/xingjifeizhan_test_access_key/xingjifeizhan_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/xingjifeizhan_test_access_key/xingjifeizhan_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n\n\n# 章鱼输入法测试环境调用\n7a29f70239b44f9b96:\n  biz-application: \"ZYSRF\"\n  pub-key-location: \"/data/payment-centre/security/zysrf_test_access_key/zysrf_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/zysrf_test_access_key/zysrf_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n# 全民消糖果测试环境调用\n2d0b1b7c897a495387:\n  biz-application: \"100019\"\n  pub-key-location: \"/data/payment-centre/security/qmxtg_test_access_key/qmxtg_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/qmxtg_test_access_key/qmxtg_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n# 斑马输入法测试环境调用\nc78f3591039347ada2:\n  biz-application: \"100045\"\n  pub-key-location: \"/data/payment-centre/security/bmsrf_test_access_key/bmsrf_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/bmsrf_test_access_key/bmsrf_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n\n# 扫描全能大师测试环境调用\nn04l7w10igcwbvdwxq:\n  biz-application: \"100055\"\n  pub-key-location: \"/data/payment-centre/security/smqnds_test_access_key/smqnds_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/smqnds_test_access_key/smqnds_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n\n\n# 猫咪围棋测试环境调用\niqh493et4ue2gougpb:\n  biz-application: \"100060\"\n  pub-key-location: \"/data/payment-centre/security/qihun_test_access_key/qihun_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/qihun_test_access_key/qihun_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n# GO好货测试环境调用\nm0jttm4i2d15ilt76s:\n  biz-application: \"100061\"\n  pub-key-location: \"/data/payment-centre/security/gohaohuo_test_access_key/gohaohuo_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/gohaohuo_test_access_key/gohaohuo_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n# 照片修复王测试环境调用\ness5b81bhpqfuslsle:\n  biz-application: \"100072\"\n  pub-key-location: \"/data/payment-centre/security/zhaopianxiufuwang_test_access_key/zhaopianxiufuwang_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/zhaopianxiufuwang_test_access_key/zhaopianxiufuwang_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n\n# 全民消糖果（新）测试环境调用\n58euhj5x24gfjwloir:\n  biz-application: \"100054\"\n  pub-key-location: \"/data/payment-centre/security/qmxtg_new_test_access_key/qmxtg_new_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/qmxtg_new_test_access_key/qmxtg_new_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"CHECK_OPPO\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n\n# 蓝山PDF转换器测试环境调用\nsdvzvp8e049yff5bfg:\n  biz-application: \"500004\"\n  pub-key-location: \"/data/payment-centre/security/lspdf_zhq_test_access_key/lspdf_zhq_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/lspdf_zhq_test_access_key/lspdf_zhq_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"CHECK_OPPO\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n\n# 贪吃蛇在线测试环境调用\npck31zbc98aqjdgwuh:\n  biz-application: \"100010\"\n  pub-key-location: \"/data/payment-centre/security/tanchishezaixian_test_access_key/tanchishezaixian_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/tanchishezaixian_test_access_key/tanchishezaixian_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"CHECK_OPPO\"\n    - \"CHECK_VIVO\"\n    - \"CHECK_HUAWEI\"\n    - \"HUAWEI_SUPPLEMENT\"\n    - \"CHECK_YYB\"\n    - \"UPDATE_ORDER\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n# office PDF阅读器测试环境调用\nnm64njxs44v2nuwd7g:\n  biz-application: \"500003\"\n  pub-key-location: \"/data/payment-centre/security/pdfyueduqi_test_access_key/pdfyueduqi_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/pdfyueduqi_test_access_key/pdfyueduqi_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n# office 素材网测试环境调用\n4y4ac5ula7lpx8t7np:\n  biz-application: \"500006\"\n  pub-key-location: \"/data/payment-centre/security/sucaiwang_test_access_key/sucaiwang_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/sucaiwang_test_access_key/sucaiwang_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n# 蓝山office测试环境调用\nnpz889lp8phus48j4i:\n  biz-application: \"500002\"\n  pub-key-location: \"/data/payment-centre/security/lanshanoffice_test_access_key/lanshanoffice_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/lanshanoffice_test_access_key/lanshanoffice_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n# 迷你军团测试环境调用\nqew8fsvl00gaggftjl:\n  biz-application: \"100059\"\n  pub-key-location: \"/data/payment-centre/security/minijuntuan_test_access_key/minijuntuan_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/minijuntuan_test_access_key/minijuntuan_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 证件照研习社 2022-06-23 19:51:09\n1e5f08f2a685d1ac:\n  biz-application: \"100122\"\n  pub-key-location: \"/data/payment-centre/security/zhengjianzhaoyanxishe_test_access_key/zhengjianzhaoyanxishe_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/zhengjianzhaoyanxishe_test_access_key/zhengjianzhaoyanxishe_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 蓝山PDF测试环境调用\nms8tyqr616xsa3e0k4:\n  biz-application: \"100080\"\n  pub-key-location: \"/data/payment-centre/security/lanshanpdf_test_access_key/lanshanpdf_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/lanshanpdf_test_access_key/lanshanpdf_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n# 救援大亨测试环境调用\nrzb6ch9d1kqbqq8dfn:\n  biz-application: \"100081\"\n  pub-key-location: \"/data/payment-centre/security/jiuyuandaheng_test_access_key/jiuyuandaheng_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/jiuyuandaheng_test_access_key/jiuyuandaheng_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n# 欢乐玩斗地主测试环境调用\nh5p2dy6erwk7uaj1kf:\n  biz-application: \"100029\"\n  pub-key-location: \"/data/payment-centre/security/huanlewandoudizhu_test_access_key/huanlewandoudizhu_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/huanlewandoudizhu_test_access_key/huanlewandoudizhu_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n# 抖你测试环境调用\nj87suutkbzlw1ihgu6:\n  biz-application: \"100068\"\n  pub-key-location: \"/data/payment-centre/security/douni_test_access_key/douni_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/douni_test_access_key/douni_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n# 全球街景地图 2021-09-14 17:10:19\nguhxivrdj31dwfgwhr:\n  biz-application: \"100089\"\n  pub-key-location: \"/data/payment-centre/security/qqjjdt_test_access_key/qqjjdt_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/qqjjdt_test_access_key/qqjjdt_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n# 卡卡玩图测试环境调用 2021-10-08 15:14:57\n2sat4z9l6m9otqsr9r:\n  biz-application: \"100063\"\n  pub-key-location: \"/data/payment-centre/security/kakawantu_test_access_key/kakawantu_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/kakawantu_test_access_key/kakawantu_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"UPDATE_ORDER\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"TRADE_REFUND\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n# 嗨映测试环境调用 2021-10-25 15:48:54\nfpq6duybmjro5q735u:\n  biz-application: \"100087\"\n  pub-key-location: \"/data/payment-centre/security/haiying_test_access_key/haiying_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/haiying_test_access_key/haiying_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"UPDATE_ORDER\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"TRADE_REFUND\"\n    - \"ALIPAY_AGREEMENT_MODIFY\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n\n# 养猪内购版测试环境调用 2021-10-27 16:06:48\n2ejbt7loiykdu2mbqf:\n  biz-application: \"100087\"\n  pub-key-location: \"/data/payment-centre/security/yangzhuneigou_test_access_key/yangzhuneigou_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/yangzhuneigou_test_access_key/yangzhuneigou_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"UPDATE_ORDER\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"TRADE_REFUND\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n\n# 图腾测试环境调用 2021-12-15 14:48:59\nafht7xllpvyoqftcbu:\n  biz-application: \"100093\"\n  pub-key-location: \"/data/payment-centre/security/tutengmajiang_test_access_key/tutengmajiang_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/tutengmajiang_test_access_key/tutengmajiang_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"CHECK_VIVO\"\n    - \"CHECK_HUAWEI\"\n    - \"CHECK_OPPO\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n\n# 中国象棋大师测试环境调用 2021-12-17 14:34:32\nkq390jmfmgwrk9xkw6:\n  biz-application: \"300009\"\n  pub-key-location: \"/data/payment-centre/security/zhongguoxiangqidashi_test_access_key/zhongguoxiangqidashi_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/zhongguoxiangqidashi_test_access_key/zhongguoxiangqidashi_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"CHECK_VIVO\"\n    - \"CHECK_HUAWEI\"\n    - \"CHECK_OPPO\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n\n\n# 本地测试环境调用\nkey-demo-foo1:\n  biz-application: \"100001\"\n  pub-key-location: \"/data/payment-centre/security/pub-key/key-demo-foo1.pub\"\n  pri-key-location: \"/data/payment-centre/security/pub-key/key-demo-foo1\"\n  permission:\n    - \"ECHO\"\n    - \"UPDATE_ORDER\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"TRADE_REFUND\"\n    - \"CHECK_MI\"\n    - \"PAYMENT_RATE_CONFIG\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.31.0.4\"\n\n\n# 测试环境ocelot访问\nocelot-test-access-key:\n  pub-key-location: \"/data/payment-centre/security/ocelot_access_key/ocelot_access.pub\"\n  pri-key-location: \"/data/payment-centre/security/ocelot_access_key/ocelot_access\"\n  permission:\n    - \"ECHO\"\n    - \"PAYMENT_RATE_CONFIG\"\n    - \"PAYMENT_RATE_LIST\"\n    - \"PAYMENT_RATE_DEL\"\n    - \"PAYMENT_CHANNEL_GET\"\n    - \"PAYMENT_CONF_ADD\"\n    - \"PAYMENT_CONF_LIST\"\n    - \"PAYMENT_CONF_DOWN_SHELF\"\n    - \"PAYMENT_TRADE_REFUND\"\n    - \"QUERY_SLAVES_INFO\"\n    - \"EDIT_PAYMENT_CONFIG_INFO\"\n\n  allow-ip:\n    - \"10.42.101.241\"\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.31.0.4\"\n    - \"172.31.65.68\"\n    - \"172.31.66.246\"\n\n# 测试环境一号sdk\ndnnkrun3vnzr3xh1ip:\n  pub-key-location: \"/data/payment-centre/security/yihao_test_access_key/yihao_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/yihao_test_access_key/yihao_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"QUERY_PAYMENT_SECRET\"\n    - \"ADD_PAYMENT_SECRET\"\n\n  allow-ip:\n    - \"10.42.101.241\"\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.31.0.4\"\n    - \"172.31.65.68\"\n    - \"172.31.66.246\"\n\n\n\n\n# 测试环境查询支付费率的key\npayment-rate-test-access-key:\n  pub-key-location: \"/data/payment-centre/security/payment_rate_test_access_key/payment_rate_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/payment_rate_test_access_key/payment_rate_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"PAYMENT_RATE_LIST\"\n    - \"PAYMENT_CONF_LIST\"\n    - \"PAYMENT_DATA\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.64.118\"\n    - \"172.31.65.68\"\n\n# 水草 2022-07-07 15:17:30\n0cc7c811eb25554d:\n  biz-application: \"100123\"\n  pub-key-location: \"/data/payment-centre/security/shuicao_test_access_key/shuicao_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/shuicao_test_access_key/shuicao_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 语音输入法 2022-08-01 11:48:30\n0f86c0a4d20092ea:\n  biz-application: \"100127\"\n  pub-key-location: \"/data/payment-centre/security/yuyinshurufa_test_access_key/yuyinshurufa_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/yuyinshurufa_test_access_key/yuyinshurufa_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n  # 我c 2022-08-01 13:53:50\n6a82a5126f9606d8:\n  biz-application: \"100128\"\n  pub-key-location: \"/data/payment-centre/security/woc_test_access_key/woc_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/woc_test_access_key/woc_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n  # 绯石之心 2022-08-04 20:40:30\nc2533d3e7f81ce2c:\n  biz-application: \"100130\"\n  pub-key-location: \"/data/payment-centre/security/feishi_test_access_key/feishi_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/feishi_test_access_key/feishi_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n    - \"CHECK_VIVO\"\n    - \"CHECK_MI\"\n    - \"CHECK_OPPO\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n  # 有声输入法 2022-09-07 14:04:30\n551285bbdc87e89f:\n  biz-application: \"100134\"\n  pub-key-location: \"/data/payment-centre/security/youshengshurufa_test_access_key/youshengshurufa_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/youshengshurufa_test_access_key/youshengshurufa_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 东方输入法2 2022-09-13 15:20:30\n9d880b7e21103a27:\n  biz-application: \"100133\"\n  pub-key-location: \"/data/payment-centre/security/dongfangshurufa2_test_access_key/dongfangshurufa2_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/dongfangshurufa2_test_access_key/dongfangshurufa2_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n    - \"TOKEN_PAY\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n\n# 影秀相机 2022-09-16 11:21:30\n7d0b0e5095787ab1:\n  biz-application: \"100135\"\n  pub-key-location: \"/data/payment-centre/security/yingxiuxiangji_test_access_key/yingxiuxiangji_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/yingxiuxiangji_test_access_key/yingxiuxiangji_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 木鱼  2022-10-11 13:40:30\n690bee04d0f3ea93:\n  biz-application: \"100136\"\n  pub-key-location: \"/data/payment-centre/security/muyu_test_access_key/muyu_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/muyu_test_access_key/muyu_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 乐映  2022-11-08 23:56:57\n654093af8f74435a:\n  biz-application: \"100141\"\n  pub-key-location: \"/data/payment-centre/security/leying_test_access_key/leying_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/leying_test_access_key/leying_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n    - \"CHECK_HUAWEI\"\n    - \"HUAWEI_SUPPLEMENT\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# ta星球  2022-11-17 15:43:20\n1ffffb01f16a85cc:\n  biz-application: \"100139\"\n  pub-key-location: \"/data/payment-centre/security/taxingqiu_test_access_key/taxingqiu_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/taxingqiu_test_access_key/taxingqiu_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 记账喵  2022-12-01 11:31:20\n9d7a4cbc935e8657:\n  biz-application: \"100138\"\n  pub-key-location: \"/data/payment-centre/security/jizhangmiao_test_access_key/jizhangmiao_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/jizhangmiao_test_access_key/jizhangmiao_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n\n# 轻拍  2022-12-01 11:34:20\n735f969e40db3343:\n  biz-application: \"100142\"\n  pub-key-location: \"/data/payment-centre/security/qingpai_test_access_key/qingpai_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/qingpai_test_access_key/qingpai_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n\n# 蓝山压缩  2023-01-06 16:04:20\nabca1303daacdc26:\n  biz-application: \"100143\"\n  pub-key-location: \"/data/payment-centre/security/lanshanyasuo_test_access_key/lanshanyasuo_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/lanshanyasuo_test_access_key/lanshanyasuo_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n\n# 迷你军团  2023-02-15 15:31:20\n2cdced77687fd970:\n  biz-application: \"100158\"\n  pub-key-location: \"/data/payment-centre/security/minijuntuan_test_access_key/minijuntuan_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/minijuntuan_test_access_key/minijuntuan_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 趣味刷刷  2023-02-28 15:31:45\n364218d54a868eca:\n  biz-application: \"100150\"\n  pub-key-location: \"/data/payment-centre/security/quweishuashua_test_access_key/quweishuashua_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/quweishuashua_test_access_key/quweishuashua_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 小鲜念珠  2023-03-01 14:47:45\n9a10d45c22ccc578:\n  biz-application: \"100148\"\n  pub-key-location: \"/data/payment-centre/security/xiaoqiannianzhu_test_access_key/xiaoxiannianzhu_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/xiaoqiannianzhu_test_access_key/xiaoxiannianzhu_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 喔喔开黑  2023-03-02 15:21:14\n81005e2afb6901a9:\n  biz-application: \"100145\"\n  pub-key-location: \"/data/payment-centre/security/wowokaihei_test_access_key/wowokaihei_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/wowokaihei_test_access_key/wowokaihei_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 我的小组件  2023-03-17 11:21:14\n4e0c539739145477:\n  biz-application: \"100116\"\n  pub-key-location: \"/data/payment-centre/security/wdxzj_test_access_key/wdxzj_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/wdxzj_test_access_key/wdxzj_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n\n# 轻拍 2023-03-29 13:48:14\nc5f707c942b73ad9:\n  biz-application: \"100152\"\n  pub-key-location: \"/data/payment-centre/security/qingpai2_test_access_key/qingpai_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/qingpai2_test_access_key/qingpai_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 彩映 2023-03-29 18:19:14\n6e46c432e1712b16:\n  biz-application: \"100154\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 听说输入法 2023-03-29 18:22:14\ncd03a72983897176:\n  biz-application: \"100153\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 语音打字法 2023-04-10 14:19:42\nef6d98a66bc24498:\n  biz-application: \"100156\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 好玩相机 2023-05-04 17:29:47\n2931df11e5141d2b:\n  biz-application: \"100157\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 河马输入法 2023-06-02 11:36:56\n9589823fdcd3523b:\n  biz-application: \"100159\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 迷你军团硬核渠道 2023-06-25 17:51:26\n02c8d3ae21ba3c37:\n  biz-application: \"100160\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 恋爱输入法 2023-07-19 10:51:26\nrPvQ13PHM86S7HA2:\n  biz-application: \"100163\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 翻译专家 2023-07-28 04:55:13\nb9b8fcf3fc1612b9:\n  biz-application: \"100164\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 多多追剧 2023-08-01 15:45:42\ndf4bf3483afcc791:\n  biz-application: \"100161\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 语音键盘 2023-08-14 11:29:35\n14280167d7be2b5c:\n  biz-application: \"100168\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n# 花开相机 2023-08-30 22:37:50\ndac1c33ddecf7262:\n  biz-application: \"100172\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 每日好剧 2023-10-17 11:38:53\nb3509ad675b90b84:\n  biz-application: \"100177\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 密语键盘 2023-10-30 17:14:31\n7faff15be7fd1673:\n  biz-application: \"100181\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 听声输入法 2023-11-23 11:39:03\nc52d50b3d044f5ab:\n  biz-application: \"100185\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n\n# 刺客传说游戏服：抖音小游戏、微信小游戏支付\nckcs-100024-access-key:\n  pub-key-location: \"/data/payment-centre/security/100024_service_kungfu/100024_service_kungfu.pub\"\n  pri-key-location: \"/data/payment-centre/security/100024_service_kungfu/100024_service_kungfu\"\n  permission:\n    - \"DY_VIRTUAL_PAY\"\n    - \"DY_VIRTUAL_PRESENTED\"\n    - \"DY_BALANCE\"\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"172.31.0.4\"\n    - \"172.31.66.246\"\n    - \"172.31.68.144\"\n    - \"172.31.86.29\"\n\n# 情话专家 2024-01-04 16:12:06\na739c1888d908c45:\n  biz-application: \"100186\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n# 追剧多多 2024-04-16 17:56:31\n733f21e1080232bf:\n  biz-application: \"100193\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n# 章鱼输入法 2024-06-12 13:58:54\n33c87199b8a3bdfe:\n  biz-application: \"200001\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\"\n# 贪吃蛇小游戏 2024-06-12 16:42:53\nde0bed608a33fb9d:\n  biz-application: \"100189\"\n  pub-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key.pub\"\n  pri-key-location: \"/data/payment-centre/security/common_test_access_key/common_test_access_key\"\n  permission:\n    - \"ECHO\"\n    - \"TRADE_REFUND\"\n    - \"TRADE_CLOSE\"\n    - \"UNIFIED_ORDER\"\n    - \"TRADE_QUERY\"\n    - \"UPDATE_ORDER\"\n    - \"PAYMENT_UNSIGN\"\n  allow-ip:\n    - \"127.0.0.1\"\n    - \"0:0:0:0:0:0:0:1\"\n    - \"172.21.5.18\"\n    - \"172.18.0.84\"\n    - \"172.31.0.4\"\n    - \"172.31.64.198\"\n    - \"172.31.65.68\""}"#).unwrap();
        println!("{}", set_data_result);

        let get_data_result = dispatch_zk_cmd(
            "get_data",
            r#"{"path":"/PaymentCentre/security/access-key-strategy.yaml"}"#,
        ).unwrap();
        println!("{}", get_data_result);

        // let delete_result = dispatch_zk_cmd("delete_node", r#"{"path":"/zk_test","recursion":true}"#).unwrap();
        // println!("{}", delete_result);
        //
        // let get_data_result = dispatch_zk_cmd("get_data", r#"{"path":"/zk_test"}"#).unwrap();
        // println!("{}", get_data_result);
    }
}
