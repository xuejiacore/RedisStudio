import React from "react";
import "./DatasourceItem.less";
import {Flex, Space} from "antd";

export interface Datasource {
    host: string;
    name: string;
    port: number;
    datasource: string;
    dscolor: string;
}

interface DatasourceItemProp {
    onClick?: (ds: Datasource) => void;
    name: string;
    host: string;
    port: number;
    datasourceId: string;
    dscolor: string;
}

const DatasourceItem: React.FC<DatasourceItemProp> = (props, context) => {

    const onClick = () => {
        props.onClick?.({
            host: props.host,
            port: props.port,
            datasource: props.datasourceId,
            dscolor: props.dscolor,
            name: props.name,
        });
    };


    return <>
        <div className={'datasource-item'} onClick={onClick}>
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