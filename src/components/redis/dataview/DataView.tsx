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
    const contextNode = useRef(null);

    const onVarNodeEditorCancel = (data: any) => {
        // eslint-disable-next-line
        // @ts-ignore
        delNode(data.path, cachedTreeData.current, 0);
        setTreeData(packageData(undefined, cachedTreeData.current))
    };
    const onVarNodeEditorSave = (data: any) => {
        const pathArray = data.path.split(":").slice(2);
        const newKeyPath = pathArray.join(":");
        console.log("保存数据", data, newKeyPath);
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

    const packageData = (parent: any, nodes: any[]): any[] => {
        return nodes.map((n: any) => {
            if (n.node_type == 1) { // Data View Group
                return {
                    title: <DataViewGroup name={n.name}/>,
                    key: n.path,
                    children: packageData(n, n.children)
                }
            } else if (n.node_type == 2) { // director
                return {
                    title: <VarNode id={n.id} viewId={n.dv_id} name={n.name} defaultValue={n.var}/>,
                    key: n.path,
                    children: packageData(n, n.children)
                }
            } else if (n.node_type == 3) { // leaf
                return {
                    title: <VarNode id={n.id} viewId={n.dv_id} name={n.name} defaultValue={n.var} keyType={n.key_type}/>,
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
            const operateNode = findKey(contextNode.current!.key, cachedTreeData.current, 0);
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
            console.log('del dava view item', contextNode.current);
            // @ts-ignore
            const id = contextNode.current?.title.props.id;
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
                onSelect={(selectedKeys, info) => {
                    //console.log(selectedKeys, info);
                }}
                onClick={(e) => {
                }}
                onExpand={(selectedKeys, info) => {
                }}
                onRightClick={(info: {
                    event: React.MouseEvent;
                    node: EventDataNode<any>;
                }) => {
                    contextNode.current = info.node;
                    console.log(info.node.title.props.id);
                    invoke('show_data_view_right_click_menu', {
                        'winId': props.windowId
                    }).then(r => {
                    })
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