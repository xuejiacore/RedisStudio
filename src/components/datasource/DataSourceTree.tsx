import React, {useEffect, useState} from 'react';
import {CarryOutOutlined, CopyOutlined, MinusOutlined, PlusOutlined} from '@ant-design/icons';
import {Space, TreeDataNode} from 'antd';
import "./DataSourceTree.less";
import DirectoryTree from "antd/es/tree/DirectoryTree";
import DataSourceItem from "./DataSourceItem.tsx";
import DataSourceGroup from "./DataSourceGroup.tsx";

interface DataSourceTreeProp {

}

const treeData: TreeDataNode[] = [
    {
        title: (<DataSourceGroup name={'公司项目'}/>),
        key: '0-0',
        icon: <CarryOutOutlined/>,
        children: [
            {
                title: (<DataSourceGroup name={'游戏服务'}/>),
                key: '0-0-0',
                icon: <CarryOutOutlined/>,
                children: [
                    {
                        title: (<DataSourceItem
                                color={'#4E6EF0'}
                                title={'snake-game-biz'}
                                desc={'~/Workspace/code/company/gitlab/snake-game-biz'}/>
                        ),
                        key: '0-0-0-0', icon: <CarryOutOutlined/>
                    },
                    {
                        title: (<DataSourceItem
                                color={'#4EA178'}
                                title={'push-service'}
                                desc={'~/Workspace/code/company/gitlab/push-service'}/>
                        ),
                        key: '0-0-0-1',
                        icon: <CarryOutOutlined/>,
                    },
                    {
                        title: (<DataSourceItem
                                color={'#5786DF'}
                                title={'push-service'}
                                desc={'~/Workspace/code/company/gitlab/push-service'}/>
                        ), key: '0-0-0-2', icon: <CarryOutOutlined/>
                    },
                ],
            },
            {
                title: (<DataSourceGroup name={'支付'}/>),
                key: '0-0-1',
                icon: <CarryOutOutlined/>,
                children: [{
                    title: (<DataSourceItem
                            color={'#0099cc'}
                            title={'payment-centre'}
                            desc={'~/Workspace/code/company/gitlab/payment-centre'}/>
                    ),
                    key: '0-0-1-0',
                    icon: <CarryOutOutlined/>
                }],
            },
            {
                title: (<DataSourceGroup name={'框架'}/>),
                key: '0-0-2',
                icon: <CarryOutOutlined/>,
                children: [
                    {
                        title: (<DataSourceItem
                                color={'#E2865B'}
                                title={'altass-core'}
                                desc={'~/Workspace/code/company/gitlab/altass'}/>
                        ), key: '0-0-2-0', icon: <CarryOutOutlined/>
                    },
                ],
            },
        ],
    },
    {
        title: (<DataSourceGroup name={'个人项目'}/>),
        key: '0-1',
        icon: <CarryOutOutlined/>,
        children: [
            {
                title: (<DataSourceGroup name={'Niki'}/>),
                key: '0-1-0',
                icon: <CarryOutOutlined/>,
                children: [
                    {title: 'leaf', key: '0-1-0-0', icon: <CarryOutOutlined/>},
                    {title: 'leaf', key: '0-1-0-1', icon: <CarryOutOutlined/>},
                ],
            },
        ],
    },
    {
        title: (<DataSourceItem
                color={'#E2865B'}
                title={'localhost'}
                desc={'~/Workspace/code/company'}/>
        ),
        key: '0-2',
        icon: <CarryOutOutlined/>,
    },
    {
        title: (<DataSourceItem
                color={'#E2865B'}
                title={'172.31.65.68'}
                desc={'175.23.33.33'}/>
        ),
        key: '0-3',
        icon: <CarryOutOutlined/>,
    },
];

const DataSourceTree: React.FC<DataSourceTreeProp> = (props, context) => {
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

    const onSelect = (selectedKeys: React.Key[], info: any) => {
        console.log('selected', selectedKeys, info);
    };


    return (<>
        <Space className={'datasource-tree-panel'} direction={"vertical"}>
            <Space className={'datasource-operators'}>
                <PlusOutlined/>
                <MinusOutlined/>
                <CopyOutlined/>
            </Space>
            <DirectoryTree
                className={'datasource-tree'}
                multiple
                // switcherIcon={<DownOutlined/>}
                defaultExpandAll={true}
                showLine={false}
                showIcon={false}
                // onExpand={onExpand}
                treeData={treeData}
                checkable={false}
                height={comHeight}
                // onSelect={props.onSelect}
                // titleRender={onTitleRender}
                style={{
                    background: "#2B2D30",
                    color: "rgb(223,225,228)"
                }}
            />
        </Space>
    </>)
}

export default DataSourceTree;