// noinspection HtmlUnknownBooleanAttribute

import React, {useEffect, useRef, useState} from "react";
import "./index.less";
import {Col, Divider, Flex, Row, Space, Spin} from "antd";
import DatabaseNumberIcon from "../icons/DatabaseNumberIcon.tsx";
import {HistoryOutlined, LoadingOutlined, SettingOutlined} from "@ant-design/icons";
import {invoke} from "@tauri-apps/api/core";
import {listen, UnlistenFn} from "@tauri-apps/api/event";
import {DataSourceChangedEvent} from "../datasource/DataSourceChangedEvent.ts";

interface TitleBarProp {
    windowId: number;
}

const GlobalWindowTitleBar: React.FC<TitleBarProp> = (props, context) => {
    const [datasource, setDatasource] = useState('datasource01');
    const [database, setDatabase] = useState(0);
    const datasourceRef = useRef(datasource);
    const databaseRef = useRef(database);

    const [connectedStatus, setConnectedStatus] = useState('connected');
    const [reconnecting, setReconnecting] = useState(false);

    const [databaseKeySize, setDatabaseKeySize] = useState(0);
    const [datasourceInfo, setDatasourceInfo] = useState('172.31.86.29:6379');

    const removeListenerRef = useRef<UnlistenFn>();
    const removeListenerIdRef = useRef(0);
    useEffect(() => {
        const ts = Date.now();
        const addListenerAsync = async () => {
            return new Promise<UnlistenFn>(resolve => {
                const resolveFn = (unlistenFn: UnlistenFn) => {
                    if (removeListenerIdRef.current != ts) {
                        //loadData();
                        resolve(unlistenFn);
                    } else {
                        unlistenFn();
                    }
                };

                listen('datasource/changed', (event) => {
                    const payload: any = event.payload;
                    if (payload.winId == props.windowId) {
                        setDatasource(payload.datasource);
                        datasourceRef.current = payload.datasource;
                        setDatasourceInfo(payload.host + ":" + payload.port);
                    }
                }).then(resolveFn);

                listen("datasource/database-changed", (event) => {
                    const payload = event.payload as DataSourceChangedEvent;
                    if (payload.winId == props.windowId) {
                        setDatabase(payload.props.database);
                        databaseRef.current = payload.props.database;
                        setDatabaseKeySize(payload.props.keySpac);
                    }
                }).then(resolveFn);

                listen("connection/lost", (event) => {
                    const payload = event.payload as { database: number, datasource: string };

                    if (datasourceRef.current === payload.datasource &&
                        databaseRef.current === payload.database) {
                        setConnectedStatus('disconnected');
                    }
                }).then(resolveFn);
            });
        };
        (async () => {
            removeListenerRef.current = await addListenerAsync();
        })();
        return () => {
            removeListenerIdRef.current = ts;
            const removeListenerAsync = async () => {
                return new Promise<void>(resolve => {
                    if (removeListenerRef.current) {
                        removeListenerRef.current();
                    }
                    resolve();
                })
            }
            removeListenerAsync().finally();
        };
    }, []);

    const datasourceColor = '#0099cc';
    const datasourceBackground = `linear-gradient(to right, ${datasourceColor}00, ${datasourceColor}50 25%, ${datasourceColor}00)`;

    const onDatasourceClick = (event: React.MouseEvent<HTMLDivElement>) => {
        // 获取触发事件的元素
        const targetElement = event.currentTarget as HTMLDivElement;
        // 获取元素的位置和尺寸
        const rect = targetElement.getBoundingClientRect();
        // 计算左下角的坐标
        const leftBottomX = rect.left;
        const leftBottomY = rect.top + rect.height;
        invoke('open_datasource_window', {
            datasourceId: datasource,
            winId: props.windowId,
            x: leftBottomX,
            y: leftBottomY
        }).finally();
    };
    const onDatabaseSelectorClick = (event: React.MouseEvent<HTMLDivElement>) => {
        // 获取触发事件的元素
        const targetElement = event.currentTarget as HTMLDivElement;
        // 获取元素的位置和尺寸
        const rect = targetElement.getBoundingClientRect();
        // 计算左下角的坐标
        const leftBottomX = rect.left;
        const leftBottomY = rect.top + rect.height;

        invoke('open_database_selector_window', {
            datasourceId: datasourceRef.current,
            database: databaseRef.current,
            winId: props.windowId,
            x: leftBottomX,
            y: leftBottomY
        }).finally();
    }

    const tryReconnect = () => {
        setReconnecting(true);
        invoke('reconnect_redis', {
            datasource: datasourceRef.current,
            database: databaseRef.current
        }).then(r => {
            const resp = JSON.parse(r as string) as { success: boolean };
            if (resp.success) {
                setConnectedStatus('connected');
            }
            setReconnecting(false);
        });
    };

    return (
        <>
            <Row data-tauri-drag-region style={{background: '#2b2D30', borderBottom: '1px solid #1F1F226F'}}>
                <Col data-tauri-drag-region style={{background: datasourceBackground}}
                     className={'window-title-bar-left-col'} span={6} offset={0}>
                    <Flex className={'project-selector'} gap={4} align='center' justify={'start'}>
                        <Space className={'selector'} onClick={onDatasourceClick}>
                            <div className={'project-icon'} style={{background: datasourceColor}}>BS</div>
                            <div className={`project-name database-status ${connectedStatus}`}>Localhost</div>
                            <div className={'down-arrow'}></div>
                        </Space>
                        <Space className={'selector'} onClick={onDatabaseSelectorClick}>
                            <Flex justify={"center"}>
                                <DatabaseNumberIcon
                                    className={`database-number-icon database-status ${connectedStatus}`}
                                    style={{width: 14}}/>
                                <div className={`database-number database-status ${connectedStatus}`}>{database}</div>
                            </Flex>
                            <div className={'down-arrow'}></div>
                        </Space>
                        <Flex justify={'center'} gap={5}>
                            <div className={`reconnect-btn ${connectedStatus}`} onClick={tryReconnect}>Reconnect</div>
                            <LoadingOutlined className={`connected-spin ${reconnecting ? '' : 'invisible'}`} spin={true}/>
                        </Flex>
                    </Flex>
                </Col>
                <Col span={12}>
                    <div className={'window-title-bar'} data-tauri-drag-region>
                        {/*<SpotlightAutoComplete/>*/}
                    </div>
                </Col>
                <Col span={6}>
                    <div className={'window-title-bar'} data-tauri-drag-region>
                        <Flex gap={2} className={'setting-tools'} align={'center'} justify={'end'}
                              data-tauri-drag-region>
                            <span className={'host-port'}>{datasourceInfo}</span>
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