import React, {useEffect, useRef, useState} from "react";
import "./App.less";
import {Tabs} from "antd";
import DataSource from "./components/datasource/DataSource";
import Redis from "./components/redis/Redis.tsx";
import RedisIcon from "./components/icons/RedisIcon.tsx";
import DatasourceIcon from "./components/icons/DatasourceIcon.tsx";
import {listen, UnlistenFn} from "@tauri-apps/api/event";
import {DataSourceChangedEvent} from "./components/datasource/DataSourceChangedEvent.ts";

interface AppProp {
    windowId: number;
}

const App: (props: AppProp) => JSX.Element = (props: AppProp) => {
    // change default datasource and database index
    const [activityKey, setActivityKey] = useState("redis");
    const [datasourceId, setDatasourceId] = useState('1');
    const [database, setDatabase] = useState(0);

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
                        setDatasourceId(payload.props.datasourceId);
                        setDatabase(payload.props.database);
                    }
                }).then(resolveFn);

                listen("datasource/database-changed", event => {
                    const payload = event.payload as DataSourceChangedEvent;
                    if (payload.winId == props.windowId) {
                        setDatabase(payload.props.database);
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

    const activatedColor = '#DBDDE2';
    const deactivatedColor = '#5E5F62';
    const colorFn = (currentKey: string, targetKey: string) => {
        if (currentKey === targetKey) {
            return activatedColor;
        } else {
            return deactivatedColor;
        }
    }

    return (<>
        <Tabs
            id='mainTab'
            tabPosition='left'
            size={'small'}
            onChange={activityKey => {
                setActivityKey(activityKey)
            }}
            items={[
                {
                    label: <><RedisIcon style={{width: '15px', color: colorFn(activityKey, 'redis')}}/></>,
                    key: 'redis',
                    children: <><Redis windowId={props.windowId}
                                       datasourceId={datasourceId}
                                       selectedDatabase={database}/></>
                },
                {
                    label: <><DatasourceIcon style={{width: '15px', color: colorFn(activityKey, 'datasource')}}/></>,
                    key: 'datasource',
                    children: <><DataSource/></>,
                },
            ]}
        />
    </>);
}

export default App;
