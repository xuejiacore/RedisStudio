/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, {useEffect, useRef, useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import "./RedisPin.less";
import "../index.less";
import HashOperator from "../type/hash/HashOperator.tsx";
import {useTranslation} from "react-i18next";
import "../../../utils/i18n.ts";
import {Flex} from "antd";
import StringOperator from "../type/string/StringOperator.tsx";
import ZSetOperator from "../type/zset/ZSetOperator.tsx";
import ListOperator from "../type/list/ListOperator.tsx";
import SetOperator from "../type/set/SetOperator.tsx";
import {ValueChanged} from "../watcher/ValueEditor.tsx";
import {listen, UnlistenFn} from "@tauri-apps/api/event";
import {Window} from "@tauri-apps/api/window";

interface RedisPinProp {

}

const RedisPin: React.FC<RedisPinProp> = (props, context) => {
    const {t} = useTranslation();

    const [datasource, setDatasource] = useState('');
    const [database, setDatabase] = useState(0);
    const datasourceRef = useRef(datasource);
    const databaseRef = useRef(database);

    const [keyType, setKeyType] = useState('undefined');
    const [currKeyName, setCurrKeyName] = useState('undefined');
    const [selectedField, setSelectedField] = useState<ValueChanged>();

    // 定义方法
    const onKeyChange = (keyName: string, keyType: string, datasource: string, database: number) => {
        console.log("keyName = ", keyName, " keyType = ", keyType);
        setDatasource(datasource);
        setDatabase(database);
        datasourceRef.current = datasource;
        databaseRef.current = database;

        setKeyType(keyType);
        setCurrKeyName(keyName);
    };

    const removeListenerRef = useRef<UnlistenFn>();
    const removeListenerIdRef = useRef(0);
    useEffect(() => {

        // 将 funcFoo 绑定到 window 对象
        // @ts-ignore
        window.onKeyChange = onKeyChange;
        const ts = Date.now();
        const addListenerAsync = async () => {
            return new Promise<UnlistenFn>(resolve => {
                listen("operator/add_row", (event) => {
                    console.log("收到增加行消息", event);
                }, {
                    target: {
                        kind: 'Window',
                        label: Window.getCurrent().label
                    }
                }).then(unlistenFn => {
                    if (removeListenerIdRef.current != ts) {
                        resolve(unlistenFn);
                    } else {
                        unlistenFn();
                    }
                });
            });
        };
        (async () => {
            removeListenerRef.current = await addListenerAsync();
        })();
        /*

         */
        return () => {
            // @ts-ignore
            delete window.onKeyChange;
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

    const onWindowClose = () => {
        const onlyHide = true;
        invoke('close_redis_pushpin_window', {keyName: currKeyName, onlyHide}).then(() => {
        });
    };

    const emptyCallback = (e: any) => {
    };
    const nodeData = {key: currKeyName, keyType: keyType};

    let operator;
    switch (keyType) {
        case 'hash':
            operator = <HashOperator data={nodeData}
                                     pinMode={true}
                                     onFieldClicked={emptyCallback}
                                     onRowAdd={emptyCallback}
                                     onClose={onWindowClose}
                                     datasourceId={datasource}
                                     selectedDatabase={database}/>;
            break;
        case 'string':
            operator = <StringOperator data={nodeData}
                                       pinMode={true}
                                       onClose={onWindowClose}
                                       datasourceId={datasource}
                                       selectedDatabase={database}/>
            break;
        case 'zset':
            operator = <ZSetOperator data={nodeData}
                                     pinMode={true}
                                     onClose={onWindowClose}
                                     onFieldClicked={setSelectedField}
                                     datasourceId={datasource}
                                     selectedDatabase={database}/>;
            break;
        case 'set':
            operator = <SetOperator data={nodeData}
                                    pinMode={true}
                                    onClose={onWindowClose}
                                    onFieldClicked={setSelectedField}
                                    datasourceId={datasource}
                                    selectedDatabase={database}/>;
            break;
        case 'list':
            operator = <ListOperator data={nodeData}
                                     pinMode={true}
                                     onClose={onWindowClose}
                                     onFieldClicked={setSelectedField}
                                     datasourceId={datasource}
                                     selectedDatabase={database}/>;
            break;
    }

    return (
        <>
            <Flex className={'redis-push-pin-main'}>
                <div className={'redis-main-panel'}
                     data-tauri-drag-region="true">
                    <div className={'main-container pinned'} data-tauri-drag-region="true">
                        {operator}
                    </div>
                </div>
            </Flex>
        </>
    );
}

export default RedisPin;