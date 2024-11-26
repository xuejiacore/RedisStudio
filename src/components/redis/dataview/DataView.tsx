/* eslint-disable */
import React, {useEffect, useRef, useState} from "react";
import DirectoryTree from "antd/es/tree/DirectoryTree";
import "./DataView.less";
import DataViewGroup from "./DataViewGroup.tsx";
import VarNode from "./VarNode.tsx";
import {invoke} from "@tauri-apps/api/core";
import {DataNode, EventDataNode} from "antd/es/tree";
import {useEvent} from "../../../utils/TauriUtil.tsx";
import {CustomDataNode} from "../RedisKeyTree.tsx";
import VarNodeEditor from "./VarNodeEditor.tsx";

interface DataViewProps {
    datasource: string;
    database: number;
    windowId: number;

    onDataViewCountCallback: (cnt: number) => void;
}

const findKey = (key: string,
                 tree: CustomDataNode[] | DataNode[],
                 lv: number): CustomDataNode | DataNode | undefined => {
    for (const node of tree) {
        // eslint-disable-next-line
        // @ts-ignore
        if (key.startsWith(lv == 0 ? `:${node.path}` : node.path)) {
            if (node.children) {
                const found = findKey(key, node.children, lv + 1);
                if (!found) {
                    return node;
                }
                return found;
            } else {
                return node;
            }
        }
    }
    return undefined;
};

const delNode = (key: string,
                 tree: CustomDataNode[] | DataNode[],
                 lv: number): CustomDataNode | DataNode | undefined => {
    for (const node of tree) {
        // eslint-disable-next-line
        // @ts-ignore
        if (key.startsWith(lv == 0 ? `:${node.path}` : node.path)) {
            if (node.children) {
                const found = delNode(key, node.children, lv + 1);
                if (!found) {
                    return node;
                }
                const ss = node.children.filter(t => {
                    return t.key === node.key;
                });
                node.children = ss;
                return found;
            } else {
                return node;
            }
        }
    }
    return undefined;
};

