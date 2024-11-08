import {Splitter} from "antd";
import React from "react";
import DataSourceConfig from "./DataSourceConfig";
import DataSourceTree from "./DataSourceTree.tsx";

const DataSource: React.FC = () => {
    return (<>
        <Splitter className={'datasource'}>
            <Splitter.Panel defaultSize="26%" min="20%" max="40%">
                <DataSourceTree/>

            </Splitter.Panel>
            <Splitter.Panel>
                <DataSourceConfig/>
            </Splitter.Panel>
        </Splitter>
    </>);
}

export default DataSource;
