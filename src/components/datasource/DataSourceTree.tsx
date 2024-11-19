/* eslint-disable */
import React, {Key, useEffect, useRef, useState} from 'react';
import {Space, TreeDataNode} from 'antd';
import "./DataSourceTree.less";
import DirectoryTree from "antd/es/tree/DirectoryTree";
import DataSourceItem from "./DataSourceItem.tsx";
import DataSourceGroup from "./DataSourceGroup.tsx";
import {invoke} from "@tauri-apps/api/core";
import {wrapColor} from "../../utils/Util.ts";

interface DataSourceTreeProp {
    datasource?: number;
    onSelected: (datasource: number) => void;
}

function parseTree(node: any): TreeDataNode | undefined {
    if (node.node_type === 1) {
        const children = node.children.map((c: any) => {
            return parseTree(c);
        });
        console.log(node.path);
        return {
            title: (<DataSourceGroup name={node.name}/>),
            key: node.path,
            children: children,
        };
    } else if (node.node_type === 2) {
        console.log(node);
        return {
            title: (<DataSourceItem
                    id={node.id}
                    color={wrapColor(node.color, node.id, node.host, node.port)}
                    host={node.host}
                    port={node.port}
                    default_database={node.default_database}
                    name={node.name}
                    path={node.path}/>
            ),
            key: `ds#${node.id}`,
        }
    } else {
        return undefined;
    }
}

const DataSourceTree: React.FC<DataSourceTreeProp> = (props, context) => {
    const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
    const [expandedKey, setExpandedKey] = useState<Key[]>([]);
    const [datasource, setDatasource] = useState(props.datasource);
    const treeExpandedKeysRef = useRef<Key[]>([]);

    useEffect(() => {
        setDatasource(props.datasource);
    }, [props.datasource]);

    const ref = useRef(null);
    useEffect(() => {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    invoke('list_treed_datasource', {}).then((r: any) => {
                        const td = parseTree(r);
                        if (td) {
                            // @ts-ignore
                            setTreeData(td.children);
                        }

                        const expandedKeys = [`ds#${datasource}`];
                        treeExpandedKeysRef.current = expandedKeys;
                        setExpandedKey(expandedKeys);
                    });
                }
            });
        });

        if (ref.current) {
            observer.observe(ref.current);
        }
        return () => {
            if (ref.current) {
                observer.unobserve(ref.current);
            }
        }
    }, []);
    const onSelect = (selectedKeys: React.Key[], info: any) => {
        const children = info.node.children;
        // treeExpandedKeysRef.current = [...new Set([].concat(treeExpandedKeysRef.current, [info.node.key]))];
        // setExpandedKey(selectedKeys);
        if (!children || children.length > 0) {
            props.onSelected(info.node.title.props.id);
        }
    };

    return (<>
        <div ref={ref} className={'datasource-tree-div'}>
            <Space className={'datasource-tree-panel'} direction={"vertical"}>
                <DirectoryTree
                    className={'datasource-tree'}
                    multiple={false}
                    defaultExpandAll={true}
                    showLine={false}
                    showIcon={false}
                    treeData={treeData}
                    checkable={false}
                    onSelect={onSelect}
                    defaultExpandParent={true}
                    expandedKeys={expandedKey}
                    autoExpandParent={true}
                    onExpand={(keys, info) => {
                        console.log(keys, info);
                        if (!info.expanded) {
                            const rmkey = info.node.key as string;
                            const tt = keys.filter((k: Key | string) => {
                                return !(k as string).startsWith(rmkey) && !(k as string).startsWith("ds#");
                            });
                            setExpandedKey([...tt]);
                        } else {
                            setExpandedKey(keys);
                        }
                    }}
                    // titleRender={onTitleRender}
                    style={{
                        background: "#2B2D30",
                        color: "rgb(223,225,228)",
                    }}
                />
            </Space>
        </div>
    </>)
}

export default DataSourceTree;