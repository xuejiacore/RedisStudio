import {Button, Collapse, Divider, Empty, Flex, Input, MenuProps, Space} from 'antd';
import type {DataNode, EventDataNode} from 'antd/es/tree';
import React, {Key, useEffect, useMemo, useRef, useState} from "react";
import "./RedisKeyTree.less";
import "../menu/Menu.less";
import {LoadingOutlined, PlusOutlined, SearchOutlined} from "@ant-design/icons";
import DirectoryTree from 'antd/es/tree/DirectoryTree';
import {rust_invoke} from '../../utils/RustIteractor';
import {listen, UnlistenFn} from "@tauri-apps/api/event";
import RedisKey from "./RedisKey";
import SystemProperties, {SysProp} from "../../utils/SystemProperties.ts";
import FavoriteTree from "../favorite/FavoriteTree.tsx";
import {useTranslation} from "react-i18next";
import ConsoleIcon from "../icons/ConsoleIcon.tsx";
import {invoke} from "@tauri-apps/api/core";
import FIELD_SYS_REDIS_SEPARATOR = SysProp.FIELD_SYS_REDIS_SEPARATOR;

const {Search} = Input;

const MAX_PRELOAD_KEY_SIZE = 25;

export type CustomDataNode = DataNode & {
    keyType?: string,
    isLeaf?: boolean,
    total: number
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
    lv0LeafIndex: Map<number, number>,
    cacheData: Map<string, CustomDataNode>,
    keyTotal: number
}

//用于取消监听
let receiveDataQueue: ScanItem[] = [];
let cleaned = false;

