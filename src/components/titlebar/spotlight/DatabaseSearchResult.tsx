import React from "react";
import {Col, Row, Space} from "antd";

interface DatabaseSearchResultProps {
    name: string;
    index: number;
    keys: number;
}

const DatabaseSearchResult: React.FC<DatabaseSearchResultProps> = (props, context) => {
    return <>
        <Row className={'datasource-search-result'} justify="space-between" align="middle">
            <Col className={'host-port'}>
                <Space className={'status-info'}>
                    <span className={"pattern"}>{props.name}</span>
                </Space>
            </Col>
            <Col className={'pattern-desc'}>
                <span className={"desc"}>{props.keys}</span>
            </Col>
        </Row>
    </>
}

export default DatabaseSearchResult;