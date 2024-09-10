/* eslint-disable @typescript-eslint/no-this-alias */
import React, {useEffect, useRef, useState} from "react";
import {AutoComplete} from 'antd';

import "./SpotlightSearch.less";
import MacCommandIcon from "../../icons/MacCommandIcon.tsx";
import {CloseOutlined} from "@ant-design/icons";
import {useTranslation} from "react-i18next";
import {invoke} from "@tauri-apps/api/core";
import EmptySearchResult from "./EmptySearchResult.tsx";
import {SearchResultDto, wrapSearchResult} from "./SearchResultOptionsUtil.tsx";
import type {BaseSelectRef} from "rc-select";

interface SpotlightSearchProp {
    global?: boolean;
}

interface SearchData {
    text: string;
    type: number;
}

const useHotkeys = (keys: string, callback: any) => {
    useEffect(() => {
        const handleKeyDown = (event: any) => {
            const keysPressed = keys.split('+').map(k => k.trim().toLowerCase());
            const key = event.key.toLowerCase();

            const isCtrl = keysPressed.includes('ctrl') ? event.ctrlKey : true;
            const isAlt = keysPressed.includes('alt') ? event.altKey : true;
            const isShift = keysPressed.includes('shift') ? event.shiftKey : true;

            if (isCtrl && isAlt && isShift && keysPressed.includes(key)) {
                event.preventDefault();
                callback(event);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [keys, callback]);
};


const SpotlightAutoComplete: React.FC<SpotlightSearchProp> = (props) => {
    const {t} = useTranslation();
    const [options, setOptions] = useState<any>();
    const debounceTimeoutRef = useRef<any>();
    const autoCompleteRef = useRef<BaseSelectRef | null>(null);
    const [searchText, setSearchText] = useState('');
    useHotkeys('command+p', (event: any) => {
        if (autoCompleteRef) {
            autoCompleteRef.current?.focus();
            // autoCompleteRef.current?.blur();
        }
    });
    useEffect(() => {
        if (props.global) {
            resize_global_height(0, () => {
            });
        }
        return () => {

        }
    }, []);

    // 防抖函数
    function debounce(func: any, wait: any) {
        return (value: string) => {
            // eslint-disable-next-line @typescript-eslint/no-this-alias,@typescript-eslint/ban-ts-comment
            // @ts-ignore
            const context = this;
            const args = [value];
            clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = setTimeout(function () {
                func.apply(context, args);
            }, wait);
        };
    }

    function resize_global_height(height: number, callback: () => void) {
        if (height < 0) {
            height = 26;
        } else if (height == 0) {
            height = 112;
        }
        invoke("resize_spotlight_window", {
            height: height,
        }).then(r => {
            callback();
        });
    }

// 查询函数，这里进行了防抖处理
    const debouncedQuery = debounce(async (val: string) => {
        try {
            const limit = val.length == 0 ? 5 : 10;
            if (val.length == 0) {
                if (props.global) {
                    resize_global_height(0, () => {
                        setOptions([]);
                    });
                }
                return;
            }
            invoke("search", {
                indexName: 'key_pattern',
                query: `.*${val}.*`,
                limit: limit,
                offset: 0
            }).then(r => {
                const data: SearchResultDto = JSON.parse(r as string);
                const opt = wrapSearchResult(data, t);
                setOptions(opt.opts);
                if (props.global) {
                    resize_global_height(opt.height, () => {
                    });
                }
            });
        } catch (error) {
            console.error('Error fetching query result:', error);
        }
    }, 250); // 设置防抖时间为500毫秒

    const onSelect = (value: any, option: any) => {
        console.log(`onSelect ${value} , ${option}`)
    }
    return <>
        <AutoComplete
            ref={autoCompleteRef}
            className={`spotlight-search-input ${props.global ? 'global' : ''}`}
            popupClassName="certain-category-search-dropdown"
            popupMatchSelectWidth={500}
            options={options}
            size="small"
            open={props.global}
            value={searchText}
            placeholder={<>
                <MacCommandIcon style={{width: 12, color: '#505153'}}/> + P {t('redis.spotlight.input.placeholder')}
            </>}
            autoFocus={true}
            notFoundContent={<EmptySearchResult/>}
            allowClear={{clearIcon: <CloseOutlined/>}}
            onDropdownVisibleChange={(open: boolean) => {
                if (!open && props.global) {
                    if (searchText.length == 0) {
                        resize_global_height(0, () => {
                            invoke('hide_spotlight_window', {}).then(_r => {
                            });
                        });
                    }
                }
                setOptions([]);
            }}
            onSelect={onSelect}
            onSearch={val => {
                setSearchText(val);
                debouncedQuery(val); // 每次输入都调用防抖后的查询函数
            }}
        >
        </AutoComplete>
    </>
}

export default SpotlightAutoComplete;