function formatNumber(num: number): string {
    if (num >= 1e9) {
        return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (num >= 1e6) {
        return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1e3) {
        return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
}

const items: MenuProps['items'] = [
    {
        label: <span className={'menu-simple-text'}>String</span>,
        key: 'string',
    },
    {
        label: <span className={'menu-simple-text'}>Hash</span>,
        key: 'hash',
    },
    {
        label: <span className={'menu-simple-text'}>List</span>,
        key: 'list',
    },
    {
        label: <span className={'menu-simple-text'}>Set</span>,
        key: 'set',
    },
    {
        label: <span className={'menu-simple-text'}>ZSet</span>,
        key: 'zset',
    },
    {
        type: 'divider',
    },
    {
        label: 'Import',
        key: '3',
        children: [
            {
                key: '1-1',
                label: <span className={'menu-simple-text'}>Json</span>,
            },
            {
                key: '1-2',
                label: <span className={'menu-simple-text'}>Raw</span>,
            },
        ],
    },
];

const RedisKeyTree: React.FC<KeyTreeProp> = (props, context) => {

    const {t} = useTranslation();
    const [searchValue, setSearchValue] = useState('*');
    const [cursor, setCursor] = useState(0);
    const [pageSize, setPageSize] = useState(500);
    const [scanCount, setScanCount] = useState(500);
    const [noMoreData, setNoMoreData] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [version, setVersion] = useState('unknown');
    const [memoryUsage, setMemoryUsage] = useState('-');
    const [dbsize, setDbsize] = useState('0');
    const [databases, setDatabases] = useState<any[]>([]);
    const [selectedDBIndex, setSelectedDBIndex] = useState(0);
    const [dataSources, setDataSources] = useState([]);
    const set = new Set<string>();
    const [deletedKeys, setDeletedKeys] = useState<Set<string>>(set);
    const [databasePopupMatchSelectWidth, setDatabasePopupMatchSelectWidth] = useState(140);
    const [treeUniqueId, setTreeUniqueId] = useState(Date.now())

    const calParentHeight = () => (window.innerHeight
        || document.documentElement.clientHeight
        || document.body.clientHeight) - 198;
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
    const treeDataContext = useMemo((): TreeDataParseContext => {
        return {
            lv0LeafIndex: new Map<number, number>(),
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
        treeDataContext.lv0LeafIndex = new Map<number, number>();
        treeDataContext.keyTotal = 0;
        treeDataContext.cacheData = new Map<string, CustomDataNode>;
        setScannedKeyCount(0);
        setDeletedKeys(new Set<string>);
        setTreeUniqueId(Date.now());
    }

    const packageDataNode = (data: CustomDataNode[] | any, array: string[], item: ScanItem, prePath: string, lv: number, context: TreeDataParseContext): number => {
        if (array.length == 0) {
            return 0;
        }
        const currentNodeTitle = array[0];
        const currPath = prePath.length > 0 ? prePath + splitSymbol + currentNodeTitle : array[0];
        if (array.length == 1) {
            // 叶子节点
            const node: CustomDataNode = {
                title: currentNodeTitle,
                key: currPath,
                isLeaf: true,
                total: 1
            };
            if (lv == 0) {
                rust_invoke("redis_key_type", {
                    datasource_id: props.datasourceId,
                    keys: [node.key]
                }).then(ret => {
                    const obj = JSON.parse(ret as string);
                    node.keyType = obj.types[node.key as string];
                });
            }
            const lv0LeafIdx = context.lv0LeafIndex.get(lv) ?? 0;
            context.lv0LeafIndex.set(lv, lv0LeafIdx - 1);
            data.push(node);
            return 1;
        } else {
            const existsNodes = context.cacheData.get(`${currPath}\u0001`);
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
                context.cacheData.set(`${currPath}\u0001`, parent);
                const cnt = packageDataNode(children, array.slice(1), item, currPath, lv + 1, context);
                parent.total += cnt;
                const leafIdx = context.lv0LeafIndex.get(lv) ?? 0;
                data.splice(data.length + leafIdx, 0, parent);
                return cnt;
            }
        }
    };

    const removeListenerRef = useRef<UnlistenFn>();
    const removeListenerIdRef = useRef(0);
    useEffect(() => {
        const ts = Date.now();
        const addListenerAsync = async () => {
            return new Promise<UnlistenFn>(resolve => {
                const loadData = () => {
                    rust_invoke("redis_list_datasource", {}).then(r => {
                        if (typeof r === "string") {
                            const result = JSON.parse(r)
                            setDataSources(result.map((item: any) => item.name));
                            // 重新加载当前的数据源id
                            handleDataSourceChanged(props.datasourceId);
                        }
                    });
                };

                listen('redis_scan_event', (event) => {
                    if (removeListenerIdRef.current != ts) {
                        const payload: any = event.payload;
                        if (payload.finished) {
                            setScanning(false);
                            return;
                        }

                        payload.keys.forEach((key: any) => {
                            receiveDataQueue.push({
                                key: key,
                                keyType: 'hash'
                            });
                        })
                        const copy: CustomDataNode[] = cleaned ? [] : [...cachedTreeData];
                        if (cleaned) {
                            cleaned = false;

                            treeDataContext.cacheData.clear();
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
                        setCursor(payload.cursor);
                        if (payload.cursor == 0) {
                            setNoMoreData(true);
                        }
                        refreshTimer = null;
                    }
                }).then(unlistenFn => {
                    if (removeListenerIdRef.current != ts) {
                        loadData();
                        resolve(unlistenFn);
                    } else {
                        unlistenFn();
                    }
                });
            });
        };
        (async () => {
            removeListenerRef.current = await addListenerAsync();
        })();
        /*

         */
        return () => {
            removeListenerIdRef.current = ts;
            const removeListenerAsync = async () => {
                return new Promise<void>(resolve => {
                    if (removeListenerRef.current) {
                        removeListenerRef.current();
                    }
                    resolve();
                })
            }

            removeListenerAsync().then(t => {
            });
        };
    }, []);

    // 加载DB信息列表
    function setDatabaseInfoList(result: any) {
        // noinspection JSUnresolvedReference
        const dbCount = result.database_count;
        // noinspection JSUnresolvedReference
        const keySpaceInfo = result.key_space_info;
        const keySpaceInfoMap = keySpaceInfo.reduce((acc: any, obj: any) => {
            acc[obj.index] = obj;
            return acc;
        }, {});
        const keySpaceInfoData = [];
        const digitLen = (num: number) => Math.floor(Math.log10(num)) + 1;
        let maxLen = 0;
        for (let index = 0; index < dbCount; index++) {
            const info = keySpaceInfoMap[index];
            let keyCount = 0;
            if (info) {
                const label = <><b>DB{index}</b>&nbsp;&nbsp;<span
                    className={'db-key-len'}>({info.keys})</span></>;
                keyCount = info.keys;
                keySpaceInfoData.push({
                    label: label,
                    value: index
                });
            } else {
                keySpaceInfoData.push({
                    label: <><b>DB{index}</b>&nbsp;&nbsp;<span className={'db-key-len'}>(EMPTY)</span></>,
                    value: index
                })
            }
            maxLen = Math.max(digitLen(keyCount), maxLen);
        }
        setDatabasePopupMatchSelectWidth(maxLen * 34);

        // const databases = result.map((item: any) => item.name);
        setDatabases(keySpaceInfoData)
        // setSecondCity(keySpaceInfoData);
    }

    const handleDataSourceChanged = (datasourceId: string) => {
        cleanTreeData();
        rust_invoke("redis_get_database_info", {
            datasource_id: datasourceId
        }).then(r => {
            if (typeof r === "string") {
                const result = JSON.parse(r);
                setVersion(result.redis_version);
                setMemoryUsage(result.used_memory_human);
                setDbsize(formatNumber(result.dbsize));
                setDatabaseInfoList(result);
                setScanning(true);
                rust_invoke("redis_key_scan", {
                    datasource_id: datasourceId,
                    pattern: searchValue ? searchValue : "*",
                    page_size: pageSize,
                    cursor: cursor,
                    count: scanCount
                }).then(ret => {
                })
            }
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
                    <div className={'redis-directory'}>
                        <span className={'redis-directory-key-title'}>{data.title}</span>
                        <span className={'redis-directory-key-counter'}>{data.total}</span>
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
        const fetchKeyTypeList = info.node.children.slice(0, Math.min(info.node.children.length, MAX_PRELOAD_KEY_SIZE));
        const keys = [];
        for (const child of fetchKeyTypeList) {
            if (child.isLeaf && !child.keyType) {
                keys.push(child.key);
                child.keyType = 'unknown';
            }
        }
        if (keys.length > 0) {
            rust_invoke("redis_key_type", {
                datasource_id: props.datasourceId,
                keys: keys
            }).then(r => {
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
        let finalSearchVal = searchValue;
        if (searchValue.length == 0) {
            finalSearchVal = "*";
        } else if (!searchValue.endsWith("!") && !searchValue.endsWith("*")) {
            finalSearchVal += "*";
        }

        setScanning(true);
        setSearchValue(finalSearchVal);
        setCursor(0);
        setNoMoreData(false);
        cleanTreeData();
        rust_invoke("redis_key_scan", {
            datasource_id: 'datasourceId',
            pattern: finalSearchVal,
            page_size: pageSize,
            cursor: cursor,
            count: scanCount
        }).then(ret => {
        });
    };

    let treeDataDom;
    const onScanMore = () => {
        if (scanning) {
            setScanning(false);
        } else {
            setScanning(true);
            rust_invoke("redis_key_scan", {
                datasource_id: 'datasourceId',
                pattern: searchValue ? searchValue : "*",
                page_size: pageSize,
                cursor: cursor,
                count: scanCount
            }).then(ret => {
                //console.log("扫描后的数据：", ret);
            });
        }
    };

    const onKeyTreeRightClick = (info: {
        event: React.MouseEvent;
        node: EventDataNode<CustomDataNode>;
    }) => {
        if (info.node.isLeaf) {
            invoke("show_key_tree_right_menu", {}).then(r => {
            });
        }
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
                treeData={treeData}
                checkable={false}
                height={comHeight}
                onSelect={props.onSelect}
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
                    {noMoreData ? t('redis.key_tree.sub_tree.keys_tree.scan_no_more_result') : (scanning ? t('redis.key_tree.sub_tree.keys_tree.stop_scanning') : t('redis.key_tree.sub_tree.keys_tree.scan_more_result'))}
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
            y: e.clientY
        }).then(r => {
        })
    }

    return (
        <div className='redis-key-tree-panel'>
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
            <Collapse defaultActiveKey={['2']} ghost accordion={true}
                      className={'core-redis-keys-tree'}
                      items={[
                          {
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

            <Flex className={'redis-outline'} justify={'center'} align={'center'}>
                <Space>
                    <span className={'redis-info-item'}>v {version}</span>
                    <Divider type="vertical"/>
                    <span className={'redis-info-item'}>{memoryUsage}<span className={'arrow up'}>↑</span></span>
                    <Divider type="vertical"/>
                    <span className={'redis-info-item'}>{dbsize}<span className={'arrow down'}>↓</span></span>
                </Space>
            </Flex>
        </div>
    );
}

export default RedisKeyTree;
