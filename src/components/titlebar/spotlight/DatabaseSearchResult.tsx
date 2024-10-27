import React from "react";
import {Col, Row, Space} from "antd";
import "./DatabaseSearchResult.less";
import DatabaseNumberIcon from "../../icons/DatabaseNumberIcon.tsx";

interface DatabaseSearchResultProps {
    name: string;
    index: number;
    keys: number;
    active: boolean;
}

const DatabaseSearchResult: React.FC<DatabaseSearchResultProps> = (props, context) => {
    return <>
        <Row className={'datasource-search-result'} justify="space-between" align="middle">
            <Col className={"db-name"}>
                <Space className={'status-info'}>

                    <span className={`database-name ${props.active ? 'active' : ''}`}>
                        <DatabaseNumberIcon className={`database-number-icon`} style={{width: 14}}/>
                        <span className={"name"}>DB {props.index}</span>
                    </span>
                </Space>
            </Col>
            <Col className={'keys-desc'}>
                <span className={`keyspace ${props.active ? 'active' : ''}`}>{props.keys}</span>
            </Col>
        </Row>
    </>
}

export default DatabaseSearchResult;