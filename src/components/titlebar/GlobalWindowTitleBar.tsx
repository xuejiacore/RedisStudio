// noinspection HtmlUnknownBooleanAttribute

import React from "react";
import "./index.less";
import {Col, Flex, Row, Space} from "antd";
import DatabaseNumberIcon from "../icons/DatabaseNumberIcon.tsx";
import DisconnectedIcon from "../icons/DisconnectedIcon.tsx";

interface TitleBarProp {

}

const GlobalWindowTitleBar: React.FC<TitleBarProp> = (props, context) => {
    const connectedStatus = 'disconnected';
    return (
        <>
            <Row data-tauri-drag-region style={{background: '#2b2D30', borderBottom: '1px solid #1F1F226F'}}>
                <Col data-tauri-drag-region className={'window-title-bar-left-col'} span={6} offset={0}>
                    <Flex className={'project-selector'} gap={4} align='center' justify={'start'}>
                        <Space className={'selector'}>
                            <div className={'project-icon'}>BS</div>
                            <div className={'project-name'}>本地测试</div>
                            <div className={'down-arrow'}></div>
                        </Space>
                        <Space className={'selector'}>
                            <Flex justify={"center"}>
                                <DatabaseNumberIcon className='database-number-icon' style={{width: 12}}/>
                                <div className={'database-number'}>0</div>
                                <div className={'db-key-len'}>[2311]</div>
                            </Flex>
                            <div className={'down-arrow'}></div>
                        </Space>
                        <Flex>
                            <DisconnectedIcon className={`database-status ${connectedStatus}`} style={{width: 16}}/>
                        </Flex>
                    </Flex>
                </Col>
                <Col span={10} offset={2}>
                    <div className={'window-title-bar'} data-tauri-drag-region></div>
                </Col>
            </Row>
        </>
    )
};

export default GlobalWindowTitleBar;