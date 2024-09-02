import React from "react";
import {Col, Row} from "antd";
import "./KeyPatternSearchResult.less";

interface KeyPatternSearchResultProp {
    pattern: string;
    desc: string;
}

const KeyPatternSearchResult: React.FC<KeyPatternSearchResultProp> = (props, context) => {
    return <>
        <Row className={'key-pattern-search-result'} justify="space-between" align="middle">
            <Col>
                <span className={"pattern"}>{props.pattern}</span>
            </Col>
            <Col className={'pattern-desc'}>
                <span className={"desc"}>{props.desc}</span>
            </Col>
        </Row>
    </>
}

export default KeyPatternSearchResult;