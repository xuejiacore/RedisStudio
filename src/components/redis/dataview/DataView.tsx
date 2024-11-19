import React, {useEffect, useState} from "react";
import DirectoryTree from "antd/es/tree/DirectoryTree";
import "./DataView.less";
import DataViewGroup from "./DataViewGroup.tsx";
import VarNode from "./VarNode.tsx";
import {invoke} from "@tauri-apps/api/core";
import {DataNode} from "antd/es/tree";

interface DataViewProps {

}

const DataView: React.FC<DataViewProps> = (props, context) => {

    const [treeData, setTreeData] = useState<DataNode[]>([])
    const packageData = (nodes: any[]): any[] => {
        return nodes.map((n: any) => {
            if (n.node_type == 1) { // Data View Group
                return {
                    title: <DataViewGroup name={n.name}/>,
                    key: n.path,
                    children: packageData(n.children)
                }
            } else if (n.node_type == 2) { // director
                return {
                    title: <VarNode name={n.name} defaultValue={n.var}/>,
                    key: n.path,
                    children: packageData(n.children)
                }
            } else if (n.node_type == 3) { // leaf
                return {
                    title: <VarNode name={n.name} defaultValue={n.var} keyType={n.key_type}/>,
                    key: n.path,
                    children: packageData(n.children)
                }
            }
        });
    };

    useEffect(() => {
        invoke('list_tree_data_views', {
            datasource: 5,
            database: 0
        }).then((r: any) => {
            console.log("视图数据：", r);
            const treeData = packageData(r.children);
            setTreeData(treeData);
        });
    }, []);

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
                    console.log(selectedKeys, info);
                }}
                onClick={(e) => {
                }}
                onExpand={(selectedKeys, info) => {
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