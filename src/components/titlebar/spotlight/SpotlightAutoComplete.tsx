/* eslint-disable @typescript-eslint/no-this-alias */
import React, {useEffect, useRef, useState} from "react";
import {AutoComplete, Flex} from 'antd';

import "./SpotlightSearch.less";
import MacCommandIcon from "../../icons/MacCommandIcon.tsx";
import {useTranslation} from "react-i18next";
import {invoke} from "@tauri-apps/api/core";
import EmptySearchResult from "./EmptySearchResult.tsx";
import {SearchResultDto, SearchSceneResult, wrapSearchResult} from "./SearchResultOptionsUtil.tsx";
import type {BaseSelectRef} from "rc-select";
import {listen, UnlistenFn} from "@tauri-apps/api/event";
import {hash} from "../../../utils/Util.ts";
import {DEFAULT_DATASOURCE_COLOR} from "../../../utils/RedisTypeUtil.ts";

interface SpotlightSearchProp {
    global?: boolean;
}

const SpotlightAutoComplete: React.FC<SpotlightSearchProp> = (props) => {
    const {t} = useTranslation();
    const [options, setOptions] = useState<any>();
    const debounceTimeoutRef = useRef<any>();
    const autoCompleteRef = useRef<BaseSelectRef | null>(null);
    const [searchText, setSearchText] = useState('');
    const [searching, setSearching] = useState(false);
    const [stillSearching, setStillSearching] = useState(false);
    const [datasource, setDatasource] = useState('');
    const [database, setDatabase] = useState(0);
    const [datasourceName, setDatasourceName] = useState('');
    const [datasourceColor, setDatasourceColor] = useState('');
    const datasourceRef = useRef('');
    const databaseRef = useRef(0);

    const [autoCompleteDataId, setAutoCompleteDataId] = useState(Date.now());
    const changeDatabaseManual = useRef(false);

    const removeListenerRef = useRef<UnlistenFn>();
    const removeListenerIdRef = useRef(0);
    useEffect(() => {
        const ts = Date.now();
        if (props.global) {
            resize_global_height(0, () => {
            });
            if (autoCompleteRef) {
                autoCompleteRef.current?.focus();
            }
        }
        const wrapDatasourceColor = (color: string, ds: any) => {
            if (color) {
                return color;
            }
            const index = Math.abs(hash(`${ds.id}_${ds.host}_${ds.port}`) % DEFAULT_DATASOURCE_COLOR.length)
            return DEFAULT_DATASOURCE_COLOR[index];
        };

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

                listen('spotlight/search-result', event => {
                    const result = event.payload as SearchSceneResult;
                    console.log("收到 spotlight 搜索异步结果：", result.scene, result.hits, result.elapsed + "ms");
                }).then(resolveFn);

                listen('spotlight/search-finished', event => {
                    console.log("收到 spotlight 搜索结束事件：", event.payload);
                }).then(resolveFn);

                listen("spotlight/activated-datasource", event => {
                    const payload = event.payload as { datasource: string, database: number };
                    console.log("activate datasource changed: ", event);
                    invoke('query_datasource_detail', {
                        datasource: payload.datasource,
                    }).then((r: any) => {
                        setDatasourceName(r.name);
                        setDatasourceColor(wrapDatasourceColor(r.ds_color, r))
                    })
                    setDatasource(payload.datasource);
                    setDatabase(payload.database);
                    datasourceRef.current = payload.datasource;
                    databaseRef.current = payload.database;
                }).then(resolveFn);
            });
        }
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

    // 防抖函数
    function debounce(func: any, wait: any) {
        return (searchingStatus: boolean, value: string) => {
            // eslint-disable-next-line @typescript-eslint/no-this-alias,@typescript-eslint/ban-ts-comment
            // @ts-ignore
            const context = this;
            const args = [searchingStatus, value];
            clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = setTimeout(function () {
                func.apply(context, args);
            }, wait);
        };
    }

    function resize_global_height(height: number, callback: () => void) {
        if (height < 0) {
            height = 50;
        } else if (height == 0) {
            height = 134;
        }
        height = Math.min(height, 316);
        invoke("resize_spotlight_window", {
            height: height,
        }).then(r => {
            callback();
        });
    }

    const debouncedQuery = debounce(async (searchingStatus: boolean, val: string) => {
        try {
            const limit = val.length == 0 ? 5 : 10;
            let timeout: any = undefined;
            if (val.length == 0) {
                setSearching(false);
                setStillSearching(false);
                if (props.global) {
                    resize_global_height(0, () => {
                        setOptions([]);
                    });
                } else {
                    setOptions([]);
                }
                return;
            } else {
                setSearching(true);
                timeout = setTimeout(() => {
                    if (searchingStatus) {
                        setStillSearching(true);
                    }
                }, 0);
            }

            const searchUniqueId = Date.now();
            invoke("spotlight_search", {
                datasource: datasourceRef.current,
                uniqueId: searchUniqueId,
                query: `${val}`,
                limit: limit,
                scanSize: 5,
                offset: 0
            }).then(r => {
                console.log("收到同步结果：", Date.now() - searchUniqueId)
                if (timeout) {
                    clearTimeout(timeout);
                }
                const data: SearchResultDto = JSON.parse(r as string);
                const opt = wrapSearchResult(data, t, props.global);
                setAutoCompleteDataId(searchUniqueId);
                setOptions(opt.opts);
                if (props.global) {
                    resize_global_height(opt.height, () => {
                        setSearching(false);
                        setStillSearching(false);
                    });
                }
            });
        } catch (error) {
            console.error('Error fetching query result:', error);
        }
    }, 350); // 设置防抖时间为500毫秒

    const onSelect = (searchingStatus: boolean, value: any, option: any) => {
        let updateSearchText = true;
        console.log(`onSelect`, value, option.label);
        if (props.global) {
            const labelKey = option.label.key;
            const isKey = labelKey.startsWith("key\x01");
            const isFavor = labelKey.startsWith("favor\x01");
            const isRecently = labelKey.startsWith("recently\x01");
            if (isKey || isFavor || isRecently) {
                if (isFavor || isRecently) {
                    if (!option.label.props.exist) {
                        return;
                    }
                }
                updateSearchText = false;
                const keyName = option.label.props.keyName;
                const keyType = option.label.props.type;
                invoke('open_redis_pushpin_window', {
                    keyName,
                    keyType,
                    datasource: '',
                    database: 0
                }).then(e => {
                    resize_global_height(0, () => {
                        invoke('hide_spotlight', {}).then(_r => {
                            invoke('record_key_access_history', {
                                key: keyName,
                                keyType,
                                datasource: datasourceRef.current
                            }).then(r => {
                                console.log("record finished")
                            })
                        });
                    });
                });
            } else if (labelKey.startsWith("database\x01")) {
                updateSearchText = false;
                const currDatabase = option.label.props.index;
                invoke('select_redis_database', {
                    database: currDatabase
                }).then(r => {
                    const resp = JSON.parse(r as string);
                    if (resp.success) {
                        setDatabase(currDatabase);
                        changeDatabaseManual.current = true;
                    }
                })
            } else if (labelKey.startsWith("datasource\x01")) {
                console.error("Not implement.")
            }
        }
        if (updateSearchText) {
            if (value.indexOf("\x01") > 0) {
                value = value.split('\x01')[1];
            }
            setSearchText(value);
            setOptions([]);
            debouncedQuery(searchingStatus, value);
        } else {
            setSearchText('');
            resize_global_height(0, () => {
                setSearching(false);
                setStillSearching(false);
            });
        }
    }
    let loading = <></>
    if (stillSearching) {
        loading = <>
            <div className={'spotlight-loading'}>
                <div className={'loading-bar'}></div>
                <div className={'loading-bar-mask'}></div>
            </div>
        </>;
    }
    return <>
        {loading}
        <AutoComplete
            key={autoCompleteDataId}
            ref={autoCompleteRef}
            className={`spotlight-search-input ${props.global ? 'global' : ''}`}
            popupClassName="certain-category-search-dropdown"
            popupMatchSelectWidth={600}
            options={options}
            size="small"
            defaultActiveFirstOption={true}
            open={props.global}
            value={searchText}
            getPopupContainer={(props: any) => {
                return document.getElementById('spotlight-search-input')!;
            }}
            placeholder={<>
                <Flex justify="space-between" align="middle">
                    <span>
                    <MacCommandIcon style={{width: 12, color: '#505153'}}/> + P {t('redis.spotlight.input.placeholder')}
                    </span>
                    <div className={'activated-datasource-info'}>
                        <span className={'activated-datasource'} style={{background: `${datasourceColor}80`}}>{datasourceName}</span>
                        <span className={'activated-database'}>DB{database}</span>
                    </div>
                </Flex>
            </>}
            autoFocus={true}
            notFoundContent={<EmptySearchResult datasource={datasource} database={database}/>}
            allowClear={false}
            onDropdownVisibleChange={(open: boolean) => {
                if (!open && props.global) {
                    if (searchText.length == 0) {
                        resize_global_height(0, () => {
                            invoke('hide_spotlight', {}).then(_r => {
                            });
                        });
                    }
                }
                setOptions([]);
            }}
            onSelect={(value, option) => onSelect(searching, value, option)}
            onSearch={val => {
                setSearchText(val);
                debouncedQuery(val.length > 0, val);
            }}
        >
        </AutoComplete>
    </>
}

export default SpotlightAutoComplete;