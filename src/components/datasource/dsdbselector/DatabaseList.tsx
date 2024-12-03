/* eslint-disable */
import React, {useEffect, useRef, useState} from "react";
import DatabaseItem from "./DatabaseItem.tsx";
import {Flex} from "antd";

import "./index.less";
import Scrollbar from "smooth-scrollbar";
import {Window} from "@tauri-apps/api/window";
import {emitTo} from "@tauri-apps/api/event";
import {DataSourceChangedEvent} from "../DataSourceChangedEvent.ts";
import {invoke} from "@tauri-apps/api/core";

interface DatabaseListProp {
}

interface Database {
    index: number;
    keys: number;
}

const DatabaseList: React.FC<DatabaseListProp> = (props, context) => {
    const containerRef = useRef(null);
    const scrollbarRef = useRef<Scrollbar>();
    const winIdRef = useRef(0);

    const datasourceRef = useRef('');
    const [databases, setDatabases] = useState<Database[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [databaseComs, setDatabaseComs] = useState<React.ReactNode>(<></>);

    const loadAllDatabase = (winId: number, selected: number, data: string, datasource: string, database_count: number) => {
        datasourceRef.current = datasource;
        const resp: Database[] = JSON.parse(data);
        const map = new Map();
        resp.forEach(d => {
            map.set(d.index, d);
        });

        let databases: Database[] = [];
        for (let i = 0; i < database_count; i++) {
            let t = map.get(i);
            if (t) {
                databases.push(t);
            } else {
                databases.push({
                    index: i,
                    keys: 0
                })
            }
        }

        winIdRef.current = winId;
        setSelectedIndex(selected);
        setDatabases(databases);
    };
    useEffect(() => {
        // @ts-ignore
        window.loadAllDatabase = loadAllDatabase;
        if (containerRef.current) {
            scrollbarRef.current = Scrollbar.init(containerRef.current, {
                damping: 0.1, // 设置滚动的阻尼大小
                thumbMinSize: 10, // 设置滚动条的最小大小
                alwaysShowTracks: false
            });
        }
        return () => {
            if (scrollbarRef.current) {
                scrollbarRef.current.destroy();
            }
            // @ts-ignore
            delete window.loadAllDatabase;
        };
    }, []);

    const onDatabaseSelected = (index: number, keys: number) => {
        setSelectedIndex(index);
        Window.getByLabel("datasource-database-selector").then(r => r?.hide());
        const payload: DataSourceChangedEvent = {
            winId: winIdRef.current,
            props: {
                datasourceId: 0,
                host: "localhost",
                port: 6379,
                database: index,
                keySpac: keys
            }
        }
        emitTo("main", "datasource/database-changed", payload).finally();
        invoke('change_active_datasource', {
            datasource: datasourceRef.current,
            defaultDatabase: index,
        }).finally();
    };

    useEffect(() => {
        const t = databases.map(d => {
            return (
                <DatabaseItem key={d.index}
                              database={d.index}
                              selected={d.index == selectedIndex}
                              key_size={d.keys}
                              onClick={e => onDatabaseSelected(d.index, d.keys)}
                />
            )
        });
        setDatabaseComs(t);
    }, [databases, selectedIndex]);
    return <>
        <Flex className={'database-list'} justify={"start"} align={"start"} vertical>
            <div ref={containerRef} className="scrollbar-container">
                <div className="scroll-content">
                    {databaseComs}
                </div>
            </div>
        </Flex>
    </>;
}

export default DatabaseList;