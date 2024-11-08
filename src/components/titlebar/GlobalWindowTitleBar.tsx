// noinspection HtmlUnknownBooleanAttribute

import React, {useEffect, useRef, useState} from "react";
import "./index.less";
import {Col, Divider, Flex, Row, Space} from "antd";
import DatabaseNumberIcon from "../icons/DatabaseNumberIcon.tsx";
import {HistoryOutlined, LoadingOutlined, SettingOutlined} from "@ant-design/icons";
import {invoke} from "@tauri-apps/api/core";
import {listen, UnlistenFn} from "@tauri-apps/api/event";
import {DataSourceChangedEvent} from "../datasource/DataSourceChangedEvent.ts";
import CpuIcon from "../icons/CpuIcon.tsx";
import ClientsNumIcon from "../icons/ClientNumIcon.tsx";
import MetricIcon from "../icons/MetricIcon.tsx";
import {humanNumber} from "../../utils/Util.ts";

interface TitleBarProp {
    windowId: number;
}

const GlobalWindowTitleBar: React.FC<TitleBarProp> = (props, context) => {
    const [datasource, setDatasource] = useState('1');
    const [database, setDatabase] = useState(0);
    const [datasourceName, setDatasourceName] = useState('Localhost');
    const [datasourceColor, setDatasourceColor] = useState('#0099cc');

    const [cpuPercentage, setCpuPercentage] = useState('-%');
    const [clients, setClients] = useState(0);
    const [commands, setCommands] = useState('-');

    const lastStats = useRef<any>();
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

                listen('datasource/changed', event => {
                    const payload: any = event.payload;
                    if (payload.winId == props.windowId) {
                        setDatasource(payload.props.datasourceId);
                        datasourceRef.current = payload.props.datasourceId;
                        setDatasourceInfo(payload.props.host + ":" + payload.props.port);
                        setDatasourceName(payload.props.name);
                        setDatasourceColor(payload.props.dscolor);
                        setDatabaseKeySize(payload.props.keySpac);
                        setDatabase(payload.props.database);
                        setClients(0);
                        setCpuPercentage("-%");
                        setCommands("-");
                        lastStats.current = undefined;
                        databaseRef.current = payload.props.database;
                    }
                }).then(resolveFn);

                listen("datasource/database-changed", event => {
                    const payload = event.payload as DataSourceChangedEvent;
                    if (payload.winId == props.windowId) {
                        setDatabase(payload.props.database);
                        setDatabaseKeySize(payload.props.keySpac);
                        lastStats.current = undefined;
                        databaseRef.current = payload.props.database;
                    }
                }).then(resolveFn);

                listen("connection/lost", event => {
                    const payload = event.payload as { database: number, datasource: string };

                    if (datasourceRef.current === payload.datasource &&
                        databaseRef.current === payload.database) {
                        setConnectedStatus('disconnected');
                    }
                }).then(resolveFn);

                listen("datasource/info", event => {
                    const payload: any = event.payload;
                    if (payload.datasource === datasourceRef.current) {
                        if (lastStats.current) {
                            const last = lastStats.current;
                            const diff_ts = payload.sample_ts - last.sample_ts - 200;

                            const percentage = (payload.info.cpu.used_cpu_sys + payload.info.cpu.used_cpu_user
                                - last.info.cpu.used_cpu_sys - last.info.cpu.used_cpu_user) / (diff_ts / 1000) * 100;
                            setCpuPercentage((percentage <= 0 ? 0 : percentage.toFixed(2)) + "%");
                            const commandProcessed = (payload.info.stats.total_commands_processed - last.info.stats.total_commands_processed) / (diff_ts / 1000);
                            setCommands(commandProcessed <= 0 ? '0' : humanNumber(parseInt(commandProcessed.toFixed(0))));
                        }

                        setClients(payload.info.clients.connected_clients);
                        lastStats.current = payload;
                    }
                }).then(resolveFn)
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
            datasourceId: datasourceRef.current,
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
                     className={'window-title-bar-left-col'} span={8} offset={0}>
                    <Flex className={'project-selector'} gap={4} align='center' justify={'start'}>
                        <Space className={'selector'} onClick={onDatasourceClick}>
                            <div className={'project-icon'} style={{background: datasourceColor}}>BS</div>
                            <div className={`project-name database-status ${connectedStatus}`}>{datasourceName}</div>
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
                            <LoadingOutlined className={`connected-spin ${reconnecting ? '' : 'invisible'}`}
                                             spin={true}/>
                        </Flex>
                    </Flex>
                </Col>
                <Col span={16}>
                    <div className={'window-title-bar'} data-tauri-drag-region>
                        <Flex gap={2} className={'setting-tools'} align={'center'} justify={'end'}
                              data-tauri-drag-region>
                            <Space>
                                <div className={'metric-item cpu'}>
                                    <CpuIcon className={'metric-icon cpu'}/>
                                    <span className={'metric-value cpu'}>{cpuPercentage}</span>
                                </div>

                                <div className={'metric-item io'}>
                                    <MetricIcon className={'metric-icon metric'}/>
                                    <span className={'metric-value metric'}>{commands}</span>
                                </div>

                                <div className={'metric-item clients'}>
                                    <ClientsNumIcon className={'metric-icon clients'}/>
                                    <span className={'metric-value clients'}>{clients === 0 ? '-' : clients}</span>
                                </div>
                            </Space>

                            <Divider type="vertical"/>
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