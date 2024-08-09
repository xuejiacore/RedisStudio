import React, {useMemo} from "react";
import {useEffect, useState} from "react";
import "./App.less";
import {Tabs} from "antd";
import DataSource from "./components/datasource/DataSource";
import {invoke} from "@tauri-apps/api/core";
import Redis from "./components/redis/Redis.tsx";
import {isRegistered, register, ShortcutHandler, unregister} from '@tauri-apps/plugin-global-shortcut';
import RedisIcon from "./components/icons/RedisIcon.tsx";
import DatasourceIcon from "./components/icons/DatasourceIcon.tsx";

interface AppProp {
}

const App: (props: AppProp) => JSX.Element = (props: AppProp) => {
    const [greetMsg, setGreetMsg] = useState("");
    const [name, setName] = useState("");
    const [activityKey, setActivityKey] = useState("redis");

    // 注册全局快捷键
    const registerShortcut = (shortcut: string, handler: ShortcutHandler) => {
        isRegistered(shortcut).then(registered => {
            if (registered) {
                unregister(shortcut).then(v => {
                    register(shortcut, handler).then(() => {
                    });
                });
            } else {
                register(shortcut, handler).then(() => {
                });
            }
        })
    }

    useEffect(() => {
        // registerShortcut('CommandOrControl+K', () => {
        //     console.log('快捷键触发');
        //     invoke("open_spotlight_window").then(r => console.log("全局搜索窗口打开", r));
        // });
        return () => {
        }
    }, []);

    async function greet() {
        // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
        setGreetMsg(await invoke("greet", {name}));
    }

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
                    children: <>{
                        useMemo(() => {
                            return (<Redis dataSourceId={"localhost"}/>)
                        }, [])
                    }</>
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
