/* eslint-disable */
import {Button, Collapse, Divider, Empty, Flex, Input, Space} from 'antd';
import type {DataNode, EventDataNode} from 'antd/es/tree';
import React, {Key, useEffect, useMemo, useRef, useState} from "react";
import "./RedisKeyTree.less";
import "../menu/Menu.less";
import {
    AreaChartOutlined,
    KeyOutlined,
    LoadingOutlined,
    PlusOutlined,
    SearchOutlined,
    StarOutlined,
    TableOutlined
} from "@ant-design/icons";
import DirectoryTree from 'antd/es/tree/DirectoryTree';
import {redis_invoke} from '../../utils/RustIteractor';
import RedisKey from "./RedisKey";
import {SysProp} from "../../utils/SystemProperties.ts";
import FavoriteTree from "../favorite/FavoriteTree.tsx";
import {useTranslation} from "react-i18next";
import ConsoleIcon from "../icons/ConsoleIcon.tsx";
import {invoke} from "@tauri-apps/api/core";
import {humanNumber} from "../../utils/Util.ts";
import {SysManager} from "../../utils/SysManager.ts";
import {useEvent} from "../../utils/TauriUtil.tsx";
import DataView from "./dataview/DataView.tsx";
import FIELD_SYS_REDIS_SEPARATOR = SysProp.FIELD_SYS_REDIS_SEPARATOR;

const {Search} = Input;

const MAX_PRELOAD_KEY_SIZE = 25;

export type CustomDataNode = DataNode & {
    keyType?: string,
    isLeaf?: boolean,
    total: number
};

interface KeyTreeProp {
    windowId: number;
    datasourceId: string;
    selectedDatabase: number;
    parentHeight?: number;
    onSelect?: (selectedKeys: Key[], info: any) => void;
    onCmdOpen?: React.MouseEventHandler<HTMLDivElement>;
    onAnalysisOpen?: React.MouseEventHandler<HTMLDivElement>;
}

interface ScanItem {
    key: string | number,
    keyType?: string,
}

interface TreeDataParseContext {
    lv0LeafIndex: Map<number, number>,
    parentMapping: Map<string, CustomDataNode>,
    keyTotal: number
}

//用于取消监听
let receiveDataQueue: ScanItem[] = [];
let cleaned = false;

