/* eslint-disable */
import React, {useEffect, useRef, useState} from "react";
import "./ModifyKeyCreator.less";
import {Flex, Input, InputRef} from "antd";
import {Window} from '@tauri-apps/api/window';
import {rust_invoke} from "../../utils/RustIteractor.tsx";

interface ModifyKeyCreatorProps {

}

const ModifyKeyCreator: React.FC<ModifyKeyCreatorProps> = (props: ModifyKeyCreatorProps) => {
    const [keyType, setKeyType] = useState('unknown');
    const [status, setStatus] = useState('');
    const [submitBtnStatus, setSubmitBtnStatus] = useState('disabled');
    const [datasource, setDatasource] = useState('');
    const [currentName, setCurrentName] = useState('');
    const [currentInputValue, setCurrentInputValue] = useState('');
    const [operator, setOperator] = useState('modify');
    const [title, setTitle] = useState('');
    const [submitBtnName, setSubmitBtnName] = useState('Submit');
    const inputRef = useRef<InputRef>(null);

    const onKeyModify = (originKey: string, type: string, datasource: string, operator: string) => {
        setCurrentInputValue(originKey);
        setCurrentName(originKey);
        setKeyType(type);
        setDatasource(datasource);
        setOperator(operator);
        switch (operator) {
            case 'modify':
                setTitle("Key Modification");
                setSubmitBtnName("Rename");
                break;
            case 'duplicate':
                setTitle("Duplicate Key");
                setSubmitBtnName("Duplicate");
                break;
        }
    };

    useEffect(() => {
        // @ts-ignore
        window.onKeyModify = onKeyModify;
        return () => {
            // @ts-ignore
            delete window.onKeyModify;
        };
    }, []);

    const onCancel = () => {
        Window.getByLabel("modify-key-win").then(r => r?.close());
    }

    const onSubmit = () => {
        const inputKey = inputRef.current!.input!.value;
        if (submitBtnStatus == 'disabled') {
            return;
        }
        console.log(inputKey + "\t" + datasource);
        // rust_invoke("redis_new_key", {
        //     datasource_id: "datasource01",
        //     key: inputKey,
        //     key_type: keyType,
        // }).then(r => {
        //     Window.getByLabel("create-new-key").then(r => r?.close());
        //     emitTo("main", "key-tree/new-key", {
        //         keyType: keyType,
        //         key: inputKey,
        //     }).finally();
        // })
    }

    const onChange = () => {
        const inputKey = inputRef.current!.input!.value;
        setCurrentInputValue(inputKey);
        if (inputKey) {
            rust_invoke("redis_key_info", {
                datasource_id: 'datasource01',
                key: inputKey,
                key_type: 'unknown'
            }).then(r => {
                const keyInfo = JSON.parse(r as string);
                if (keyInfo.exists === 1) {
                    setStatus('warn');
                    setSubmitBtnStatus('disabled');
                } else {
                    setStatus('success');
                    setSubmitBtnStatus('');
                }
            });
        } else {
            setStatus('');
            setSubmitBtnStatus('disabled');
        }
    }

    // noinspection HtmlUnknownBooleanAttribute
    return <>
        <Flex className={'create-new-key-window'} justify={"center"} align={"center"} vertical={true}>
            <Flex data-tauri-drag-region className={'title-area'} justify={"center"} align={"center"} gap={4}>
                <div data-tauri-drag-region className={'title'}>{title}</div>
                <span className={`tips ${status}`}/>
            </Flex>

            <Flex className={'container'} vertical={true} gap={10} justify={"center"} align={"center"}>
                <Flex className={'input-area'} justify={"start"} align={"center"} gap={6}>
                    <div className={'label'}>Current Name:</div>
                    <div className={`current-name ${keyType}`}>{currentName}</div>
                    <div className={`key ${keyType}`}>{keyType.charAt(0).toUpperCase() + keyType.slice(1)}</div>
                </Flex>

                <Flex className={'input-area'} justify={"center"} align={"center"} gap={6}>
                    <div className={'label'}>New Key Name:</div>
                    <Input ref={inputRef} className={'input'} size={"small"} autoFocus={true} onChange={onChange}
                           placeholder={currentName} value={currentInputValue}/>
                </Flex>
                <Flex className={'form'} justify={"end"} align={"end"} gap={4}>
                    <div className={'button cancel'} onClick={onCancel}>Cancel</div>
                    <div className={`button submit ${submitBtnStatus}`} onClick={onSubmit}>{submitBtnName}</div>
                </Flex>
            </Flex>

        </Flex>
    </>
}

export default ModifyKeyCreator;