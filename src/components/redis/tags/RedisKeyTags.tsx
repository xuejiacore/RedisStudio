import React, {useEffect, useState} from "react";
import {Tag, Tooltip} from "antd";
import {invoke} from "@tauri-apps/api/core";

interface RedisKeyTagsProp {
    selectedKey?: string,
    datasource?: string,
}

function hash(str: string): number {
    let hash = 0;
    if (str.length === 0) return hash;

    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }

    return hash;
}

const colors = [
    '#3960b760',
    '#8c76ce60',
    '#b44fa060',
    '#FF634760',
    '#4682B460',
    '#32CD3260',
    '#FFD70060',
    '#FF69B460',
    '#FF8C0060',
    '#8A2BE260',
    '#20B2AA60',
]

const RedisKeyTags: React.FC<RedisKeyTagsProp> = (props, context) => {
    const [tags, setTags] = useState(<></>);

    useEffect(() => {
        invoke("infer_redis_key_pattern", {key: props.selectedKey, datasource: "datasource01"}).then(r => {
            const json = JSON.parse(r as string);
            const normalized = json['normalized'];
            if (normalized) {
                const hashMod = Math.abs(hash(normalized) % colors.length);
                setTags(
                    <>
                        <Tooltip overlayClassName={'pattern-full-name'} placement="topLeft" color={'#424449'}
                                 title={normalized}>
                            <Tag className={'key-tag'}
                                 color={colors[hashMod]}
                                 key={'1'}
                                // onClose={preventDefault}
                                // onClick={e => showTagVars(c.id)}
                            >
                                {normalized}
                            </Tag>
                        </Tooltip>
                    </>
                )
            } else {
                setTags(<>
                    <Tooltip placement="topLeft" color={'#424449'}
                             title={'Load more similar keys to recognize or you can define your custom pattern below'}>
                        <Tag className={'key-tag'} color={'#424449'} key={'1'}>Unrecognized</Tag>
                    </Tooltip>
                </>);
            }
        })
        return () => {

        }
    }, [props.selectedKey]);

    return <>
        {tags}
    </>
}

export default RedisKeyTags;