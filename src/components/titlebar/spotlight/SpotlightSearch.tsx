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

}

const renderTitle = (title: string) => (
    <>
        <span key={title} className={'spotlight-search-group'}>{title}</span>
    </>
);

const renderItem = (title: string, count: number) => ({
    value: title,
    label: <>
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
            }}
        >
            <span className={'spotlight-search-item'}>{title}</span>
            <span>{count}</span>
        </div>
    </>,
});

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


const SpotlightSearch: React.FC<SpotlightSearchProp> = (props) => {
    const {t} = useTranslation();
    const [options, setOptions] = useState<any>();
    const [data, setData] = useState<SearchData[]>([]);
    const debounceTimeoutRef = useRef<any>();
    const autoCompleteRef = useRef<BaseSelectRef | null>(null);
    useHotkeys('command+p', (event: any) => {
        if (autoCompleteRef) {
            autoCompleteRef.current?.focus();
            // autoCompleteRef.current?.blur();
        }
    });

    useEffect(() => {
        return () => {

        }
    }, []);

    const render = (data: SearchData[]) => {

    }

    useEffect(() => {
        render(data);
        return () => {
        }
    }, [data]);

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

    // 查询函数，这里进行了防抖处理
    const debouncedQuery = debounce(async (val: string) => {
        try {
            const limit = val.length == 0 ? 5 : 10;
            invoke("search", {
                indexName: 'key_pattern',
                query: `.*${val}.*`,
                limit: limit,
                offset: 0
            }).then(r => {
                const data: SearchResultDto = JSON.parse(r as string);
                console.log(data);
                const opt = wrapSearchResult(data, t);
                setOptions(opt);
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
            className="spotlight-search-input"
            popupClassName="certain-category-search-dropdown"
            popupMatchSelectWidth={500}
            options={options}
            size="small"
            placeholder={<>
                <MacCommandIcon style={{width: 12, color: '#505153'}}/> + P {t('redis.spotlight.input.placeholder')}
            </>}
            autoFocus={true}
            notFoundContent={<EmptySearchResult/>}
            allowClear={{clearIcon: <CloseOutlined/>}}
            onSelect={onSelect}
            onSearch={val => {
                debouncedQuery(val); // 每次输入都调用防抖后的查询函数
            }}
        >
        </AutoComplete>
    </>
}

export default SpotlightSearch;