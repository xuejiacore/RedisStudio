import React from "react";
import {Col, Row, Space} from "antd";
import "./RecentlySearchResult.less";
import {ExportOutlined} from "@ant-design/icons";

interface KeySearchResultProp {
    keyName: string;
    type: string;
    exist?: boolean;
    global?: boolean;
}

const RecentlySearchResult: React.FC<KeySearchResultProp> = (props, context) => {

    return <>
        <Row className={'recently-search-result'} justify="space-between" align="middle">
            <Col>
                <span className={`key ${props.type} ${props.exist ? '' : 'not-exist'}`}>{props.keyName}</span>
            </Col>
            <Col>
                <Space>
                    <ExportOutlined className={'export-icon'}/>
                    <span className={"type"}></span>
                </Space>
            </Col>
        </Row>
    </>
}

export default RecentlySearchResult;