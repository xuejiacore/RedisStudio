import React from "react";
import {Flex} from "antd";
import {ReloadOutlined} from "@ant-design/icons";
import DataViewIcon from "../../icons/DataViewIcon.tsx";

interface DataViewGroupProps {
    dataViewId: number;
    name: string;
    sort: number;
    onReload: (viewId: number) => void;
}

const DataViewGroup: React.FC<DataViewGroupProps> = (props, context) => {
    const onReloadClick = (e: any) => {
        e.stopPropagation();
        props.onReload(props.dataViewId);
    };

    return <>
        <Flex className={'data-view-group-container'} justify={'space-between'}>
            <Flex gap={4} className={'data-view-group'}>
                <DataViewIcon className={'group-icon'} style={{width: 16}}/>
                <span className={'group-name'}>{props.name}</span>
            </Flex>
            <div className={'data-view-group-operator'} onClick={onReloadClick}>
                <ReloadOutlined className={'toolbar-btn reload-btn'}/>
            </div>
        </Flex>
    </>
}

export default DataViewGroup;