/* eslint-disable */
import React, {useEffect, useRef, useState} from "react";
import DatasourceItem, {Datasource} from "./DatasourceItem.tsx";
import {Flex} from "antd";
import "./index.less";
import Scrollbar from "smooth-scrollbar";
import {Window} from "@tauri-apps/api/window";
import {DataSourceChangedEvent} from "../DataSourceChangedEvent.ts";
import {emitTo} from "@tauri-apps/api/event";
import {DEFAULT_DATASOURCE_COLOR} from "../../../utils/RedisTypeUtil.ts";
import {hash} from "../../../utils/Util.ts";
import {invoke} from "@tauri-apps/api/core";

interface RecentDatasourceProp {
    winId: number;
    datasourceId: number;
    onClose?: () => void;
}

const RecentDatasource: React.FC<RecentDatasourceProp> = (props, context) => {
    const containerRef = useRef(null);
    const scrollbarRef = useRef<Scrollbar>();
    const [datasourceList, setDatasourceList] = useState<any[]>([]);

    const loadAllDatasource = (winId: number, selected: string, data: string) => {
        setDatasourceList(JSON.parse(data));
    };

    useEffect(() => {
        // @ts-ignore
        window.loadAllDatasource = loadAllDatasource;
        console.log("加载数据源-----------》》");
        if (containerRef.current) {
            scrollbarRef.current = Scrollbar.init(containerRef.current, {
                damping: 0.1, // 设置滚动的阻尼大小
                thumbMinSize: 10, // 设置滚动条的最小大小
                alwaysShowTracks: false
            });
        }

        invoke('get_datasource_list', {}).then((r: any) => {
            setDatasourceList(r);
        })
        // 在组件销毁时销毁 Smooth Scrollbar
        return () => {
            // @ts-ignore
            delete window.loadAllDatasource;
            if (scrollbarRef.current) {
                scrollbarRef.current.destroy();
            }
        };
    }, []);

    const onDatasourceChange = (ds: Datasource) => {
        props.onClose?.();
        const payload: DataSourceChangedEvent = {
            winId: props.winId,
            props: {
                datasourceId: ds.datasource,
                host: ds.host,
                port: ds.port,
                name: ds.name,
                dscolor: ds.dscolor,
                database: ds.default_database,
                keySpac: 0
            }
        }
        emitTo("main", "datasource/changed", payload).finally();
        invoke('change_active_datasource', {
            datasource: ds.datasource,
            defaultDatabase: ds.default_database,
        }).finally();
    };

    const wrapDatasourceColor = (color: string, ds: any) => {
        if (color) {
            return color;
        }
        const index = Math.abs(hash(`${ds.id}_${ds.host}_${ds.port}`) % DEFAULT_DATASOURCE_COLOR.length)
        return DEFAULT_DATASOURCE_COLOR[index];
    };

    return <>
        <Flex justify={"start"} align={"start"} vertical className={'datasource-list'}>
            <span className={'recent-datasource-label'}>Recent Sources</span>
            <div ref={containerRef} className="scrollbar-container">
                <div className="scroll-content">
                    {datasourceList.map(ds => {
                        return <DatasourceItem key={ds.id}
                                               name={ds.datasource_name}
                                               host={ds.host}
                                               port={ds.port}
                                               default_database={parseInt(ds.default_database)}
                                               datasourceId={ds.id}
                                               dscolor={wrapDatasourceColor(ds.color, ds)}
                                               onClick={onDatasourceChange}
                        />
                    })}
                </div>
            </div>
        </Flex>
    </>;
}

export default RecentDatasource;