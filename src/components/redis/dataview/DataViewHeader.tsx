import React from "react";
import {TableOutlined} from "@ant-design/icons";
import {Flex} from "antd";
import {useTranslation} from "react-i18next";
import {invoke} from "@tauri-apps/api/core";

interface DataViewHeaderProps {
    datasource: string;
    database: number;
    dataViewCount: number;
}

const DataViewHeader: React.FC<DataViewHeaderProps> = (props, context) => {
    const {t} = useTranslation();

    const onContextMenuClick = (e: any) => {
        e.preventDefault();
        // TODO: 新增视图菜单打开
        console.log(e);
        invoke('show_data_view_mgr_menu', {}).finally();
    };

    return <>
        <Flex className={'view-header'} gap={6} onContextMenu={onContextMenuClick}>
            <TableOutlined className={'collapse-icon'}/>
            <span>{t('redis.key_tree.sub_tree.data_view', {'count': props.dataViewCount})}</span>
        </Flex>
    </>
}

export default DataViewHeader;