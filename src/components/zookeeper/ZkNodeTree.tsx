import {Col, Collapse, Empty, Input, Row, Select} from 'antd';
import type {DataNode} from 'antd/es/tree';
import React, {Key, useEffect, useMemo, useState} from "react";
import "./ZkNodeTree.less"
import {FileJpgOutlined} from "@ant-design/icons";
import DirectoryTree from 'antd/es/tree/DirectoryTree';
import {rust_invoke, zk_invoke} from '../../utils/RustIteractor';
import RedisKey from "./ZkNode";
import SystemProperties, {SysProp} from "../../utils/SystemProperties.ts";
import FavoriteTree from "../favorite/FavoriteTree.tsx";
import {useTranslation} from "react-i18next";
import FIELD_SYS_REDIS_SEPARATOR = SysProp.FIELD_SYS_REDIS_SEPARATOR;

const {Panel} = Collapse;
const {Search} = Input;

const MAX_PRELOAD_KEY_SIZE = 5;

export type CustomDataNode = DataNode & {
    keyType?: string,
    isLeaf?: boolean,
    total: number,
    nodeInfo: NodeInfo
};
const datasources = ['localhost', '172.31.65.68'];

const databaseMap = {
    "localhost": ['DB0', 'db1', 'db2', 'db3', 'db4', 'db5', 'db6'],
    "172.31.65.68": ['DB0', 'db1', 'db2', 'db3', 'db4'],
    "asd": ['db0', 'db1', 'db2', 'db3', 'db4'],
    "ccc": ['db0', 'db1', 'db2', 'db3', 'db4'],
};

interface KeyTreeProp {
    datasourceId: string
    parentHeight?: number
    onSelect?: (selectedKeys: Key[], info: any) => void;
    onCmdOpen?: React.MouseEventHandler<HTMLDivElement>
}

interface ScanItem {
    key: string | number,
    keyType: string,
}

interface TreeDataParseContext {
    lv0LeafIndex: number,
    cacheData: Map<String, CustomDataNode>,
    keyTotal: number
}

//用于取消监听
let unlisten: any = null;
let receiveDataQueue: ScanItem[] = [];
let cleaned = false;

interface NodeInfo {
    node: string,
    parent: string,
    path: string,
    children: NodeInfo[],
    unknown_children: boolean,
    stat: NodeStat,
}

export interface NodeStat {
    /// The transaction ID that created the znode.
    czxid: number,
    /// The last transaction that modified the znode.
    mzxid: number,
    /// Milliseconds since epoch when the znode was created.
    ctime: number,
    /// Milliseconds since epoch when the znode was last modified.
    mtime: number,
    /// The number of changes to the data of the znode.
    version: number,
    /// The number of changes to the children of the znode.
    cversion: number,
    /// The number of changes to the ACL of the znode.
    aversion: number,
    /// The session ID of the owner of this znode, if it is an ephemeral entry.
    ephemeral_owner: number,
    /// The length of the data field of the znode.
    data_length: number,
    /// The number of children this znode has.
    num_children: number,
    /// The transaction ID that last modified the children of the znode.
    pzxid: number,
}

interface NodeInfoResp {
    success: boolean;
    data: NodeInfo[];
}

