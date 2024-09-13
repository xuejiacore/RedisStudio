import React from "react";
import {Col, Row, Space} from "antd";
import "./DatasourceSearchResult.less";

interface DatasourceSearchResultProp {
    hostport: string;
    desc: string;
    connected: boolean;
    global?: boolean;
}

const DatasourceSearchResult: React.FC<DatasourceSearchResultProp> = (props, context) => {
    return <>
        <Row className={'datasource-search-result'} justify="space-between" align="middle">
            <Col className={'host-port'}>
                <Space className={'status-info'}>
                    <div className={`connect-status ${props.connected ? 'connected' : ''}`}/>
                    <span className={"pattern"}>{props.hostport}</span>
                </Space>
            </Col>
            <Col className={'pattern-desc'}>
                <span className={"desc"}>{props.desc}</span>
            </Col>
        </Row>
    </>
}

export default DatasourceSearchResult;