import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from "react";
import {Flex, Input} from "antd";
import "./VarNode.less";
import {invoke} from "@tauri-apps/api/core";
import {Popover} from "react-tiny-popover";
import {formatTimestamp} from "../../../utils/TimeUtil.ts";

export interface VarNodeRef {
    updateKeyType: (type: string) => void;
    calculateRuntimeKey: (meta: Map<string, string>) => string;
    enabled: () => boolean;
}

interface VarNodeProps {
    id: number;
    dataViewId: number;
    origin: string;
    name: string;
    defaultValue?: string;
    keyType?: string;
    editable?: boolean;
    onChange?: (vid: number, key: string, value: string) => void;
}

interface VarHistoryItem {
    value: string;
    highlight: boolean;
}

const VarNode: React.FC<VarNodeProps> = forwardRef<VarNodeRef | undefined, VarNodeProps>((props, ref) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [historyVisible, setHistoryVisible] = useState(false);
    const historyInputRef = useRef<any>();
    const [historyItems, setHistoryItems] = useState<VarHistoryItem[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [keyType, setKeyType] = useState(props.keyType)
    const [typeChar, setTypeChar] = useState(keyType?.substring(0, 1).toUpperCase());
    const [uncertainty, setUncertainty] = useState(props.keyType ? 'uncertainty' : '');
    const enabledRef = useRef(uncertainty === 'uncertainty');
    const originKey = props.origin;

    useImperativeHandle(ref, () => ({
        updateKeyType: keyType => {
            if (keyType !== 'none') {
                setKeyType(keyType);
                setTypeChar(keyType.substring(0, 1).toUpperCase());
                setUncertainty('');
                enabledRef.current = true;
            } else {
                setUncertainty('uncertainty');
                enabledRef.current = false;
            }
        },
        calculateRuntimeKey: meta => {
            let runtimeKey = originKey;
            const containVars = originKey.indexOf("{") >= 0 && originKey.indexOf("}") >= 0;
            if (containVars) {
                // eslint-disable-next-line
                // @ts-ignore
                runtimeKey = originKey.replace(/\{([^}]+)\}/g, (_: any, key: any) => {
                    return meta.get(key) !== undefined ? meta.get(key) : `{${key}}`;
                });
            }
            return runtimeKey;
        },
        enabled: () => {
            return enabledRef.current;
        }
    }));

    let replacement = '';

    const originName = props.name;
    const containVars = originName.indexOf("{") >= 0 && originName.indexOf("}") >= 0;
    let empty = '';
    if (containVars) {
        if (props.defaultValue) {
            empty = '';
            const json = JSON.parse(props.defaultValue);
            replacement = originName.replace(/\{([^}]+)\}/g, (_, key) => {
                return json[key] !== undefined ? json[key].toString() : `{${key}}`;
            });
        } else {
            replacement = props.name;
        }
    } else {
        empty = 'empty'
    }
    const [replaceValue, setReplaceValue] = useState(replacement);
    const replaceValueRef = useRef(replacement);

    useEffect(() => {
        replaceValueRef.current = replaceValue;
    }, [replaceValue]);

    function injectBuildInVar(arrays: VarHistoryItem[]) {
        if (props.name.indexOf("{yyyyMMdd}") >= 0) {
            const today = formatTimestamp(Date.now(), 'YYYYMMDD');
            const cnt = arrays.filter((s: any) => {
                if (s.value === today) {
                    s.highlight = true;
                    return true;
                }
                return false;
            });
            if (cnt.length <= 0) {
                arrays.unshift({value: today, highlight: true});
            }
        }
    }

    const onValueDropdown = (e: React.MouseEvent<HTMLSpanElement>) => {
        e.stopPropagation();
        const regex = /\{(.*?)\}/;
        const match = props.name.match(regex);
        if (match && match[1]) {
            setInputValue(replaceValueRef.current);
            invoke('query_history_vars', {
                dataViewId: props.dataViewId,
                varName: match[1],
                limit: 10
            }).then((r: any) => {
                setIsMenuOpen((prev) => !prev);

                if (r.histories) {
                    const arrays = r.histories.map((h: string) => {
                        return {value: h}
                    });
                    injectBuildInVar(arrays);
                    setHistoryItems(arrays);
                    setHistoryVisible(true);
                    setTimeout(() => {
                        historyInputRef.current?.focus();
                        historyInputRef.current?.select();
                    }, 120);
                }
            });
        }
    };

    const onHistoryItemSelected = (e: any, item: VarHistoryItem) => {
        e.stopPropagation();
        setHistoryVisible(false);
        historyInputRef.current.value = replaceValueRef.current;
        setReplaceValue(item.value);
        setIsMenuOpen(false);
        recordHistory(item.value);
    }

    const varClass = containVars ? 'vars' : '';

    function recordHistory(value: string) {
        const regex = /\{(.*?)\}/;
        const match = props.name.match(regex);
        if (match && match[1]) {
            const varName = match[1];
            props.onChange?.(props.dataViewId, varName, value);
            invoke('save_var_history', {
                dataViewId: props.dataViewId,
                name: varName,
                value: value,
            }).finally();
        }
    }

    return <>
        <Flex align={"center"} className={'var-node'} gap={4}>
            <div className={`key-type-prefix redis-type ${keyType} ${uncertainty}`}
                 style={{display: props.keyType ? undefined : 'none'}}>
                {typeChar}
            </div>

            <Popover
                isOpen={isMenuOpen}
                positions={['bottom']}
                align={'start'}
                onClickOutside={() => setIsMenuOpen(false)}
                content={({position, nudgedLeft, nudgedTop}) => <>
                    <Flex className={`data-view-var-history ${historyVisible ? '' : 'invisible'}`}
                          justify="center"
                          align={"center"}
                          vertical={true}>
                        <Input
                            ref={historyInputRef}
                            className={'input'}
                            autoComplete={'off'}
                            defaultValue={inputValue}
                            spellCheck={false}
                            onChange={e => {
                                setInputValue(e.target.value);
                            }}
                            autoFocus={true}
                            onKeyDown={e => {
                                if (e.code === 'Escape') {
                                    setIsMenuOpen(false);
                                }
                            }}
                            onPressEnter={e => {
                                // eslint-disable-next-line
                                // @ts-ignore
                                const value = e.target.value;
                                setReplaceValue(value);
                                setHistoryVisible(false);
                                setIsMenuOpen(false);
                                recordHistory(value);
                            }}
                            onBlur={e => {
                                setTimeout(() => {
                                    setIsMenuOpen(false);
                                }, 100);
                            }}
                            placeholder={'Change Variable ⏎'}
                        />
                        <div className={'input-divider'}/>
                        <div className={'history-items'}>
                            {
                                historyItems.map((item, i) => {
                                    return <Flex className={`data-value-item`}
                                                 key={`${props.dataViewId}_${props.id}_${i}`}
                                                 align={'center'}
                                                 justify={"center"} gap={4}>
                                        <div className={`data-value ${item.highlight ? 'highlight' : ''}`}
                                             onClick={e => onHistoryItemSelected(e, item)}>
                                            {item.value}
                                        </div>
                                    </Flex>
                                })
                            }
                        </div>
                    </Flex>
                </>}>
                <div className={`runtime-value ${empty} ${uncertainty}`}
                     onClick={onValueDropdown}>
                    {replaceValue}
                </div>
            </Popover>

            <div className={`origin-name ${varClass} ${uncertainty}`}>{props.name}</div>
        </Flex>
    </>
});

VarNode.displayName = 'VarNode';
export default VarNode;