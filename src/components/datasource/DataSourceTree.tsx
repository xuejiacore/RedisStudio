/* eslint-disable */
import React, {useEffect, useRef, useState} from 'react';
import {CarryOutOutlined, CopyOutlined, MinusOutlined, PlusOutlined} from '@ant-design/icons';
import {Space, TreeDataNode} from 'antd';
import "./DataSourceTree.less";
import DirectoryTree from "antd/es/tree/DirectoryTree";
import DataSourceItem from "./DataSourceItem.tsx";
import DataSourceGroup from "./DataSourceGroup.tsx";
import {invoke} from "@tauri-apps/api/core";

interface DataSourceTreeProp {

}

function parseTree(node: any): TreeDataNode | undefined {
    if (node.node_type === 1) {
        const children = node.children.map((c: any) => {
            return parseTree(c);
        });
        console.log('children = ', children, node);
        return {
            title: (<DataSourceGroup name={node.name}/>),
            key: node.path,
            icon: <CarryOutOutlined/>,
            children: children,
        };
    } else if (node.node_type === 2) {
        return {
            title: (<DataSourceItem
                    color={node.color}
                    title={node.host}
                    desc={'175.23.33.33s'}/>
            ),
            key: node.path,
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
                        console.log('解析后', td);
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
        console.log('selected', selectedKeys, info);
    };


    return (<>
        <div ref={ref} className={'datasource-tree-div'}>
            <Space className={'datasource-tree-panel'} direction={"vertical"}>
                <Space className={'datasource-operators'}>
                    <PlusOutlined/>
                    <MinusOutlined/>
                    <CopyOutlined/>
                </Space>
                <DirectoryTree
                    className={'datasource-tree'}
                    multiple
                    defaultExpandAll={true}
                    defaultExpandParent={true}
                    showLine={false}
                    showIcon={false}
                    // onExpand={onExpand}
                    treeData={treeData}
                    checkable={false}
                    // onSelect={props.onSelect}
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