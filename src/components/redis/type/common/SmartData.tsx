import React, {useEffect, useRef, useState} from "react";
import "../datatable.less";
import {Flex, Input, InputRef, Tooltip} from "antd";
import {convertTimestampToDateWithMillis} from "../../../../utils/TimeUtil.ts";

export interface UpdateEvent {
    keyName: string;
    fieldName: string;
    value: string;
}

interface SmartDataProp {
    value: any;
    keyName: string;
    fieldName: string;
    editable?: boolean;
    onChange?: (event: UpdateEvent) => void;
}

const SmartData: React.FC<SmartDataProp> = (props, context) => {
    const [editing, setEditing] = useState(false);
    const [inputValue, setInputValue] = useState(props.value);
    const inputRef = useRef<InputRef>(null);
    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
        }
    }, [editing]);
    const toggleEdit = () => {
        setEditing(!editing);
    };
    const save = async () => {
        try {
            toggleEdit();
            props.onChange?.({keyName: props.keyName, fieldName: props.fieldName, value: props.value});
        } catch (errInfo) {
            console.log('Save failed:', errInfo);
        }
    };
    let node;
    if (inputValue == '') {
        node = <i className={'empty-data'}>&lt;Empty&gt;</i>
    } else if (inputValue) {
        if (inputValue == 'null') {
            node =
                <div className='table-row-data null-text' onDoubleClick={toggleEdit}>
                    <Tooltip className={'tooltips'} title={'`null` string'} placement={"right"} color={'#424449'}>
                        {inputValue}
                    </Tooltip>
                </div>
            ;
        } else {
            const strVal = inputValue.toString();
            const val = convertTimestampToDateWithMillis(strVal);
            if (val != strVal) {
                node = <>
                    <div className='table-row-data' onDoubleClick={toggleEdit}>
                        <Tooltip className={'tooltips'} title={val} placement={"right"} color={'#424449'}>
                            {inputValue}
                        </Tooltip>
                    </div>
                </>
            } else {
                node = <div className='table-row-data' onDoubleClick={toggleEdit}>{inputValue}</div>;
            }
        }
    } else {
        node = <div className='table-row-data null' onDoubleClick={toggleEdit}>{inputValue}</div>;
    }
    const c = editing ? (
        <Flex className='table-row-data editing'>
            <Input value={inputValue} onChange={e => setInputValue(e.target.value)} ref={inputRef} onPressEnter={save}
                   onBlur={save}/>
        </Flex>
    ) : node;
    return <>
        {c}
    </>
}

export default SmartData;