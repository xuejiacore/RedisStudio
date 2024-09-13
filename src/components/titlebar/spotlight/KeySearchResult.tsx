import React from "react";
import {Col, Row, Space} from "antd";
import "./KeySearchResult.less";
import {ExportOutlined} from "@ant-design/icons";

interface KeySearchResultProp {
    keyName: string;
    type: string;
    global?: boolean;
}

const KeySearchResult: React.FC<KeySearchResultProp> = (props, context) => {

    return <>
        <Row className={'key-search-result'} justify="space-between" align="middle">
            <Col>
                <span className={`key ${props.type}`}>{props.keyName}</span>
            </Col>
            <Col>
                <Space>
                    <ExportOutlined className={'export-icon'}/>
                    <span className={"type"}>{props.type.toUpperCase()}</span>
                </Space>
            </Col>
        </Row>
    </>
}

export default KeySearchResult;