const RedisKeyTree: React.FC<KeyTreeProp> = (props, context) => {

    const {t} = useTranslation();
    const [datasource, setDatasource] = useState(props.datasourceId);
    const [database, setDatabase] = useState(props.selectedDatabase);

    const datasourceRef = useRef(props.datasourceId);
    const databaseRef = useRef(props.selectedDatabase);
    const [searchValue, setSearchValue] = useState('*');
    const cursor = useRef(0);
    const [pageSize, setPageSize] = useState(500);
    const [scanCount, setScanCount] = useState(500);
    const [noMoreData, setNoMoreData] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [version, setVersion] = useState('unknown');
    const [memoryUsage, setMemoryUsage] = useState('-');
    const [dbsize, setDbsize] = useState('0');
    const set = new Set<string>();
    const [deletedKeys, setDeletedKeys] = useState<Set<string>>(set);
    const [treeUniqueId, setTreeUniqueId] = useState(Date.now());
    const [treeData, setTreeData] = useState<CustomDataNode[] | DataNode[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<Key[]>();
    const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
    const [activeKey, setActiveKey] = useState<string[]>(['tab-data-view']);
    const selectedKeysRef = useRef(selectedKeys);
    const treeDataRef = useRef(treeData);
    const exactlySearch = useRef(true);
    const searchValueRef = useRef('');
    const scanTaskIdRef = useRef<number | undefined>();

    const calParentHeight = () => (window.innerHeight
        || document.documentElement.clientHeight
        || document.body.clientHeight) - 210;
    const [comHeight, setComHeight] = useState(calParentHeight());

    const [scannedKeyCount, setScannedKeyCount] = useState(0);
    let redisSeparator = SysManager.value(FIELD_SYS_REDIS_SEPARATOR, ':');
    if (!redisSeparator) {
        console.error('无法获取redisSeparator分隔符');
        redisSeparator = ':';
    }
    const [splitSymbol, setSplitSymbol] = useState(redisSeparator);

    let cachedTreeData: CustomDataNode[] | DataNode[] = [...treeData];
    let refreshTimer: any = undefined;
    const treeDataContext = useMemo((): TreeDataParseContext => {
        return {
            lv0LeafIndex: new Map<number, number>(),
            parentMapping: new Map<string, CustomDataNode>,
            keyTotal: 0
        }
    }, []);

    const cleanTreeData = () => {
        cleaned = true;
        cachedTreeData.length = 0;
        cachedTreeData = [];
        setTreeData(cachedTreeData);
        receiveDataQueue = [];
        treeDataContext.lv0LeafIndex = new Map<number, number>();
        treeDataContext.keyTotal = 0;
        treeDataContext.parentMapping = new Map<string, CustomDataNode>;
        setScannedKeyCount(0);
        setDeletedKeys(new Set<string>);
        setExpandedKeys([]);
    }

    const packageDataNode = (data: CustomDataNode[] | any, array: string[], item: ScanItem, prePath: string, lv: number, context: TreeDataParseContext): number => {
        if (array.length == 0) {
            return 0;
        }
        const currentNodeTitle = array[0];
        const currPath = prePath.length > 0 ? prePath + splitSymbol + currentNodeTitle : array[0];
        if (array.length == 1) {
            if (data.filter((d: any) => d.key === currPath).length == 0) {
                // 叶子节点
                const node: CustomDataNode = {
                    title: currentNodeTitle,
                    key: currPath,
                    isLeaf: true,
                    total: 1,
                    keyType: item.keyType
                };
                if (lv == 0 && !node.keyType) {
                    redis_invoke("redis_key_type", {
                        keys: [node.key]
                    }, datasourceRef.current, databaseRef.current).then(ret => {
                        const obj = JSON.parse(ret as string);
                        node.keyType = obj.types[node.key as string];
                    });
                }
                const lv0LeafIdx = context.lv0LeafIndex.get(lv) ?? 0;
                context.lv0LeafIndex.set(lv, lv0LeafIdx - 1);
                data.push(node);
            }
            return 1;
        } else {
            const existsNodes = context.parentMapping.get(`${currPath}\u0001`);
            if (existsNodes != undefined) {
                const cnt = packageDataNode(existsNodes.children, array.slice(1), item, currPath, lv + 1, context);
                existsNodes.total += cnt;
                return cnt;
            } else {
                const children: CustomDataNode[] = [];
                const parent: CustomDataNode = {
                    title: currentNodeTitle,
                    key: `${currPath}\u0001`,
                    isLeaf: false,
                    children: children,
                    total: 0
                };
                context.parentMapping.set(`${currPath}\u0001`, parent);
                const cnt = packageDataNode(children, array.slice(1), item, currPath, lv + 1, context);
                parent.total += cnt;
                const leafIdx = context.lv0LeafIndex.get(lv) ?? 0;
                data.splice(data.length + leafIdx, 0, parent);
                return cnt;
            }
        }
    };

    // 递归删除指定 key 的节点
    const deleteNodeByKey = (key: string, data: CustomDataNode[] | DataNode[]) => {
        return data.map(node => {
            if (node.children) {
                node.children = deleteNodeByKey(key, node.children);
                // @ts-ignore
                node.total = node.children.reduce((acc, item) => acc + item.total, 0);
            }
            return node;
        }).filter(node => {
            // @ts-ignore
            return node.total > 0 && node.key !== key
        });
    };

    const findKey = (keyNames: string[], tree: CustomDataNode[] | DataNode[]): CustomDataNode | DataNode | undefined => {
        const currNodePath = keyNames[0];
        for (const node of tree) {
            if (node.title === currNodePath) {
                if (node.children) {
                    return findKey(keyNames.slice(1), node.children);
                } else {
                    return node;
                }
            }
        }
        return undefined;
    };

    useEffect(() => {
        const handleResize = () => {
            const newHeight = calParentHeight();
            setComHeight(newHeight);
        }
        window.addEventListener("resize", handleResize);
        cleanTreeData();
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);
    useEffect(() => {
        treeDataRef.current = treeData
    }, [treeData]);
    useEffect(() => {
        selectedKeysRef.current = selectedKeys;
    }, [selectedKeys]);
    useEffect(() => {
        let finalSearchVal = searchValue;
        if (searchValue.length == 0) {
            finalSearchVal = "*";
        } else if (!searchValue.endsWith("!") && !searchValue.endsWith("*")) {
            finalSearchVal += "*";
        }
        searchValueRef.current = finalSearchVal;
    }, [searchValue]);
    useEffect(() => {
        setDatasource(props.datasourceId);
        setDatabase(props.selectedDatabase);

        datasourceRef.current = props.datasourceId;
        databaseRef.current = props.selectedDatabase;

        if (scanTaskIdRef.current) {
            console.warn(`last scan mission not finished: ${scanTaskIdRef.current}`);
        } else {
            handleDataSourceChanged();
        }
        return () => {
        };
    }, [props.datasourceId, props.selectedDatabase]);

    useEvent('redis_scan_event', (event) => {
        const payload: any = event.payload;
        if (payload.keys) {
            payload.keys.forEach((key: any) => {
                receiveDataQueue.push({
                    key: key
                });
            })
            const copy = cleaned ? [] : [...cachedTreeData];
            if (cleaned) {
                cleaned = false;

                treeDataContext.parentMapping.clear();
            }
            let dataItem: ScanItem | undefined;
            // eslint-disable-next-line no-cond-assign
            while (dataItem = receiveDataQueue.shift()) {
                if (dataItem) {
                    const array = (dataItem.key as string).split(splitSymbol);
                    treeDataContext.keyTotal += packageDataNode(copy, array, dataItem, '', 0, treeDataContext);
                }
            }

            setTreeData(copy);
            cachedTreeData = copy;
            clearInterval(refreshTimer);
            setScannedKeyCount(treeDataContext.keyTotal);
            refreshTimer = null;
        }
        cursor.current = payload.cursor;
        if (payload.cursor == 0 && !payload.exactly_key) {
            setNoMoreData(true);
        }
        if (payload.finished) {
            setScanning(false);
            scanTaskIdRef.current = undefined;

            if (payload.exactly_key) {
                setExpandedKeys([payload.keys[0]]);
            }
        }
    });
    useEvent('key-tree/delete', (event) => {
        const payload: any = event.payload;
        const key: string = payload.key;
        const success: boolean = payload.success;
        if (success) {
            const afterTree = deleteNodeByKey(key, treeDataRef.current);
            cachedTreeData = afterTree;
            console.log('after Tree', afterTree)
            setTreeData(afterTree);
            // @ts-ignore
            const total = afterTree.reduce((acc, item) => acc + item.total, 0);
            setScannedKeyCount(total);
        }
    });
    useEvent('key-tree/new-key', (event) => {
        // @ts-ignore
        const newKeyName = event.payload!.key;
        console.log("新增key", event.payload);
        receiveDataQueue.push({
            key: newKeyName,
            // @ts-ignore
            keyType: event.payload!.keyType,
        });
        const afterTree = cleaned ? [] : [...cachedTreeData];
        if (cleaned) {
            cleaned = false;
            treeDataContext.parentMapping.clear();
        }
        let dataItem: ScanItem | undefined;
        // eslint-disable-next-line no-cond-assign
        while (dataItem = receiveDataQueue.shift()) {
            if (dataItem) {
                const array = (dataItem.key as string).split(splitSymbol);
                treeDataContext.keyTotal += packageDataNode(afterTree, array, dataItem, '', 0, treeDataContext);
            }
        }

        setTreeData(afterTree);
        cachedTreeData = afterTree;
        clearInterval(refreshTimer);
        setScannedKeyCount(treeDataContext.keyTotal);
        setSelectedKeys([newKeyName]);

        const keySplits = (newKeyName as string).split(splitSymbol);
        const nodeInfo = findKey(keySplits, afterTree);
        props.onSelect?.([newKeyName], {node: nodeInfo});
    });
    useEvent('datasource/info', (event) => {
        const payload: any = event.payload;
        if (payload.datasource === datasourceRef.current) {
            setMemoryUsage(payload.info.memory.used_memory_human);
            let sum = 0;
            for (const keyspace of payload.info.keyspace) {
                sum += keyspace.keys;
            }
            setDbsize(humanNumber(sum));
        }
    });

    const handleDataSourceChanged = () => {
        scanTaskIdRef.current = Date.now();
        cleanTreeData();
        setTreeUniqueId(Date.now());
        redis_invoke("redis_get_database_info", {}, datasourceRef.current, databaseRef.current).then(r => {
            if (typeof r === "string") {
                const result = JSON.parse(r);
                setVersion(result.redis_version);
                setMemoryUsage(result.used_memory_human);

                let sum = 0;
                for (const keyspace of result.key_space_info) {
                    sum += keyspace.keys;
                }
                setDbsize(humanNumber(sum));
                setScanning(true);
                redis_invoke("redis_key_scan", {
                    taskId: scanTaskIdRef.current,
                    pattern: searchValueRef.current ? searchValueRef.current : "*",
                    page_size: pageSize,
                    cursor: cursor.current,
                    count: scanCount,
                    force_scan: true
                }, datasourceRef.current, databaseRef.current).finally()
            }
        });
    };

    const onTitleRender = (data: CustomDataNode): React.ReactNode => {
        if (typeof data.title == 'string') {
            if (data.isLeaf) {
                return <RedisKey node={data}
                                 datasourceId={datasourceRef.current}
                                 selectedDatabase={databaseRef.current}/>
            } else {
                return <>
                    <div className={'redis-directory'}>
                        <Flex justify={"start"} align={"center"} gap={4}>
                            <span className={'redis-directory-key-title'}>{data.title}</span>
                            <span className={'redis-directory-key-counter'}>{data.total}</span>
                        </Flex>
                    </div>
                </>
            }
        }
        return <>${data.title}</>;
    }

    const onExpand = async (expandedKeys: Key[], info: {
        node: any;
        expanded: boolean;
        nativeEvent: MouseEvent;
    }) => {
        setExpandedKeys(expandedKeys);
        const fetchKeyTypeList = info.node.children.slice(0, Math.min(info.node.children.length, MAX_PRELOAD_KEY_SIZE));
        const keys = [];
        for (const child of fetchKeyTypeList) {
            if (child.isLeaf && !child.keyType) {
                keys.push(child.key);
                child.keyType = 'unknown';
            }
        }
        if (keys.length > 0) {
            redis_invoke("redis_key_type", {
                keys: keys
            }, datasourceRef.current, databaseRef.current).then(r => {
                const resp = JSON.parse(r as string);
                const types = resp.types;
                for (const child of fetchKeyTypeList) {
                    if (child.isLeaf) {
                        child.keyType = types[child.key];
                    }
                }
            });
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
        setActiveKey(['tab-keys']);
        setScanning(true);
        cursor.current = 0;
        setNoMoreData(false);
        cleanTreeData();
        setTreeUniqueId(Date.now());
        selectedKeysRef.current = [];
        setSelectedKeys([]);
        redis_invoke("redis_key_scan", {
            pattern: searchValueRef.current,
            page_size: pageSize,
            cursor: cursor.current,
            count: scanCount,
            force_scan: false
        }, datasourceRef.current, databaseRef.current).finally();
    };

    let treeDataDom;
    const onScanMore = () => {
        if (scanning) {
            setScanning(false);
        } else {
            setScanning(true);
            redis_invoke("redis_key_scan", {
                pattern: searchValueRef.current ? searchValueRef.current : "*",
                page_size: pageSize,
                cursor: cursor.current,
                count: scanCount,
                force_scan: true
            }, datasourceRef.current, databaseRef.current).finally();
        }
    };

    const collectAllLeaf = (keys: Key[], leaves: Key[]) => {
        for (const key of keys) {
            const parents = treeDataContext.parentMapping.get(key as string);
            if (parents) {
                if (parents.children) {
                    for (const child of parents.children) {
                        if (child.isLeaf) {
                            if (leaves.indexOf(child.key) < 0) {
                                leaves.push(child.key);
                            }
                        } else {
                            collectAllLeaf([child.key], leaves)
                        }
                    }
                } else {
                    if (parents.isLeaf) {
                        if (leaves.indexOf(parents.key) < 0) {
                            leaves.push(parents.key);
                        }
                    }
                }
            } else {
                if (leaves.indexOf(key) < 0) {
                    leaves.push(key);
                }
            }
        }
    };

    const onKeyTreeRightClick = (info: {
        event: React.MouseEvent;
        node: EventDataNode<CustomDataNode>;
    }) => {
        let leaves: Key[] | null | undefined = [];
        let currentSelected = selectedKeysRef.current ?? [];
        collectAllLeaf(currentSelected, leaves);
        const notDirSelected = !info.node.isLeaf && leaves.length > 0;
        const containSelectedTarget = currentSelected.indexOf(info.node.key) >= 0 && leaves.indexOf(info.node.key) >= 0;

        let key: Key | undefined;
        if (notDirSelected || containSelectedTarget) {
            key = info.node.isLeaf ? info.node.key : (selectedKeysRef.current ? selectedKeysRef.current[0] : undefined);
            leaves = leaves.length == 1 ? undefined : leaves;
        } else {
            leaves = [];
            setSelectedKeys([info.node.key]);
            collectAllLeaf([info.node.key], leaves);
            key = info.node.isLeaf ? info.node.key : undefined;
            leaves = leaves.length == 1 ? undefined : leaves;
        }
        invoke("show_key_tree_right_menu", {
            datasource: datasourceRef.current,
            database: databaseRef.current,
            key: leaves?.length! > 1 ? null : key,
            keys: leaves
        }).finally();
    }

    if (treeData) {
        treeDataDom = (<>
            <DirectoryTree
                multiple
                key={treeUniqueId}
                defaultExpandAll={false}
                // switcherIcon={<DownOutlined/>}
                showLine={false}
                showIcon={false}
                onExpand={onExpand}
                treeData={treeData as CustomDataNode[]}
                checkable={false}
                height={comHeight}
                selectedKeys={selectedKeys}
                expandedKeys={expandedKeys}
                autoExpandParent={true}
                onSelect={(selectedKeys: Key[], info: any) => {
                    props.onSelect?.(selectedKeys, info);
                    setSelectedKeys(selectedKeys);
                }}
                onRightClick={onKeyTreeRightClick}
                titleRender={onTitleRender}
                style={{
                    background: "#2B2D30",
                    height: "calc(100vh-32px)",
                    color: "rgb(223,225,228)"
                }}
            />
            <Flex justify={"center"} align={"end"} className={'scan-more-area'}>
                <Button
                    className={`scan-more-button ${noMoreData ? 'no-more' : ''}`}
                    disabled={noMoreData}
                    type="default"
                    size="small"
                    icon={scanning ? <LoadingOutlined className={'scan-more-icon'}/> :
                        <SearchOutlined className={'scan-more-icon'}/>}
                    onClick={onScanMore}>
                    {noMoreData ? t('redis.key_tree.sub_tree.keys_tree.scan_no_more_result') :
                        (scanning ? t('redis.key_tree.sub_tree.keys_tree.stop_scanning') : t('redis.key_tree.sub_tree.keys_tree.scan_more_result'))}
                </Button>
            </Flex>
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

    const onAddClick = (e: React.MouseEvent) => {
        invoke('show_add_new_key_menu', {
            x: e.clientX,
            y: e.clientY,
            datasource: datasourceRef.current,
            database: databaseRef.current
        }).then(r => {
        })
    }

    return (
        <Flex justify={"space-between"} className='redis-key-tree-panel' vertical={true}>
            <Flex vertical={true}>
                {/* key 检索输入 */}
                <div className={'datasource-tree-panel-search'}>
                    <Flex justify={'center'} align={'center'}>
                        <Search value={searchValue}
                                placeholder={t('redis.key_tree.search.placeholder')}
                                onChange={onChange}
                                onSearch={onSearch}
                                onPressEnter={onSearchPressEnter}
                                size='small'
                                autoCapitalize={'none'}
                                autoCorrect={'off'}/>
                        <PlusOutlined className={'key-add-button'} onClick={onAddClick}/>
                        <AreaChartOutlined className={'key-add-button'} onClick={props.onAnalysisOpen}/>
                    </Flex>
                </div>

                {/* 命令脚本支持 */}
                <div className={'command-query'} onClick={props.onCmdOpen}>
                    <Flex justify={'start'}>
                        <ConsoleIcon className={'console'} style={{
                            width: 14,
                            lineHeight: '12px'
                        }}/>
                        <span className={'text'}>{t('redis.key_tree.command_script.name')}</span>
                    </Flex>
                </div>

                {/* 收藏的树信息 */}
                <Collapse defaultActiveKey={activeKey}
                          ghost
                          accordion={true}
                          activeKey={activeKey}
                          onChange={key => {
                              setActiveKey(key);
                          }}
                          className={'core-redis-keys-tree'}
                          expandIconPosition={'end'}
                          items={[
                              {
                                  key: 'tab-favor',
                                  label: <>
                                      <Flex className={'favor-header'} gap={6}>
                                          <StarOutlined className={'collapse-icon'}/>
                                          <span>{t('redis.key_tree.sub_tree.favor_count', {'count': 17})}</span>
                                      </Flex>
                                  </>,
                                  children: <><FavoriteTree datasource={datasource} database={database}/></>
                              },
                              {
                                  key: 'tab-data-view',
                                  label: <>
                                      <Flex className={'view-header'} gap={6}>
                                          <TableOutlined className={'collapse-icon'}/>
                                          <span>{t('redis.key_tree.sub_tree.data_view', {'count': 1})}</span>
                                      </Flex>
                                  </>,
                                  children: <><DataView/></>
                              },
                              {
                                  key: 'tab-keys',
                                  label: <>
                                      <Flex className={'keys-header'} gap={6}>
                                          <KeyOutlined className={'collapse-icon'}/>
                                          <span>{t('redis.key_tree.sub_tree.keys_count', {'keyCount': scannedKeyCount})}</span>
                                      </Flex>
                                  </>,
                                  children: treeDataDom
                              }
                          ]}/>
            </Flex>

            <Flex className={'redis-outline'} justify={'center'} align={'center'}>
                <Space>
                    <span className={'redis-info-item'}>v {version}</span>
                    <Divider type="vertical"/>
                    <span className={'redis-info-item'}>{memoryUsage}
                        {/*<span className={'arrow up'}>↑</span>*/}
                    </span>
                    <Divider type="vertical"/>
                    <span className={'redis-info-item'}>{dbsize}
                        {/*<span className={'arrow down'}>↓</span>*/}
                    </span>
                </Space>
            </Flex>
        </Flex>
    );
}

export default RedisKeyTree;
