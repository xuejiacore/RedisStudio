import {Col, Row} from "antd";
import React from "react";
import DataSourceConfig from "./DataSourceConfig";
import DataSourceTree from "./DataSourceTree.tsx";

const DataSource: React.FC = () => {
    return (<>
        <Row className={'datasource'}>
            <Col span={6}>
                <DataSourceTree/>
            </Col>
            <Col span={18}>
                <DataSourceConfig/>
            </Col>
        </Row>
    </>);
}

export default DataSource;
