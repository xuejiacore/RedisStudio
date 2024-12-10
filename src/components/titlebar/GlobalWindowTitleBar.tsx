// noinspection HtmlUnknownBooleanAttribute

import React, {useRef, useState} from "react";
import "./index.less";
import {Col, Divider, Flex, Row, Space} from "antd";
import DatabaseNumberIcon from "../icons/DatabaseNumberIcon.tsx";
import {HistoryOutlined, LoadingOutlined, SettingOutlined} from "@ant-design/icons";
import {invoke} from "@tauri-apps/api/core";
import {DataSourceChangedEvent} from "../datasource/DataSourceChangedEvent.ts";
import CpuIcon from "../icons/CpuIcon.tsx";
import ClientsNumIcon from "../icons/ClientNumIcon.tsx";
import MetricIcon from "../icons/MetricIcon.tsx";
import {humanNumber, wrapColor} from "../../utils/Util.ts";
import {useEvent} from "../../utils/TauriUtil.tsx";
import {Popover} from "react-tiny-popover";
import DatasourceManagerHeader from "../datasource/dsdropdown/DatasourceManagerHeader.tsx";
import RecentDatasource from "../datasource/dsdropdown/RecentDatasource.tsx";
import DatabaseList from "../datasource/dsdbselector/DatabaseList.tsx";
import "../datasource/dsdropdown/index.less";

interface TitleBarProp {
    windowId: number,
    datasourceId?: number,
    datasource: number,
    database: number,
    host?: string,
    port?: number,
    dsname?: string,
    color?: string
}

const GlobalWindowTitleBar: React.FC<TitleBarProp> = (props, context) => {
    const [datasource, setDatasource] = useState(props.datasource);
    const [database, setDatabase] = useState(props.database);

    const [datasourceDropDown, setDatasourceDropDown] = useState(false);
    const [databaseDropDown, setDatabaseDropDown] = useState(false);
    const [datasourceName, setDatasourceName] = useState(props.dsname);
    const [datasourceColor, setDatasourceColor] = useState(wrapColor(props.color, props.datasourceId, props.host, props.port));

    const [cpuPercentage, setCpuPercentage] = useState('-%');
    const [clients, setClients] = useState(0);
    const [commands, setCommands] = useState('-');

    const lastStats = useRef<any>();
    const datasourceRef = useRef(datasource);
    const databaseRef = useRef(database);

    const [connectedStatus, setConnectedStatus] = useState('connected');
    const [reconnecting, setReconnecting] = useState(false);

    const [databaseKeySize, setDatabaseKeySize] = useState(0);
    const [datasourceInfo, setDatasourceInfo] = useState(`${props.host}:${props.port}`);

    useEvent('datasource/changed', event => {
        const payload: any = event.payload;
        if (payload.winId == props.windowId) {
            invoke('initialize_datasource_pattern', {
                datasource: payload.props.datasourceId
            }).then(r => {

            });
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
    });
    useEvent("datasource/database-changed", event => {
        const payload = event.payload as DataSourceChangedEvent;
        if (payload.winId == props.windowId) {
            setDatabase(payload.props.database);
            setDatabaseKeySize(payload.props.keySpac);
            lastStats.current = undefined;
            databaseRef.current = payload.props.database;
        }
    });
    useEvent("connection/lost", event => {
        const payload = event.payload as { database: number, datasource: number };

        if (datasourceRef.current === payload.datasource &&
            databaseRef.current === payload.database) {
            setConnectedStatus('disconnected');
        }
    });
    useEvent("datasource/info", event => {
        const payload: any = event.payload;
        if (parseInt(payload.datasource) === datasourceRef.current) {
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
    });

    const datasourceBackground = `linear-gradient(to right, ${datasourceColor}00, ${datasourceColor}50 25%, ${datasourceColor}00)`;

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
                        <Popover
                            isOpen={datasourceDropDown}
                            positions={['bottom']}
                            align={'start'}
                            onClickOutside={() => setDatasourceDropDown(false)}
                            content={({position, nudgedLeft, nudgedTop}) => <>
                                <div className={'datasource-dropdown-content'}>
                                    <div className={'content'}>
                                        <DatasourceManagerHeader/>
                                        <RecentDatasource datasourceId={datasource} winId={props.windowId}
                                                          onClose={() => setDatasourceDropDown(false)}/>
                                    </div>
                                </div>
                            </>
                            }>
                            <Space className={'selector'} onClick={e => setDatasourceDropDown((prev) => !prev)}>
                                <div className={'project-icon'} style={{background: datasourceColor}}>BS</div>
                                <div
                                    className={`project-name database-status ${connectedStatus}`}>{datasourceName}</div>
                                <div className={'down-arrow'}></div>
                            </Space>
                        </Popover>
                        <Popover
                            isOpen={databaseDropDown}
                            positions={['bottom']}
                            align={'start'}
                            onClickOutside={() => setDatabaseDropDown(false)}
                            content={({position, nudgedLeft, nudgedTop}) => <>
                                <div className={'datasource-dropdown-content'}>
                                    <div className={'content'}>
                                        <DatabaseList datasourceId={datasourceRef.current}
                                                      winId={props.windowId}
                                                      database={databaseRef.current}
                                                      onClose={() => setDatabaseDropDown(false)}/>
                                    </div>
                                </div>
                            </>}>
                            <Space className={'selector'} onClick={e => setDatabaseDropDown((prev) => !prev)}>
                                <Flex justify={"center"}>
                                    <DatabaseNumberIcon
                                        className={`database-number-icon database-status ${connectedStatus}`}
                                        onClick={e => {
                                            setTimeout(() => {
                                                setDatabaseDropDown((prev) => !prev)
                                            }, 80);
                                        }}
                                        style={{width: 12}}/>
                                    <div
                                        className={`database-number database-status ${connectedStatus}`}>{database}</div>
                                </Flex>
                                <div className={'down-arrow'}></div>
                            </Space>
                        </Popover>
                        <Flex justify={'center'} gap={5}>
                            <div className={`reconnect-btn ${connectedStatus}`} onClick={tryReconnect}>Reconnect</div>
                            <LoadingOutlined className={`connected-spin ${reconnecting ? '' : 'invisible'}`}
                                             spin={true}/>
                        </Flex>
                        <Flex>
                            <div className={'datasource-tag'}>PRO</div>
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