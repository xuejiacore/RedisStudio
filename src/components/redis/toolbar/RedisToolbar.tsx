import React, {useEffect, useRef, useState} from "react";
import "./RedisToolbar.less";
import {
    CloseOutlined,
    CopyOutlined,
    FieldTimeOutlined,
    HeartFilled,
    PushpinFilled,
    ReloadOutlined, SaveOutlined,
    ShrinkOutlined
} from "@ant-design/icons";
import {Col, Row, Space} from "antd";
import {writeText} from "@tauri-apps/plugin-clipboard-manager";
import {invoke} from "@tauri-apps/api/core";
import {listen, UnlistenFn} from "@tauri-apps/api/event";

interface RedisToolbarProps {
    keyName: string;
    keyType: string;
    pinMode?: boolean;
    onClose?: React.MouseEventHandler<HTMLSpanElement>;
    onReload?: () => void;
}

const RedisToolbar: React.FC<RedisToolbarProps> = (props, context) => {
    const currKeyName = useRef(props.keyName);
    const [tipsVisible, setTipsVisible] = useState('hidden');
    const [favorBtnSelected, setFavorBtnSelected] = useState(''); // selected
    const [pushpinBtnSelected, setPushpinBtnSelected] = useState(''); // selected
    const [payAttentionState, setPayAttentionState] = useState(props.pinMode);
    const [isFocusedWindow, setIsFocusedWindow] = useState(1);
    const [autoRefresh, setAutoRefresh] = useState('');

    const removeListenerRef = useRef<UnlistenFn>();
    const removeListenerIdRef = useRef(0);
    useEffect(() => {
        const ts = Date.now();
        const addListenerAsync = async () => {
            return new Promise<UnlistenFn>(resolve => {
                listen("redis_pushpin_hidden", (event) => {
                    const closedKeyName = event.payload;
                    if (closedKeyName == currKeyName.current) {
                        setPushpinBtnSelected('');
                    } else {
                        const onlyHide = false;
                        invoke('close_redis_pushpin_window', {'keyName': closedKeyName, onlyHide}).then(() => {
                            console.log('关闭上一个窗口完成 ' + closedKeyName);
                        });
                    }
                }).then(unlistenFn => {
                    if (removeListenerIdRef.current != ts) {
                        resolve(unlistenFn);
                    } else {
                        unlistenFn();
                    }
                })
            })
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

            removeListenerAsync().then(t => {
            });
        }
    }, []);

    useEffect(() => {
        const keyName = props.keyName;
        invoke('on_redis_pushpin_window_shown', {keyName}).then(r => {
            setPushpinBtnSelected((r === 'true') ? 'selected' : '');
        });
        currKeyName.current = keyName;
    }, [props.keyName]);

    const onClickCopyKeyName = (e: any) => {
        writeText(props.keyName).then(r => {
            setTipsVisible('show');
            setTimeout(() => {
                setTipsVisible('hidden');
            }, 1200);
        });
    }

    const onPushpin = (e: React.MouseEvent, keyName: string) => {
        const keyType = props.keyType;
        invoke('open_redis_pushpin_window', {keyName, keyType}).then(e => {
            setPushpinBtnSelected('selected');
        });
    };

    const onAutoReloadClick = (e: React.MouseEvent, keyName: string) => {
        invoke('show_auto_refresh_menu', {
            x: e.clientX,
            y: e.clientY
        }).then(r => {
            if (autoRefresh == 'selected') {
                setAutoRefresh('');
            } else {
                setAutoRefresh('selected');
            }
        });
    };

    const onFavorClick = (e: React.MouseEvent, keyName: string) => {
        if (favorBtnSelected == 'selected') {
            setFavorBtnSelected('');
        } else {
            setFavorBtnSelected('selected');
        }
    };

    let tools;
    if (props.pinMode) {
        tools = (<>
            {/*<div className={props.keyType + (payAttentionState ? ' pin-attention' : ' ')}></div>*/}
            <ReloadOutlined className={`toolbar-btn refresh-btn`} onClick={props.onReload}/>
            <SaveOutlined className={'toolbar-btn save-btn'}/>
            <CloseOutlined className={`toolbar-btn close-btn`} onClick={props.onClose}/>
        </>);
    } else {
        tools = (<>
            <ReloadOutlined className={'toolbar-btn refresh-btn'} onClick={props.onReload}/>
            <SaveOutlined className={'toolbar-btn save-btn'}/>
            <FieldTimeOutlined className={`toolbar-btn auto-refresh-btn ${autoRefresh}`}
                               onClick={e => onAutoReloadClick(e, props.keyName)}/>
            <HeartFilled className={`toolbar-btn favor-btn ${favorBtnSelected}`}
                         onClick={e => onFavorClick(e, props.keyName)}/>
            <PushpinFilled className={`toolbar-btn pushpin-btn ${pushpinBtnSelected}`}
                           onClick={e => onPushpin(e, props.keyName)}/>
        </>);
    }

    return (<>
        <div className={'redis-toolbar ' + (props.pinMode ? 'pin-draggable' : '')}
             {...(props.pinMode ? {'data-tauri-drag-region': ''} : {})}>
            <Row>
                <Col span={12} {...(props.pinMode ? {'data-tauri-drag-region': ''} : {})}>
                    <Space>
                        <div className={"key-copier toolbar-key-name" + ` ${props.keyType}`}
                             onClick={onClickCopyKeyName}
                             {...(props.pinMode ? {'data-tauri-drag-region': ''} : {})}>
                            <Space>
                                <div {...(props.pinMode ? {'data-tauri-drag-region': ''} : {})}>
                                    {props.keyName}
                                </div>
                                <CopyOutlined {...(props.pinMode ? {'data-tauri-drag-region': ''} : {})}/>
                            </Space>
                        </div>
                        <div
                            className={'tips-info ' + tipsVisible}
                            {...(props.pinMode ? {'data-tauri-drag-region': ''} : {})}>
                            <span {...(props.pinMode ? {'data-tauri-drag-region': ''} : {})}>
                                copied!
                            </span>
                        </div>
                    </Space>
                </Col>
                <Col span={8} {...(props.pinMode ? {'data-tauri-drag-region': ''} : {})}>
                </Col>
                <Col span={4} {...(props.pinMode ? {'data-tauri-drag-region': ''} : {})}>
                    <Space className={'toolbar-operator'}>{tools}</Space>
                </Col>
            </Row>
        </div>
    </>)
}

export default RedisToolbar;