import React, {useEffect, useState} from "react";
import {Tag, Tooltip} from "antd";
import {invoke} from "@tauri-apps/api/core";
import {hash} from "../../../utils/Util.ts";

interface RedisKeyTagsProp {
    selectedKey?: string,
    datasource?: string,
    database?: number,
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
        invoke("infer_redis_key_pattern", {
            key: props.selectedKey,
            datasource: props.datasource,
            database: props.database
        }).then(r => {
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