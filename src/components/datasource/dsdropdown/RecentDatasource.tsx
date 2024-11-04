/* eslint-disable */
import React, {useEffect, useRef} from "react";
import DatasourceItem, {Datasource} from "./DatasourceItem.tsx";
import {Flex} from "antd";
import "./index.less";
import Scrollbar from "smooth-scrollbar";
import {Window} from "@tauri-apps/api/window";
import {DataSourceChangedEvent} from "../DataSourceChangedEvent.ts";
import {emitTo} from "@tauri-apps/api/event";

interface RecentDatasourceProp {

}

const RecentDatasource: React.FC<RecentDatasourceProp> = (props, context) => {
    const containerRef = useRef(null);
    const scrollbarRef = useRef<Scrollbar>();
    const winIdRef = useRef(0);

    const loadAllDatasource = (winId: number, selected: string, data: string) => {
        winIdRef.current = winId;
    };

    useEffect(() => {
        // @ts-ignore
        window.loadAllDatasource = loadAllDatasource;
        if (containerRef.current) {
            scrollbarRef.current = Scrollbar.init(containerRef.current, {
                damping: 0.1, // 设置滚动的阻尼大小
                thumbMinSize: 10, // 设置滚动条的最小大小
                alwaysShowTracks: false
            });

            // 在组件销毁时销毁 Smooth Scrollbar
            return () => {
                // @ts-ignore
                delete window.loadAllDatasource;
                if (scrollbarRef.current) {
                    scrollbarRef.current.destroy();
                }
            };
        }
    }, []);

    const onDatasourceChange = (ds: Datasource) => {
        console.log("选中数据源：", ds, winIdRef.current);
        //setSelectedIndex(index);
        Window.getByLabel("datasource-dropdown").then(r => r?.hide());
        const payload: DataSourceChangedEvent = {
            winId: winIdRef.current,
            props: {
                datasourceId: ds.datasource,
                host: ds.host,
                port: ds.port,
                name: ds.name,
                dscolor: ds.dscolor,
                database: 0,
                keySpac: 0
            }
        }
        console.log(payload)
        emitTo("main", "datasource/changed", payload).finally();
    };

    return <>
        <Flex justify={"start"} align={"start"} vertical className={'datasource-list'}>
            <span className={'recent-datasource-label'}>Recent Sources</span>
            <div ref={containerRef} className="scrollbar-container">
                <div className="scroll-content">
                    <DatasourceItem name={'贪吃蛇测试服'}
                                    host={'172.31.86.29'}
                                    port={6379}
                                    datasourceId={'datasource01'}
                                    dscolor={'#51A374'}
                                    onClick={onDatasourceChange}
                    />
                    <DatasourceItem name={'测试服'}
                                    host={'172.31.65.68'}
                                    port={6379}
                                    datasourceId={'datasource02'}
                                    dscolor={'#BC50A7'}
                                    onClick={onDatasourceChange}
                    />
                </div>
            </div>
        </Flex>
    </>
        ;
}

export default RecentDatasource;