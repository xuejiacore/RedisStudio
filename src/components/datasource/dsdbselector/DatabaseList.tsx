/* eslint-disable */
import React, {useEffect, useRef, useState} from "react";
import DatabaseItem from "./DatabaseItem.tsx";
import {Flex} from "antd";

import Scrollbar from "smooth-scrollbar";
import {Window} from "@tauri-apps/api/window";
import {emitTo} from "@tauri-apps/api/event";
import {DataSourceChangedEvent} from "../DataSourceChangedEvent.ts";
import {invoke} from "@tauri-apps/api/core";

interface DatabaseListProp {
    datasourceId: number;
    database: number;
    winId: number;
    onClose?: () => void;
}

interface Database {
    index: number;
    keys: number;
}

const DatabaseList: React.FC<DatabaseListProp> = (props, context) => {
    const containerRef = useRef(null);
    const scrollbarRef = useRef<Scrollbar>();

    const [datasource, setDatasource] = useState(props.datasourceId);
    const [database, setDatabase] = useState(props.database);

    const datasourceRef = useRef(datasource);
    const databaseRef = useRef(database);

    useEffect(() => {
        datasourceRef.current = props.datasourceId;
        databaseRef.current = props.database;

        setDatasource(datasourceRef.current);
        setDatabase(databaseRef.current);
    }, [props.datasourceId, props.database]);

    const [databases, setDatabases] = useState<Database[]>([]);
    const [databaseComs, setDatabaseComs] = useState<React.ReactNode>(<></>);

    useEffect(() => {
        if (containerRef.current) {
            scrollbarRef.current = Scrollbar.init(containerRef.current, {
                damping: 0.1, // 设置滚动的阻尼大小
                thumbMinSize: 10, // 设置滚动条的最小大小
                alwaysShowTracks: false
            });
        }
        invoke('list_database_list', {
            datasource: datasourceRef.current,
            database: databaseRef.current,
        }).then((r: any) => {
            const resp: Database[] = r.key_space_info;
            const map = new Map();
            resp.forEach(d => {
                map.set(d.index, d);
            });

            let databases: Database[] = [];
            for (let i = 0; i < r.database_count; i++) {
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

            setDatabases(databases);
        });

        return () => {
            if (scrollbarRef.current) {
                scrollbarRef.current.destroy();
            }
        };
    }, []);

    const onDatabaseSelected = (index: number, keys: number) => {
        props.onClose?.();
        const payload: DataSourceChangedEvent = {
            winId: props.winId,
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
                              selected={d.index == databaseRef.current}
                              key_size={d.keys}
                              onClick={e => onDatabaseSelected(d.index, d.keys)}
                />
            )
        });
        setDatabaseComs(t);
    }, [databases, props.database]);
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