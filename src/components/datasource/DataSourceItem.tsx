import React from "react";
import {Flex, Space} from "antd";

interface DataSourceItemProp {
    color?: string
    title: string
    desc?: string
}

const DataSourceItem: React.FC<DataSourceItemProp> = (props, context) => {
    return (<>
        <Flex className={'datasource-tree-node'} justify={"start"} align={"center"}>
            <div className={'node-icon'} style={{background: props.color}}>NC</div>

            <Space direction={"vertical"} size={0} className={'node-desc-area'}>
                <div className={'project-name-text'}>{props.title}</div>
                <div className={'desc-text'}>{props.desc}</div>
            </Space>
        </Flex>
    </>)
}

export default DataSourceItem;