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
    '#3960b7',
    '#8c76ce',
    '#b44fa0',
    '#FF6347',
    '#4682B4',
    '#32CD32',
    '#FFD700',
    '#FF69B4',
    '#FF8C00',
    '#8A2BE2',
    '#20B2AA',
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
                                 // color={}
                                style={{background: `linear-gradient(to top, ${colors[hashMod]}40, ${colors[hashMod]}4F)`}}
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