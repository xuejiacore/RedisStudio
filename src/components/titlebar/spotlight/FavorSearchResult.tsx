import React from "react";
import {Col, Row, Space} from "antd";
import "./FavorSearchResult.less";
import {StarFilled} from "@ant-design/icons";

interface FavorSearchResultProp {
    keyName: string;
    type: string;
    exist?: boolean;
    global?: boolean;
}

const FavorSearchResult: React.FC<FavorSearchResultProp> = (props, context) => {
    return <>
        <Row className={'favor-search-result'} justify="space-between" align="middle">
            <Col>
                <span className={`key ${props.type} ${props.exist ? '' : 'not-exist'}`}>{props.keyName}</span>
            </Col>
            <Col>
                <Space>
                    <StarFilled className={`star-icon ${props.exist ? '' : 'not-exist'}`}/>
                    <span className={`type ${props.exist ? '' : 'not-exist'}`}>{props.type.toUpperCase()}</span>
                </Space>
            </Col>
        </Row>
    </>
}

export default FavorSearchResult;