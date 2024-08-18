import React from "react";
import "./DatasourceItem.less";
import {Flex, Space} from "antd";

interface DatasourceItemProp {
    name: string;
    host: string;
    port: string;
    datasourceId: string;
    dscolor: string;
}

const DatasourceItem: React.FC<DatasourceItemProp> = (props, context) => {

    return <>
        <div className={'datasource-item'}>
            <Flex className={'datasource-tree-node'} justify={"start"} align={"center"}>
                <div className={'node-icon'} style={{background: props.dscolor}}>NC</div>

                <Space direction={"vertical"} size={0} className={'node-desc-area'}>
                    <div className={'project-name-text'}>{props.name}</div>
                    <div className={'desc-text'}>{props.host}:{props.port}</div>
                </Space>
            </Flex>
        </div>
    </>;
}

export default DatasourceItem;