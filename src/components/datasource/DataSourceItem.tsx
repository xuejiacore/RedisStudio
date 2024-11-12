import React from "react";
import {Flex} from "antd";

interface DataSourceItemProp {
    id?: string | number;
    color?: string;
    host: string;
    port: number;
    default_database: number;
    name?: string;
    path?: string;
}

const DataSourceItem: React.FC<DataSourceItemProp> = (props, context) => {
    const datasourceBackground = `linear-gradient(to top, ${props.color}FF, ${props.color}DE)`;
    return (<>
        <Flex className={'datasource-tree-node'} justify={"start"} align={"center"}>
            <div className={'node-icon'} style={{background: datasourceBackground}}>NC</div>

            <Flex vertical={true} className={'node-desc-area'}>
                <Flex>
                    <div className={'project-name-text'}>{props.name}</div>
                </Flex>
                <Flex justify={"center"} align={"center"} gap={4}>
                    <div className={'desc-text'}>{props.host}:{props.port}</div>
                    <div className={'default-database'}>DB{props.default_database ?? 0}</div>
                </Flex>
            </Flex>
        </Flex>
    </>)
}

export default DataSourceItem;