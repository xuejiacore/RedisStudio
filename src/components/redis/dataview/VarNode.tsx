import React, {useEffect, useRef, useState} from "react";
import {Flex, Input} from "antd";
import "./VarNode.less";
import {invoke} from "@tauri-apps/api/core";
import {Popover} from "react-tiny-popover";

interface VarNodeProps {
    id: number;
    viewId: number;
    name: string;
    defaultValue?: string;
    keyType?: string;
    editable?: boolean;
}

interface VarHistoryItem {
    value: string;
}

const VarNode: React.FC<VarNodeProps> = (props, context) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [historyVisible, setHistoryVisible] = useState(false);
    const historyInputRef = useRef<any>();
    const [historyItems, setHistoryItems] = useState<VarHistoryItem[]>([]);
    const [inputValue, setInputValue] = useState('');

    let replacement = '';

    const containVars = props.name.indexOf("{") >= 0 && props.name.indexOf("}") >= 0;
    let empty = '';
    if (props.defaultValue && containVars) {
        empty = '';
        const json = JSON.parse(props.defaultValue);
        replacement = props.name.replace(/\{([^}]+)\}/g, (_, key) => {
            return json[key] !== undefined ? json[key].toString() : `{${key}}`;
        });
    } else {
        empty = 'empty'
    }
    const [replaceValue, setReplaceValue] = useState(replacement);
    const replaceValueRef = useRef(replacement);

    useEffect(() => {
        replaceValueRef.current = replaceValue;
    }, [replaceValue]);

    const onValueDropdown = (e: React.MouseEvent<HTMLSpanElement>) => {
        e.stopPropagation();
        const regex = /\{(.*?)\}/;
        const match = props.name.match(regex);
        if (match && match[1]) {
            setInputValue(replaceValueRef.current);
            invoke('query_history_vars', {
                dataViewId: props.viewId,
                varName: match[1],
                limit: 10
            }).then((r: any) => {
                setIsMenuOpen((prev) => !prev);

                if (r.histories) {
                    const arrays = r.histories.map((h: string) => {
                        return {value: h}
                    });
                    setHistoryItems(arrays);
                    setHistoryVisible(true);
                    setTimeout(() => {
                        historyInputRef.current?.focus();
                    }, 300);
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
    }

    const varClass = containVars ? 'vars' : '';
    const typeChar = props.keyType?.substring(0, 1).toUpperCase();

    return <>
        <Flex align={"center"} className={'var-node'} gap={4}>
            <div className={`key-type-prefix redis-type ${props.keyType} uncertainty`}
                 style={{display: props.keyType ? undefined : 'none'}}>
                {typeChar}
            </div>

            <Popover
                isOpen={isMenuOpen}
                positions={['bottom']} // preferred positions by priority
                align={'start'}
                onClickOutside={() => setIsMenuOpen(false)} // handle click events outside of the popover/target here!
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
                                    console.log('escape')
                                    setIsMenuOpen(false);
                                }
                            }}
                            onPressEnter={e => {
                                // eslint-disable-next-line
                                // @ts-ignore
                                setReplaceValue(e.target.value);
                                setHistoryVisible(false);
                                setIsMenuOpen(false);
                            }}
                            placeholder={'Change Variable ⏎'}
                        />
                        <div className={'input-divider'}/>
                        <div className={'history-items'}>
                            {
                                historyItems.map((item, i) => {
                                    return <Flex className={'data-value-item'} key={i} align={'center'}
                                                 justify={"center"} gap={4}
                                                 onClick={e => onHistoryItemSelected(e, item)}>
                                        <div className={'data-value'}>{item.value}</div>
                                    </Flex>
                                })
                            }
                        </div>
                    </Flex>
                </>}>
                <div className={`runtime-value ${empty}`}
                     onClick={onValueDropdown}>
                    {replaceValue}
                </div>
            </Popover>

            <div className={`origin-name ${varClass}`}>{props.name}</div>
        </Flex>
    </>
}

export default VarNode;