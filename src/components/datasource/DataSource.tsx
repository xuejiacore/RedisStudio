import {Flex, Splitter} from "antd";
import React, {useEffect, useRef, useState} from "react";
import DataSourceConfig from "./DataSourceConfig";
import DataSourceTree from "./DataSourceTree.tsx";
import {CopyOutlined, MinusOutlined, PlusOutlined} from "@ant-design/icons";
import "./DataSource.less";

interface DataSourceProps {
    datasource?: number;
}
const DataSource: React.FC<DataSourceProps> = (props, context) => {
    const [datasource, setDatasource] = useState(props.datasource);

    useEffect(() => {
        setDatasource(datasource);
    }, [props.datasource]);
    const [datasourceId, setDatasourceId] = useState(-1);
    const onDatasourceSelected = (dsId: number) => {
        setDatasourceId(dsId);
    };

    const onAddDatasource = () => {
        setDatasourceId(-1);
    };

    return (<>
        <Splitter className={'datasource'}>
            <Splitter.Panel className={'datasource-left-panel'} defaultSize="26%" min="20%" max="40%">
                <Flex justify={'center'} vertical={true}>
                    <Flex className={'datasource-operators'} justify={'start'} align={'center'}>
                        <PlusOutlined className={'tool-icon'} onClick={onAddDatasource}/>
                        <MinusOutlined className={'tool-icon'}/>
                        <CopyOutlined className={'tool-icon'}/>
                    </Flex>
                    <DataSourceTree onSelected={onDatasourceSelected} datasource={datasource}/>
                </Flex>
            </Splitter.Panel>
            <Splitter.Panel>
                <DataSourceConfig datasource={datasourceId}/>
            </Splitter.Panel>
        </Splitter>
    </>);
}

export default DataSource;
