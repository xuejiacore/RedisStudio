import React, {useEffect, useRef, useState} from "react";
import {AutoComplete} from 'antd';

import "./SpotlightSearch.less";
import MacCommandIcon from "../../icons/MacCommandIcon.tsx";
import {CloseOutlined} from "@ant-design/icons";
import {useTranslation} from "react-i18next";
import {invoke} from "@tauri-apps/api/core";
import EmptySearchResult from "./EmptySearchResult.tsx";

interface SpotlightSearchProp {

}

const renderTitle = (title: string) => (
    <>
        <span className={'spotlight-search-group'}>{title}</span>
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

const opt = [
    {
        label: renderTitle('Exact matched'),
        options: [renderItem('130:commodity:231', 10000), renderItem('AntDesign UI', 10600)],
    },
    {
        label: renderTitle('Datasource'),
        options: [renderItem('AntDesign', 10000), renderItem('AntDesign UI', 10600)],
    },
    {
        label: renderTitle('Key Patterns'),
        options: [renderItem('AntDesign UI FAQ', 60100), renderItem('AntDesign FAQ', 30010)],
    },
    {
        label: renderTitle('Articles'),
        options: [
            renderItem('AntDesign design language0', 100000),
            renderItem('AntDesign design language1', 100000),
            renderItem('AntDesign design language2', 100000),
            renderItem('AntDesign design language3', 100000),
            renderItem('AntDesign design language4', 100000),
            renderItem('AntDesign design language5', 100000),
            renderItem('AntDesign design language6', 100000),
            renderItem('AntDesign design language7', 100000),
            renderItem('AntDesign design language8', 100000),
            renderItem('AntDesign design language9', 100000),
        ],
    },
];

interface SearchData {
    text: string;
    type: number;
}


const SpotlightSearch: React.FC<SpotlightSearchProp> = (props) => {
    const {t} = useTranslation();
    const autoCompleteRef = useRef<any>();
    const [options, setOptions] = useState(opt);
    const [data, setData] = useState<SearchData[]>([]);

    useEffect(() => {
        console.log(autoCompleteRef.current);
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


    const onSelect = (value: any, option: any) => {
        console.log(`onSelect ${value} , ${option}`)
    }
    return <>
        <AutoComplete
            className="spotlight-search-input"
            popupClassName="certain-category-search-dropdown"
            popupMatchSelectWidth={500}
            options={[]}
            size="small"
            placeholder={<>
                <MacCommandIcon style={{width: 12, color: '#505153'}}/> + P {t('redis.spotlight.input.placeholder')}
            </>}
            notFoundContent={<EmptySearchResult/>}
            allowClear={{clearIcon: <CloseOutlined/>}}
            onSelect={onSelect}
            onSearch={val => {
                invoke("search", {indexName: 'key_pattern', query: `pattern:"${val}"`, limit: 3, offset: 0}).then(r => {
                    console.log(`搜索结果:`, JSON.parse(r as string));
                });
            }}
        >
        </AutoComplete>
    </>
}

export default SpotlightSearch;