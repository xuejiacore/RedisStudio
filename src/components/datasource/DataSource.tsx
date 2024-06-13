import {Col, Row} from "antd";
import React, {useState} from "react";
import "./DataSource.less";
import DataSourceConfig from "./DataSourceConfig";
import DataSourceTree from "./DataSourceTree.tsx";

const DataSource: React.FC = () => {
    const [greetMsg, setGreetMsg] = useState("");
    const [name, setName] = useState("");

    return (<>
        <Row>
            <Col span={6} className={'datasource-tree-panel'}>
                <DataSourceTree/>
            </Col>
            <Col span={18}>
                <DataSourceConfig/>
            </Col>
        </Row>
    </>);
}

export default DataSource;
