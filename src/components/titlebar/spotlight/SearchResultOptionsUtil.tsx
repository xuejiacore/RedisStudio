/* eslint-disable */
import {TFunction} from "i18next";
import KeyPatternSearchResult from "./KeyPatternSearchResult.tsx";
import React from "react";
import DatasourceSearchResult from "./DatasourceSearchResult.tsx";
import KeySearchResult from "./KeySearchResult.tsx";

interface OptionItem {
    value: any;
    label: JSX.Element
}

interface ResultOptions {
    label?: JSX.Element;
    options: OptionItem[];
    height: number;
}

/**
 * search scene result
 */
export interface SearchSceneResult {
    scene: string;
    hits: number;
    documents: any[]
}

export interface SearchResultDto {
    results: SearchSceneResult[]
}

function unwrap(result: SearchSceneResult, t: TFunction<"translation", undefined>, global?: boolean): ResultOptions {
    if (result.hits == 0) {
        return {
            options: [],
            height: 0,
        };
    }
    let options: OptionItem[];
    switch (result.scene) {
        case "key_pattern":
            options = result.documents.map(t => {
                return {
                    value: `${t.normalization}`,
                    label: <KeyPatternSearchResult key={`${result.scene}-${t.normalization}`}
                                                   pattern={t.normalization}
                                                   desc={'t.desc'}/>
                }
            });
            return {
                label: <span className={'group-name'}>{t('redis.main.search.scene.key_pattern.label')}</span>,
                options: options,
                height: (options.length + 1) * 23 + 38
            };
        case "recently":
            options = [];
            return {
                label: <span className={'group-name'}>{t('redis.main.search.scene.recently.label')}</span>,
                options: options,
                height: (options.length + 1) * 23 + 38
            };
        case "key":
            options = result.documents.map(t => {
                return {
                    value: `${t.hostport}`,
                    label: <KeySearchResult key={`${result.scene}-${t.key}`}
                                            keyName={t.key}
                                            type={t.type}
                                            global={global}/>
                }
            });
            return {
                label: <span className={'group-name'}>{t('redis.main.search.scene.key.label')}</span>,
                options: options,
                height: (options.length + 1) * 23 + 38
            }
        case "datasource":
            options = result.documents.map(t => {
                return {
                    value: `${t.hostport}`,
                    label: <DatasourceSearchResult key={`${result.scene}-${t.hostport}`}
                                                   hostport={t.hostport}
                                                   desc={t.desc}
                                                   connected={t.connected}
                                                   global={global}/>
                }
            });
            return {
                label: <span className={'group-name'}>{t('redis.main.search.scene.datasource.label')}</span>,
                options: options,
                height: (options.length + 1) * 23 + 38
            }
    }
    return {
        options: [],
        height: 0,
    };
}

/**
 * wrap search result as AutoComplete options
 * @param data data
 * @param t translation
 */
export function wrapSearchResult(data: SearchResultDto, t: TFunction<"translation", undefined>, global?: boolean):
    { opts: ResultOptions[], height: number } {
    if (data) {
        if (data.results) {
            let height = 0;
            // @ts-ignore
            let ret: ResultOptions[] = [];
            for (const result of data.results) {
                let unwrapped = unwrap(result, t, global);
                if (unwrapped.options.length > 0) {
                    ret.push(unwrapped);
                    height += unwrapped.height;
                }
            }
            // @ts-ignore
            return {opts: ret, height: height};
        } else {
            return {opts: [], height: 0};
        }
    } else {
        return {opts: [], height: 0};
    }
}

