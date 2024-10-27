/* eslint-disable */
import {TFunction} from "i18next";
import KeyPatternSearchResult from "./KeyPatternSearchResult.tsx";
import React from "react";
import DatasourceSearchResult from "./DatasourceSearchResult.tsx";
import KeySearchResult from "./KeySearchResult.tsx";
import FavorSearchResult from "./FavorSearchResult.tsx";
import RecentlySearchResult from "./RecentlySearchResult.tsx";
import DatabaseSearchResult from "./DatabaseSearchResult.tsx";

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
    elapsed: number;
}

export interface SearchResultDto {
    results: SearchSceneResult[]
}

const TOP_HEIGHT = 53;
const ITEM_HEIGHT = 23;
const INDEX = ['database', 'key', 'datasource', 'favor', "recently", 'key_pattern'];

function unwrap(result: SearchSceneResult, t: TFunction<"translation", undefined>, global?: boolean): ResultOptions {
    if (result.hits == 0) {
        return {
            options: [],
            height: 0,
        };
    }
    let options: OptionItem[];
    const cts = Date.now();
    switch (result.scene) {
        case "database":
            options = result.documents.map(t => {
                const unique_key = `${result.scene}\x01${t.index}\x01${cts}`;
                return {
                    value: `${unique_key}`,
                    label: <DatabaseSearchResult key={unique_key}
                                                 name={t.name}
                                                 index={t.index}
                                                 keys={t.keys}
                                                 active={t.active}/>
                }
            });
            return {
                label: <span key={'key_pattern_label'}
                             className={'group-name'}>{t('redis.main.search.scene.database.label')}</span>,
                options: options,
                height: (options.length + 1) * ITEM_HEIGHT + TOP_HEIGHT
            };
            break
        case "key_pattern":
            options = result.documents.map(t => {
                const unique_key = `${result.scene}\x01${t.normalization}\x01${cts}`;
                return {
                    value: `${unique_key}`,
                    label: <KeyPatternSearchResult key={unique_key}
                                                   pattern={t.normalization}
                                                   desc={'t.desc'}/>
                }
            });
            return {
                label: <span key={'key_pattern_label'}
                             className={'group-name'}>{t('redis.main.search.scene.key_pattern.label')}</span>,
                options: options,
                height: (options.length + 1) * ITEM_HEIGHT + TOP_HEIGHT
            };
        case "recently":
            options = result.documents.sort((a: any, b: any) => {
                return b.key[0].localeCompare(a.key[0]);
            }).map(t => {
                const unique_key = `${result.scene}\x01${t.key[0]}\x01${cts}`;
                return {
                    value: `${unique_key}`,
                    label: <RecentlySearchResult key={`${unique_key}`}
                                                 keyName={t.key[0]}
                                                 type={t.key_type[0]}
                                                 global={global}
                                                 exist={t.exist}/>
                }
            });
            return {
                label: <span key={'recently-label'}
                             className={'group-name'}>{t('redis.main.search.scene.recently.label')}</span>,
                options: options,
                height: (options.length + 1) * ITEM_HEIGHT + TOP_HEIGHT
            };
        case "key":
            options = result.documents.sort((a: any, b: any) => {
                return b.key.localeCompare(a.key);
            }).map(t => {
                const unique_key = `${result.scene}\x01${t.key}\x01${cts}`;
                return {
                    value: `${unique_key}`,
                    label: <KeySearchResult key={unique_key}
                                            keyName={t.key}
                                            type={t.type}
                                            global={global}/>
                }
            });
            return {
                label: <span key={'key-label'} className={'group-name'}>{t('redis.main.search.scene.key.label')}</span>,
                options: options,
                height: (options.length + 1) * ITEM_HEIGHT + TOP_HEIGHT
            }
        case "datasource":
            options = result.documents.map(t => {
                const unique_key = `${result.scene}\x01${t.hostport}\x01${cts}`;
                return {
                    value: `${unique_key}`,
                    label: <DatasourceSearchResult key={`${unique_key}`}
                                                   hostport={t.hostport}
                                                   desc={t.desc}
                                                   connected={t.connected}
                                                   global={global}/>
                }
            });
            return {
                label: <span key={'datasource-label'}
                             className={'group-name'}>{t('redis.main.search.scene.datasource.label')}</span>,
                options: options,
                height: (options.length + 1) * ITEM_HEIGHT + TOP_HEIGHT
            }
        case "favor":
            options = result.documents.sort((a: any, b: any) => {
                return b.key[0].localeCompare(a.key[0]);
            }).map(t => {
                const unique_key = `${result.scene}\x01${t.key[0]}\x01${cts}`;
                return {
                    value: `${unique_key}`,
                    label: <FavorSearchResult key={unique_key}
                                              keyName={t.key[0]}
                                              type={t.key_type[0]}
                                              exist={t.exist}/>
                }
            });
            return {
                label: <span key={'favor-label'}
                             className={'group-name'}>{t('redis.main.search.scene.favor.label')}</span>,
                options: options,
                height: (options.length + 1) * ITEM_HEIGHT + TOP_HEIGHT
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
            data.results.sort((r1, r2) => {
                return INDEX.indexOf(r1.scene) - INDEX.indexOf(r2.scene);
            }).forEach(result => {
                let unwrapped = unwrap(result, t, global);
                if (unwrapped.options.length > 0) {
                    ret.push(unwrapped);
                    height += unwrapped.height;
                }
            })
            // @ts-ignore
            return {opts: ret, height: height};
        } else {
            return {opts: [], height: 0};
        }
    } else {
        return {opts: [], height: 0};
    }
}

