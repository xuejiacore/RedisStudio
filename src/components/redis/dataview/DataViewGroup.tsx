import React from "react";
import {Flex} from "antd";
import {TableOutlined} from "@ant-design/icons";

interface DataViewGroupProps {
    name: string;
}

const DataViewGroup: React.FC<DataViewGroupProps> = (props, context) => {
    return <>
        <Flex gap={4} className={'data-view-group'}>
            <TableOutlined className={'group-icon'}/>
            <span className={'group-name'}>{props.name}</span>
        </Flex>
    </>
}

export default DataViewGroup;