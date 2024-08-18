import {AppstoreAddOutlined, PlusOutlined} from "@ant-design/icons";
import {Flex} from "antd";
import React from "react";
import "./DatasourceManagerHeader.less";

interface DatasourceManagerHeaderProp {

}

const DatasourceManagerHeader: React.FC<DatasourceManagerHeaderProp> = (props, context) => {
    return <>
        <Flex className={'datasource-manager-header'} justify={"start"} align={"start"} vertical>
            <div className={'datasource-manager-menu'}>
                <PlusOutlined/>
                <span className={'label'}>New Data Source</span>
            </div>

            <div className={'datasource-manager-menu'}>
                <AppstoreAddOutlined/>
                <span className={'label'}>Configuration Manager</span>
            </div>
        </Flex>
    </>;
}

export default DatasourceManagerHeader;