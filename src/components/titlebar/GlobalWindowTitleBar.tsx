// noinspection HtmlUnknownBooleanAttribute

import React from "react";
import "./index.less";
import {Col, Divider, Flex, Row, Space} from "antd";
import DatabaseNumberIcon from "../icons/DatabaseNumberIcon.tsx";
import DisconnectedIcon from "../icons/DisconnectedIcon.tsx";
import SpotlightSearch from "./spotlight/SpotlightSearch.tsx";
import {HistoryOutlined, SettingOutlined} from "@ant-design/icons";
import {invoke} from "@tauri-apps/api/core";

interface TitleBarProp {

}

const GlobalWindowTitleBar: React.FC<TitleBarProp> = (props, context) => {
    const connectedStatus = 'disconnected';
    const datasourceColor = '#0099cc';
    const datasourceBackground = `linear-gradient(to right, ${datasourceColor}00, ${datasourceColor}50 25%, ${datasourceColor}00)`;
    const onDatasourceClick = (event: React.MouseEvent<HTMLDivElement>) => {
        // 获取触发事件的元素
        const targetElement = event.currentTarget as HTMLDivElement;

        // 获取元素的位置和尺寸
        const rect = targetElement.getBoundingClientRect();
        console.log(`点击的位置：(${event.screenX}, ${event.screenY})`);
        console.log("元素的位置和尺寸", rect);
        // 计算左下角的坐标
        const leftBottomX = rect.left;
        const leftBottomY = rect.top + rect.height;

        console.log(`点击的位置：(${leftBottomX}, ${leftBottomY})`);
        invoke('open_datasource_window', {x: leftBottomX, y: leftBottomY}).then(r => {
            console.log(`========>> 打开数据源 ${r}`)
        })
    };
    const onDatabaseSelectorClick = (event: React.MouseEvent<HTMLDivElement>) => {
        // 获取触发事件的元素
        const targetElement = event.currentTarget as HTMLDivElement;

        // 获取元素的位置和尺寸
        const rect = targetElement.getBoundingClientRect();
        console.log(`点击的位置：(${event.screenX}, ${event.screenY})`);
        console.log("元素的位置和尺寸", rect);
        // 计算左下角的坐标
        const leftBottomX = rect.left;
        const leftBottomY = rect.top + rect.height;

        console.log(`点击的位置：(${leftBottomX}, ${leftBottomY})`);
        invoke('open_database_selector_window', {x: leftBottomX, y: leftBottomY}).then(r => {
            console.log(`========>> 打开数据源 ${r}`)
        })
    }
    return (
        <>
            <Row data-tauri-drag-region style={{background: '#2b2D30', borderBottom: '1px solid #1F1F226F'}}>
                <Col data-tauri-drag-region style={{background: datasourceBackground}}
                     className={'window-title-bar-left-col'} span={6} offset={0}>
                    <Flex className={'project-selector'} gap={4} align='center' justify={'start'}>
                        <Space className={'selector'} onClick={onDatasourceClick}>
                            <div className={'project-icon'} style={{background: datasourceColor}}>BS</div>
                            <div className={'project-name'}>Localhost</div>
                            <div className={'down-arrow'}></div>
                        </Space>
                        <Space className={'selector'} onClick={onDatabaseSelectorClick}>
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
                <Col span={12}>
                    <div className={'window-title-bar'} data-tauri-drag-region>
                        <SpotlightSearch/>
                    </div>
                </Col>
                <Col span={6}>
                    <div className={'window-title-bar'} data-tauri-drag-region>
                        <Flex gap={2} className={'setting-tools'} align={'center'} justify={'end'}
                              data-tauri-drag-region>
                            <span className={'host-port'}>172.31.86.29:6379</span>
                            <Divider type="vertical"/>
                            <HistoryOutlined className={'tool-icon'}/>
                            <SettingOutlined className={'tool-icon'}/>
                        </Flex>
                    </div>
                </Col>
            </Row>
        </>
    )
};

export default GlobalWindowTitleBar;