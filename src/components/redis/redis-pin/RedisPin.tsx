/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, {useEffect, useState} from "react";
import {invoke} from "@tauri-apps/api/core";
import "./RedisPin.less";
import "../index.less";
import HashOperator from "../type/hash/HashOperator.tsx";
import {useTranslation} from "react-i18next";
import "../../../utils/i18n.ts";
import {Flex, Skeleton} from "antd";
import StringOperator from "../type/string/StringOperator.tsx";
import ZSetOperator from "../type/zset/ZSetOperator.tsx";
import ListOperator from "../type/list/ListOperator.tsx";
import SetOperator from "../type/set/SetOperator.tsx";
import {ValueChanged} from "../watcher/ValueEditor.tsx";

interface RedisPinProp {

}

const RedisPin: React.FC<RedisPinProp> = (props, context) => {
    const {t} = useTranslation();
    // const keyName = window._REDIS_PIN_WIN_ATTR['key_name'];
    // const keyType = window._REDIS_PIN_WIN_ATTR['key_type'];
    const [keyType, setKeyType] = useState('undefined');
    const [currKeyName, setCurrKeyName] = useState('undefined');
    const [selectedField, setSelectedField] = useState<ValueChanged>();

    // useEffect(() => {
    //     // setTimeout(() => {
    //     //
    //     // }, 100);
    //     // invoke('show_redis_pushpin_window', {keyName}).then(e => {
    //     //     console.log('显示窗口，keyName = ' + keyName + ', keyType = ' + keyType);
    //     // });
    // }, []);

    // 定义方法
    const onKeyChange = (keyName: string, keyType: string) => {
        console.log("keyName = ", keyName, " keyType = ", keyType);
        setKeyType(keyType);
        setCurrKeyName(keyName);
    };

    useEffect(() => {
        // 将 funcFoo 绑定到 window 对象
        // @ts-ignore
        window.onKeyChange = onKeyChange;
        return () => {
            // @ts-ignore
            delete window.onKeyChange;
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
                                     onClose={onWindowClose}/>;
            break;
        case 'string':
            operator = <StringOperator data={nodeData}
                                       pinMode={true}
                                       onClose={onWindowClose}/>
            break;
        case 'zset':
            operator = <ZSetOperator data={nodeData}
                                     pinMode={true}
                                     onClose={onWindowClose}
                                     onFieldClicked={setSelectedField}/>;
            break;
        case 'set':
            operator = <SetOperator data={nodeData}
                                    pinMode={true}
                                    onClose={onWindowClose}
                                    onFieldClicked={setSelectedField}/>;
            break;
        case 'list':
            operator = <ListOperator data={nodeData}
                                     pinMode={true}
                                     onClose={onWindowClose}
                                     onFieldClicked={setSelectedField}/>;
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