const ZkNodeTree: React.FC<KeyTreeProp> = (props, context) => {

    const {t} = useTranslation();
    const [searchValue, setSearchValue] = useState('');
    // @ts-ignore
    const [databases, setDatabases] = useState([]);
    const [selectedDBIndex, setSelectedDBIndex] = useState(0);
    const [dataSources, setDataSources] = useState([]);
    let set = new Set<string>();
    const [deletedKeys, setDeletedKeys] = useState<Set<string>>(set);
    const [databasePopupMatchSelectWidth, setDatabasePopupMatchSelectWidth] = useState(140);

    const calParentHeight = () => (window.innerHeight
        || document.documentElement.clientHeight
        || document.body.clientHeight) - 180;
    const [comHeight, setComHeight] = useState(calParentHeight());

    useEffect(() => {
        const handleResize = () => {
            const newHeight = calParentHeight();
            setComHeight(newHeight);
        }
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
        }
    }, []);
    const [treeData, setTreeData] = useState<CustomDataNode[]>([]);
    const [scannedKeyCount, setScannedKeyCount] = useState(0);
    let redisSeparator = SystemProperties.value(FIELD_SYS_REDIS_SEPARATOR);
    if (!redisSeparator) {
        console.error('无法获取redisSeparator分隔符');
        redisSeparator = ':';
    }
    const [splitSymbol, setSplitSymbol] = useState(redisSeparator);

    let cachedTreeData: CustomDataNode[] = [...treeData];
    let refreshTimer: any = undefined;
    let treeDataContext = useMemo((): TreeDataParseContext => {
        return {
            lv0LeafIndex: 0,
            cacheData: new Map<string, CustomDataNode>,
            keyTotal: 0
        }
    }, []);

    const cleanTreeData = () => {
        cleaned = true;
        cachedTreeData.length = 0;
        cachedTreeData = [];
        setTreeData(cachedTreeData);
        receiveDataQueue = [];
        treeDataContext.lv0LeafIndex = 0;
        treeDataContext.keyTotal = 0;
        treeDataContext.cacheData = new Map<string, CustomDataNode>;
        setScannedKeyCount(0);
        setDeletedKeys(new Set<string>);
    }

    useEffect(() => {
        if (unlisten != null) {
            unlisten.then((ok: any) => {
                ok();
                unlisten = null;
            }).catch((err: any) => {
                console.log("组件销毁，取消监听发生异常");
            });
        }
        if (unlisten == null) {
            rust_invoke("redis_list_datasource", {
                datasource_id: 'datasource01'
            }).then(r => {
                if (typeof r === "string") {
                    const result = JSON.parse(r)
                    setDataSources(result.map((item: any) => item.name));
                    // 重新加载当前的数据源id
                    handleDataSourceChanged(props.datasourceId);
                }
            });
        }
        return () => {
            console.log("组件销毁");
            cleanTreeData();
        }
    }, []);

    const handleDataSourceChanged = (datasourceId: string) => {
        cleanTreeData();
        zk_invoke('list_children', {path: '/', depth: 0}).then(ret => {
            const resp: NodeInfoResp = JSON.parse(ret as string)
            setTreeData(resp.data.map(t => {
                t.path = t.parent + t.node;
                let node: any = {
                    isLeaf: t.stat.num_children === 0,
                    total: t.stat.num_children,
                    key: t.node,
                    title: t.node,
                    nodeInfo: t
                };
                treeDataContext.cacheData.set(t.path, node);
                return node;
            }));
        });
    };

    const onDatabaseSelected = (value: number) => {
        setSelectedDBIndex(value);
    };

    const onTitleRender = (data: CustomDataNode): React.ReactNode => {
        if (typeof data.title == 'string') {
            if (data.isLeaf) {
                return <RedisKey node={data}/>
            } else {
                return <>
                    <div className={'zookeeper-directory'}>
                        <span className={'zookeeper-directory-key-title'}>{data.title}</span>
                        <span className={'zookeeper-directory-key-counter'}>{data.total}</span>
                    </div>
                </>
            }
        }
        // @ts-ignore
        return data.title;
    }

    const onExpand = (expandedKeys: Key[], info: {
        node: any;
        expanded: boolean;
        nativeEvent: MouseEvent;
    }) => {
        if (info.expanded) {
            const expandedPath = info.node.nodeInfo.path;
            console.log('展开子节点：', info.node);

            zk_invoke('list_children', {path: expandedPath, depth: 0}).then(ret => {
                const resp: NodeInfoResp = JSON.parse(ret as string)
                console.log('zookeeper 响应2：', resp, info.node);
                let target = treeDataContext.cacheData.get(expandedPath)!;
                target.children = [];
                target.children = resp.data.map(t => {
                    t.path = t.parent + '/' + t.node;
                    let node: any = {
                        isLeaf: t.stat.num_children === 0,
                        total: t.stat.num_children,
                        key: t.path,
                        title: t.node,
                        nodeInfo: t
                    };
                    treeDataContext.cacheData.set(t.path, node);
                    return node;
                });
                setTreeData(cachedTreeData);
            })
        }
    };

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const {value} = e.target;
        setSearchValue(value);
    };

    const onSearch = (val: string, e: any) => {
        onSearchPressEnter(e);
    };

    const onSearchPressEnter = (e: any) => {
        let finalSearchVal = searchValue;
        if (searchValue.length == 0) {
            finalSearchVal = "*";
        } else if (!searchValue.endsWith("!") && !searchValue.endsWith("*")) {
            finalSearchVal += "*";
        }
        setSearchValue(finalSearchVal);
        cleanTreeData();
    };

    let treeDataDom;
    if (treeData) {
        treeDataDom = (<>
            <DirectoryTree
                multiple
                defaultExpandAll={false}
                // switcherIcon={<DownOutlined/>}
                showLine={true}
                showIcon={false}
                onExpand={onExpand}
                treeData={treeData}
                checkable={false}
                height={comHeight}
                onSelect={props.onSelect}
                titleRender={onTitleRender}
                style={{
                    background: "#2B2D30",
                    height: "calc(100vh-32px)",
                    color: "rgb(223,225,228)"
                }}
            />
        </>);
    } else {
        treeDataDom = (<Empty
            image="https://gw.alipayobjects.com/zos/antfincdn/ZHrcdLPrvN/empty.svg"
            imageStyle={{
                height: 60,
                marginTop: "calc(26vh)"
            }}
            description={
                <span>
                    无数据源配置: <a href="#API">创建</a>
                </span>
            }
        >
        </Empty>)
    }

    // @ts-ignore
    return (
        <div className='zookeeper-key-tree-panel'>
            {/* key 检索输入 */}
            <div className={'datasource-tree-panel-search'}>
                <Search value={searchValue}
                        placeholder={t('redis.key_tree.search.placeholder')}
                        onChange={onChange}
                        onSearch={onSearch}
                        onPressEnter={onSearchPressEnter}
                        size='small'
                        autoCapitalize={'none'}
                        autoCorrect={'off'}/>
            </div>

            {/* 命令脚本支持 */}
            <div className={'command-query'} onClick={props.onCmdOpen}>
                <FileJpgOutlined style={{width: 16}}/> {t('redis.key_tree.command_script.name')}
            </div>

            {/* 收藏的树信息 */}
            <Collapse defaultActiveKey={['2']} ghost accordion={true}
                      className={'core-zookeeper-keys-tree'}
                      items={[{
                          key: '1',
                          label: t('redis.key_tree.sub_tree.favor_count', {'count': 17}),
                          children: <><FavoriteTree/></>
                      },
                          {
                              key: '2',
                              label: t('redis.key_tree.sub_tree.keys_count', {'keyCount': scannedKeyCount}),
                              children: treeDataDom
                          }
                      ]}/>

            {/* 数据源快速切换器 */}
            <div className={'datasource-selector'}>
                <Row>
                    <Col span={12}>
                        <Select
                            className={'datasource-selector-class'}
                            popupClassName={'datasource-selector-popup'}
                            style={{width: 120}}
                            defaultValue={props.datasourceId}
                            onChange={handleDataSourceChanged}
                            options={dataSources.map((province) => ({label: province, value: province}))}
                            size={"small"}
                            bordered={false}
                        />
                    </Col>
                    <Col span={12}>
                        <Select
                            className={'datasource-selector-class'}
                            popupClassName={'datasource-selector-popup'}
                            value={selectedDBIndex}
                            onChange={onDatabaseSelected}
                            options={databases}
                            size={"small"}
                            popupMatchSelectWidth={databasePopupMatchSelectWidth}
                            bordered={false}
                        />
                    </Col>
                </Row>
            </div>
        </div>
    );
}

export default ZkNodeTree;
