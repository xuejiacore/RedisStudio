/* eslint-disable */
import React, {useEffect, useRef, useState} from 'react';
import {CarryOutOutlined} from '@ant-design/icons';
import {Space, TreeDataNode} from 'antd';
import "./DataSourceTree.less";
import DirectoryTree from "antd/es/tree/DirectoryTree";
import DataSourceItem from "./DataSourceItem.tsx";
import DataSourceGroup from "./DataSourceGroup.tsx";
import {invoke} from "@tauri-apps/api/core";
import {wrapColor} from "../../utils/Util.ts";

interface DataSourceTreeProp {
    onSelected: (datasource: number) => void;
}

function parseTree(node: any): TreeDataNode | undefined {
    if (node.node_type === 1) {
        const children = node.children.map((c: any) => {
            return parseTree(c);
        });
        return {
            title: (<DataSourceGroup name={node.name}/>),
            key: node.path,
            icon: <CarryOutOutlined/>,
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
            icon: <CarryOutOutlined/>,
        }
    } else {
        return undefined;
    }
}

const DataSourceTree: React.FC<DataSourceTreeProp> = (props, context) => {
    const [treeData, setTreeData] = useState<TreeDataNode[]>([]);

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
                    })
                }
            })
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
        console.log(info);
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