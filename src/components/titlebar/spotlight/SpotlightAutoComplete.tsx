/* eslint-disable @typescript-eslint/no-this-alias */
import React, {useEffect, useRef, useState} from "react";
import {AutoComplete} from 'antd';

import "./SpotlightSearch.less";
import MacCommandIcon from "../../icons/MacCommandIcon.tsx";
import {useTranslation} from "react-i18next";
import {invoke} from "@tauri-apps/api/core";
import EmptySearchResult from "./EmptySearchResult.tsx";
import {SearchResultDto, wrapSearchResult} from "./SearchResultOptionsUtil.tsx";
import type {BaseSelectRef} from "rc-select";

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
    useEffect(() => {
        if (props.global) {
            resize_global_height(0, () => {
            });
            if (autoCompleteRef) {
                autoCompleteRef.current?.focus();
            }
        }
        return () => {

        }
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
            height = 128;
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
                }, 500);
            }
            invoke("spotlight_search", {
                indexName: 'key_pattern',
                query: `${val}`,
                limit: limit,
                scanSize: 5,
                offset: 0
            }).then(r => {
                if (timeout) {
                    clearTimeout(timeout);
                }
                const data: SearchResultDto = JSON.parse(r as string);
                const opt = wrapSearchResult(data, t, props.global);
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
            const isKey = option.label.key.startsWith("key\x01");
            const isFavor = option.label.key.startsWith("favor\x01");
            const isRecently = option.label.key.startsWith("recently\x01");
            if (isKey || isFavor || isRecently) {
                if (isFavor || isRecently) {
                    if (!option.label.props.exist) {
                        return;
                    }
                }
                updateSearchText = false;
                setSearchText('');
                const keyName = option.label.props.keyName;
                const keyType = option.label.props.type;
                invoke('open_redis_pushpin_window', {keyName, keyType}).then(e => {
                    resize_global_height(0, () => {
                        invoke('hide_spotlight', {}).then(_r => {
                            invoke('record_key_access_history', {
                                key: keyName,
                                keyType,
                                datasource: "datasource01"
                            }).then(r => {
                                console.log("record finished")
                            })
                        });
                    });
                });
            }
        }
        if (updateSearchText) {
            if (value.indexOf("\x01") > 0) {
                value = value.split('\x01')[1];
            }
            setSearchText(value);
            debouncedQuery(searchingStatus, value);
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
                <MacCommandIcon style={{width: 12, color: '#505153'}}/> + P {t('redis.spotlight.input.placeholder')}
            </>}
            autoFocus={true}
            notFoundContent={<EmptySearchResult/>}
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