import React, {useEffect, useRef, useState} from "react";
import {Button, Divider, Empty, Flex, Form, Input, InputRef, Space, Tag} from "antd";
import {FilterOutlined} from "@ant-design/icons";
import {useTranslation} from "react-i18next";
import "./index.less";
import no_data_svg from "../../../assets/images/icons/no-data.svg";
import {rust_invoke} from "../../../utils/RustIteractor.tsx";

export interface OutlineAction {
    type?: string
}
interface KeyTagsProp {
    selectedKey?: string;
    selectedKeyType?: string;
    action?: OutlineAction;
}

interface KeyInfo {
    exists: number
    ttl: number
    usage: number
    encoding: string
    data_len: number
}

function padZero(num: number): string {
    return num.toString().padStart(2, '0'); // 使用 padStart 方法在数字前面填充 0，以确保始终为两位数
}

function formatTimestamp(timestamp: number, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
    const date = new Date(timestamp * 1000); // JavaScript 时间戳是以毫秒为单位的，所以需要乘以 1000

    const year = date.getFullYear();
    const month = padZero(date.getMonth() + 1); // 月份是从 0 开始的，所以需要加 1
    const day = padZero(date.getDate());
    const hours = padZero(date.getHours());
    const minutes = padZero(date.getMinutes());
    const seconds = padZero(date.getSeconds());

    return format
        .replace('YYYY', year.toString())
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

function formatTtl(keyInfo: KeyInfo) {
    const ttl = keyInfo?.ttl;
    if (!ttl || ttl === -1) {
        return (<>∞</>);
    } else {
        const sec = ttl % 60;
        const min = Math.round(Math.floor(ttl / 60) % 60);
        const hour = Math.round(Math.floor(ttl / 3600) % 24);
        const days = Math.floor(ttl / 86400);

        const daysPart = days > 0 ? (<span className={'cd-days-part'}><i>+{days}d</i></span>) : (<></>);
        const hourPart = hour > 0 ? padZero(hour) + ':' : '';
        const minPart = min > 0 ? padZero(min) + ':' : '';
        return (<>
            <span>{hourPart}{minPart}{padZero(sec)}</span>{daysPart}
        </>)
    }
}

const customTags = [
    {
        id: 1,
        name: "{}:GeneralCommodity:{}",
        color: "#3960b760",
        vars: [
            {
                key: "ver",
                desc: "version"
            },
            {
                key: "commodityId",
                desc: "id of commodity"
            }
        ]
    },
    {
        id: 2,
        name: "{}:GeneralCommodity:*",
        color: "#8c76ce60",
        vars: [
            {
                key: "ver",
                desc: "version"
            }
        ]
    },
    {
        id: 3,
        name: "商品信息",
        color: '#b44fa060',
        vars: [
            {
                key: "ver",
                desc: "配置版本"
            },
            {
                key: "commodityId",
                desc: "商品id"
            }
        ]
    }
];

const KeyOutline: React.FC<KeyTagsProp> = (props, context) => {

    const {t} = useTranslation();

    const [keyInfo, setKeyInfo] = useState<KeyInfo>();
    const [ttlCountDown, setTtlCountDown] = useState((<></>));
    const [expireAt, setExpireAt] = useState('');
    const [memoryUsage, setMemoryUsage] = useState((<></>));
    const [encoding, setEncoding] = useState('unknown');
    const [dataLen, setDataLen] = useState(0);
    const [tagVariablesComponent, setTagVariablesComponent] = useState(<></>)
    const [dataTime, setDataTime] = useState(<></>);

    useEffect(() => {
        if (keyInfo?.ttl && keyInfo?.ttl > 0) {
            const interval = setInterval(() => {
                keyInfo.ttl--;
                setTtlCountDown(formatTtl(keyInfo));
            }, 1000);

            return () => {
                clearInterval(interval);
                // if (onEnd) {
                //     onEnd();
                // }
            };
        } else {
            setTtlCountDown(<>Permanent</>);
        }
    }, [keyInfo]);

    useEffect(() => {
        switch (props.action?.type) {
            case "RELOAD":
                setDataTime(<>{formatTimestamp(Date.now() / 1000)}</>);
                break;
        }
    }, [props.action]);

    function setOutlineInfo(keyInfo: KeyInfo) {
        setKeyInfo(keyInfo);
        setTtlCountDown(formatTtl(keyInfo));
        setDataTime(<>{formatTimestamp(Date.now() / 1000)}</>);
        if (keyInfo.ttl > 0) {
            const expireAt = Math.round(Date.now() / 1000) + keyInfo.ttl;
            setExpireAt('[' + formatTimestamp(expireAt) + ']');
        } else {
            setExpireAt('');
        }

        const usage_bytes = keyInfo.usage ? keyInfo.usage : 0;
        let usageInfo;
        if (usage_bytes > 1024) {
            usageInfo = (<>
                <div className={'label-text'}>{Math.ceil(usage_bytes / 1024)}</div>
                <div className={'label-memory-size'}>KB</div>
            </>);
        } else {
            usageInfo = (<>
                <div className={'label-text'}>{usage_bytes}</div>
                <div className={'label-memory-size'}>bytes</div>
            </>);
        }
        setMemoryUsage(usageInfo);
        setEncoding(keyInfo.encoding);
        setDataLen(keyInfo.data_len);
    }

    useEffect(() => {
        rust_invoke("redis_key_info", {key: props.selectedKey, key_type: props.selectedKeyType}).then(r => {
            const keyInfo: KeyInfo = JSON.parse(r as string);
            setOutlineInfo(keyInfo);
        });
    }, [props.selectedKey]);
    const searchInputRef = useRef<InputRef>(null);

    const showTagVars = (id: any) => {
        customTags.forEach(v => {
            if (v.id == id) {
                let idx = 0;
                const elements = v.vars.map(variables => {
                    return <>
                        <Form.Item label={variables.desc}
                                   className={'tag-variables-form-item'}>
                            <Input
                                ref={idx++ == 0 ? searchInputRef : undefined}
                                placeholder=""
                                autoComplete={'off'}
                                spellCheck={false}/>
                        </Form.Item>
                    </>
                });
                setTagVariablesComponent(<>{elements}</>);
                setTimeout(() => {
                    searchInputRef.current!.focus({cursor: 'all'})
                }, 200);
            }
        })
    };

    const onTagCreate = () => {
        // TODO: 新建tag
        console.log("on tag create window show");
    };

    const preventDefault = (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();
    };
    return <>
        <div className={'key-tags-container'}>
            <Divider className={'divider first-divider'}
                     orientation="left">{t('redis.main.right_panel.tabs.outline.divider.basic')}
            </Divider>

            <Flex gap="4px 0" wrap={"wrap"}>
                <Space className={'label-space'} direction={"vertical"} size={"small"}>
                    <Space className={'label-space'} direction={"horizontal"} size={"small"}>
                        <div className={'label-text'}>{t('redis.main.right_panel.tabs.outline.basic.ttl')}:</div>
                        <div className={'label-text ttl-countdown'}>{ttlCountDown}</div>
                        <div className={'label-time ttl-exact-at'}>{expireAt}</div>
                    </Space>

                    <Space className={'label-space'} direction={"horizontal"} size={"small"}>
                        <div className={'label-text'}>{t('redis.main.right_panel.tabs.outline.basic.memory')}:</div>
                        {memoryUsage}
                    </Space>

                    <Space className={'label-space'} direction={"horizontal"} size={"small"}>
                        <div className={'label-text'}>{t('redis.main.right_panel.tabs.outline.basic.encoding')}:</div>
                        <div className={'label-text'}>{encoding}</div>
                    </Space>

                    <Space className={'label-space'} direction={'horizontal'} size={"small"}>
                        <div className={'label-text'}>{t('redis.main.right_panel.tabs.outline.basic.filed_count')}:
                        </div>
                        <div className={'label-text'}>{dataLen}</div>
                    </Space>

                    <Space className={'label-space'} direction={'horizontal'} size={"small"}>
                        <div className={'label-text'}>{t('redis.main.right_panel.tabs.outline.basic.snapshot_ts')}:
                        </div>
                        <div className={'label-text last-updated'}>{dataTime}</div>
                    </Space>
                </Space>
            </Flex>

            {/* Recommend Tags */}
            <Divider className={'divider'}
                     orientation="left">{t('redis.main.right_panel.tabs.outline.divider.recommend')}
            </Divider>

            <Empty
                className={'empty'}
                image={no_data_svg}
                imageStyle={{
                    height: 40,
                }}
                description={(
                    <span>
                        {t('redis.main.right_panel.tabs.outline.recommend.empty_info')}
                        <u>
                            <a href="#API" onClick={onTagCreate}>
                                {t('redis.main.right_panel.tabs.outline.recommend.operation')}
                            </a>
                        </u>
                    </span>
                )}
            >
            </Empty>

            {/* Custom Tags */}
            <Divider className={'divider'}
                     orientation="left">{t('redis.main.right_panel.tabs.outline.divider.custom_tags')}
            </Divider>

            <Flex gap="4px 0" wrap="wrap">
                {customTags.map(c => {
                    return <Tag className={'key-tag'}
                                closeIcon={true}
                                color={c.color}
                                key={c.id}
                                onClose={preventDefault}
                                onClick={e => showTagVars(c.id)}>
                        {c.name}
                    </Tag>
                })}
            </Flex>

            <Divider className={'divider'}
                     orientation="left">{t('redis.main.right_panel.tabs.outline.divider.tag_vars')}
            </Divider>

            <Flex vertical={true}>
                <Form
                    labelAlign={"left"}
                    labelWrap={true}
                    className={'tag-variables-form'}
                    labelCol={{span: 10}}
                    wrapperCol={{span: 14}}
                    layout={'horizontal'}>
                    {tagVariablesComponent}
                </Form>

                <Flex justify={"end"} align={"end"}>
                    <Button
                        className={'tag-variables-submit-button'}
                        type="default"
                        size="small"
                        icon={<FilterOutlined style={{color: "orange"}}/>}>
                        Filter
                    </Button>
                </Flex>
            </Flex>
        </div>
    </>
};

export default KeyOutline;