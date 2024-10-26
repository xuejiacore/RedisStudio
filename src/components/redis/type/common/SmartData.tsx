import React, {useEffect, useRef, useState} from "react";
import "../datatable.less";
import {Flex, Input, InputRef, Tooltip} from "antd";
import {convertTimestampToDateWithMillis} from "../../../../utils/TimeUtil.ts";

export interface UpdateEvent {
    editId?: string;
    keyName: string;
    fieldName: string;
    value: string;
    oldValue: string;
}

interface SmartDataProp {
    value: any;
    keyName: string;
    fieldName?: string;
    onChange?: (event: UpdateEvent) => void;
    editable?: boolean;
    editId?: string;
    placeholder?: string;
}

const SmartData: React.FC<SmartDataProp> = (props, context) => {
    const [editing, setEditing] = useState(props.editable);
    const [inputValue, setInputValue] = useState(props.value);
    const [beforeValue, setBeforeValue] = useState(props.value);
    const inputRef = useRef<InputRef>(null);
    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
        }
    }, [editing]);
    const toggleEdit = () => {
        setEditing(!editing);
    };
    const save = async (blurSave: boolean) => {
        if (props.editable && blurSave) {
            return;
        }
        try {
            toggleEdit();
            props.onChange?.({
                editId: props.editId,
                keyName: props.keyName,
                fieldName: props.fieldName ?? '',
                value: inputValue,
                oldValue: beforeValue
            });

            setBeforeValue(inputValue);
        } catch (errInfo) {
            console.log('Save failed:', errInfo);
        }
    };
    let node;
    if (inputValue === '') {
        node = <div className='table-row-data' onDoubleClick={toggleEdit}>
            <i className={'empty-data'}>&lt;Empty&gt;</i>
        </div>
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
            <Input
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={props.placeholder}
                onPressEnter={() => save(false)}
                onBlur={() => save(true)}/>
        </Flex>
    ) : node;
    return <>
        {c}
    </>
}

export default SmartData;