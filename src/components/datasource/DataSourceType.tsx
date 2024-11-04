import React, {useState} from "react";
import RedisDatasourceEditor from "./redis/RedisDatasourceEditor.tsx";
import './DataSourceType.less'
import BsButton from "../../utils/button/BsButton.tsx";
import {Flex, Space} from "antd";

interface DataSourceTypeProp {
    type: string
}

const DataSourceType: React.FC<DataSourceTypeProp> = (props, context) => {
    const [currentDatasourceType, setCurrentDatasourceType] = useState(props.type);

    let datasourceEditor;

    const result = 'fail';// success

    switch (props.type) {
        case 'redis':
            datasourceEditor = (<RedisDatasourceEditor/>)
            break;
        default:
    }

    return (<>
        <Flex className={'configure'} justify={'space-between'} vertical={true}>
            <div>
                {datasourceEditor}
            </div>

            <Flex className={`connect-info ${result}`} justify={'space-between'} vertical={true}>
                <span className={'result-name'}>Failed</span>
                <Flex className={'result-detail'} justify={'space-between'} vertical={true}>
                    <span>Redis Version: 5.0.14</span>
                    <span>Memory Usage: 1.42GB</span>
                    <span>Keys: 4.75k</span>
                </Flex>
                <span>Ping: 3ms</span>
            </Flex>

            <Flex justify={"end"}>
                <Space>
                    <BsButton className={'test-connection-btn'} type={"default"} label={'Test connection'}/>
                    <BsButton className={'save-connection'} type={"submit"} label={'Save'}/>
                </Space>
            </Flex>

        </Flex>
    </>);
}

export default DataSourceType;