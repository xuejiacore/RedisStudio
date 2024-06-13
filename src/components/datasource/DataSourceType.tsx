import React, {useState} from "react";
import RedisDatasourceEditor from "./redis/RedisDatasourceEditor.tsx";
import ZkDatasourceEditor from "./zookeeper/ZkDatasourceEditor.tsx";
import './DataSourceType.less'
import BsButton from "../../utils/button/BsButton.tsx";
import {Flex, Space} from "antd";

interface DataSourceTypeProp {
    type: string
}

const DataSourceType: React.FC<DataSourceTypeProp> = (props, context) => {
    const [currentDatasourceType, setCurrentDatasourceType] = useState(props.type);

    let datasourceEditor;

    switch (props.type) {
        case 'redis':
            datasourceEditor = (<RedisDatasourceEditor/>)
            break;
        case 'zookeeper':
            datasourceEditor = (<ZkDatasourceEditor/>)
            break;
        default:
    }

    return (<>
        <div>
            {datasourceEditor}
        </div>
        <div className={'datasource-type-footer'}>
            <Flex justify={"end"}>
                <Space>
                    <BsButton type={"default"} label={'Test connection'}/>
                    <BsButton type={"submit"} label={'Save'}/>
                </Space>
            </Flex>
        </div>
    </>);
}

export default DataSourceType;