const DataView: React.FC<DataViewProps> = (props, context) => {

    const [treeData, setTreeData] = useState<DataNode[]>([]);
    const cachedTreeData = useRef<DataNode[]>([]);
    const menuContextNode = useRef(null);
    const dataViewMetaRef = useRef<Map<number, Map<string, string>>>(new Map());

    const onVarNodeEditorCancel = (data: any) => {
        // eslint-disable-next-line
        // @ts-ignore
        delNode(data.path, cachedTreeData.current, 0);
        setTreeData(packageData(undefined, cachedTreeData.current))
    };
    const onVarNodeEditorSave = (data: any) => {
        const pathArray = data.path.split(":").slice(2);
        const newKeyPath = pathArray.join(":");
        invoke('add_new_data_view_item', {
            datasource: parseInt(props.datasource),
            database: props.database,
            dataViewId: data.dv_id,
            key: newKeyPath,
            keyType: 'unknown'
        }).then((r: any) => {
            cachedTreeData.current = r.children;
            const treeData = packageData(undefined, r.children);
            setTreeData(treeData);
            props.onDataViewCountCallback(treeData.length);
        });
    }

    const collectTreeRuntimeKeys = (viewId: number, nodes: DataNode[], collector: (k: string) => void) => {
        for (const node of nodes) {
            // @ts-ignore
            const nodeType = node.node_type;
            if (nodeType === 1 || nodeType === 2) {
                if (node.children) {
                    collectTreeRuntimeKeys(viewId, node.children, collector);
                } else {
                    continue;
                }
            } else if (nodeType === 3) {
                let runtimeKey = node.key as string;
                const containVars = runtimeKey.indexOf("{") >= 0 && runtimeKey.indexOf("}") >= 0;
                if (containVars) {
                    const meta = dataViewMetaRef.current.get(viewId) ?? new Map<string, string>();
                    // @ts-ignore
                    runtimeKey = runtimeKey.replace(/\{([^}]+)\}/g, (_: any, key: any) => {
                        return meta.get(key) !== undefined ? meta.get(key) : `{${key}}`;
                    });
                }
                collector(runtimeKey);
            }
        }
    }

    function queryKeyTypes(vid: number) {
        const keys = new Set<string>();
        const afterFilter = cachedTreeData.current.filter((t: any) => t.dv_id === vid);
        collectTreeRuntimeKeys(vid, afterFilter, k => {
            if (!keys.has(k)) {
                keys.add(k);
            }
        });

        invoke('query_key_exist_and_type', {
            viewId: vid,
            datasource: parseInt(props.datasource),
            database: props.database,
            keys: Array.from(keys),
            currentMeta: JSON.stringify(Object.fromEntries(dataViewMetaRef.current.get(vid)!))
        }).then(r => {
            console.log(r);
        });
    }

    const onVarChange = (vid: number, key: string, value: string) => {
        let exists = dataViewMetaRef.current.get(vid);
        if (!exists) {
            exists = new Map<string, string>();
            dataViewMetaRef.current.set(vid, exists);
        }
        exists.set(key, value);
        queryKeyTypes(vid);
    };

    const packageData = (parent: any, nodes: any[]): any[] => {
        return nodes.map((n: any) => {
            if (n.node_type == 1) { // Data View Group
                const varObj: [string, string][] = n.var ? Object.entries(JSON.parse(n.var)) : Object.entries({});
                const map = new Map<string, string>(varObj);
                dataViewMetaRef.current.set(n.dv_id, map);
                return {
                    title: <DataViewGroup dataViewId={n.dv_id} name={n.name}/>,
                    key: n.path,
                    children: packageData(n, n.children)
                }
            } else if (n.node_type == 2) { // director
                return {
                    title: <VarNode origin={n.key}
                                    id={n.id}
                                    viewId={n.dv_id}
                                    name={n.name}
                                    defaultValue={n.var}
                                    onChange={onVarChange}/>,
                    key: n.path,
                    children: packageData(n, n.children)
                }
            } else if (n.node_type == 3) { // leaf
                return {
                    title: <VarNode origin={n.key}
                                    id={n.id}
                                    viewId={n.dv_id}
                                    name={n.name}
                                    defaultValue={n.var}
                                    keyType={n.key_type}
                                    onChange={onVarChange}/>,
                    key: n.path,
                    children: packageData(n, n.children)
                }
            } else if (n.node_type == 4) { // new key editor
                return {
                    title: <VarNodeEditor parent={parent}
                                          data={n}
                                          onCancel={onVarNodeEditorCancel}
                                          onSave={onVarNodeEditorSave}/>,
                    key: Date.now(),
                    children: []
                }
            }
        }).sort((a, b) => {
            return (b?.children.length ?? 0) - (a?.children.length ?? 0);
        });
    };

    useEffect(() => {
        invoke('list_tree_data_views', {
            datasource: parseInt(props.datasource),
            database: props.database
        }).then((r: any) => {
            cachedTreeData.current = r.children;
            const treeData = packageData(undefined, r.children);
            setTreeData(treeData);
            props.onDataViewCountCallback(treeData.length);
        });
    }, [props.datasource, props.database]);

    useEvent('show_data_view_r_clk_menu/add_dv_item', event => {
        const payload: any = event.payload;
        if (payload.winId == props.windowId) {
            // eslint-disable-next-line
            // @ts-ignore
            const operateNode = findKey(menuContextNode.current!.key, cachedTreeData.current, 0);
            if (operateNode) {
                if (operateNode.children) {
                    const name = 'ttttt';
                    const editNodeData = {
                        // eslint-disable-next-line
                        // @ts-ignore
                        dv_id: operateNode.dv_id,
                        key: name,
                        children: [],
                        key_type: 'zset',
                        node_type: 4,
                        name: name,
                        // eslint-disable-next-line
                        // @ts-ignore
                        path: `${operateNode.path}:${name}`
                    };
                    operateNode.children.push(editNodeData);
                    setTreeData(packageData(undefined, cachedTreeData.current));
                }
            }
        }
    })
    useEvent('show_data_view_r_clk_menu/del_dv_item', event => {
        const payload: any = event.payload;
        if (payload.winId == props.windowId) {
            console.log('del dava view item', menuContextNode.current);
            // @ts-ignore
            const id = menuContextNode.current?.title.props.id;
            if (id > 0) {
                invoke('del_data_view_item', {
                    datasource: parseInt(props.datasource),
                    database: props.database,
                    dataViewItemId: id
                }).then((r: any) => {
                    cachedTreeData.current = r.children;
                    const treeData = packageData(undefined, r.children);
                    setTreeData(treeData);
                    props.onDataViewCountCallback(treeData.length);
                })
            }
        }
    })
    useEvent('show_data_view_r_clk_menu/modify_dv_item', event => {
        const payload: any = event.payload;
        if (payload.winId == props.windowId) {
            console.log('modify dava view item');
        }
    })

    const calParentHeight = () => (window.innerHeight
        || document.documentElement.clientHeight
        || document.body.clientHeight) - 198;
    const [comHeight, setComHeight] = useState(calParentHeight());
    return <>
        <div className={'data-view-container'}>
            <DirectoryTree
                className={'datasource-tree'}
                multiple={false}
                defaultExpandAll={true}
                showLine={false}
                showIcon={false}
                treeData={treeData}
                checkable={false}
                defaultExpandParent={true}
                height={comHeight}
                onExpand={(keys, info) => {
                    let viewId: number;
                    // @ts-ignore
                    if (info.expanded && (viewId = info.node.title.props.dataViewId) > 0) {
                        queryKeyTypes(viewId)
                    }
                }}
                onClick={(e, n) => {
                    const title = n.title;
                    let props;
                    // @ts-ignore
                    if (title && (props = title.props) && props.id > 0 && props.origin) {
                        let runtimeKey = props.origin;
                        const containVars = props.origin.indexOf("{") >= 0 && props.origin.indexOf("}") >= 0;
                        if (containVars) {
                            const meta = dataViewMetaRef.current.get(props.viewId) ?? new Map<string, string>();
                            runtimeKey = props.origin.replace(/\{([^}]+)\}/g, (_: any, key: any) => {
                                return meta.get(key) !== undefined ? meta.get(key) : `{${key}}`;
                            });
                        }

                        // 点击后打开面板
                        console.log('点击了', props, runtimeKey);
                        // 判断是否包含了变量
                    }
                }}
                onRightClick={(info: {
                    event: React.MouseEvent;
                    node: EventDataNode<any>;
                }) => {
                    menuContextNode.current = info.node;
                    console.log(info.node.title.props.id);
                    invoke('show_data_view_right_click_menu', {
                        'winId': props.windowId
                    }).finally()
                }}
                style={{
                    background: "#2B2D30",
                    color: "rgb(223,225,228)",
                }}
            />
        </div>
    </>
}

export default DataView;