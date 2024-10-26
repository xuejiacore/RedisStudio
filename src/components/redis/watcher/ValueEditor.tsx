import React, {useEffect, useRef, useState} from "react";
import {Button, Col, Divider, Input, InputRef, Row, Space} from "antd";
import CommonValueViewer, {Command, CommandAction, OnChange} from "../util/CommonValueViewer.tsx";
import {CopyOutlined, DeleteOutlined, FormatPainterOutlined, SettingOutlined} from "@ant-design/icons";
import "../../../utils/i18n.ts";
import {useTranslation} from "react-i18next";
import {emitTo} from "@tauri-apps/api/event";
import {redis_invoke} from "../../../utils/RustIteractor.tsx";


const {TextArea} = Input;

export interface ValueChanged {
    key?: string
    field?: string
    value?: string
    redisKey: string
    type: string // FIELD_CLK/ADD_ROW
    dataType: string
    keyType?: string
}

export interface UpdateRequest {
    ts?: number;
    field: string | undefined;
    oldField?: string;
    value?: string;
    key: string;
    type: string;
    transmission?: any;
    fieldRename?: boolean;
}

interface UpdateResult {
    success: boolean,
    msg: string
}

interface ValueViewerProp {
    data?: ValueChanged;

    datasourceId: string;
    selectedDatabase: number;
}

const COMMIT_TYPE_UPDATE = 1;
const COMMIT_TYPE_NEW = 2;
const ValueEditor: React.FC<ValueViewerProp> = (props, context) => {

    const {t} = useTranslation();
    const fieldValueRef = useRef<InputRef>(null);
    const contentValueRef = useRef<InputRef>(null);
    const [fieldValue, setFieldValue] = useState<string>();
    const [contentValue, setContentValue] = useState(props.data?.value);
    const [editorChanged, setEditorChanged] = useState(false);
    const [inputChanged, setInputChanged] = useState(false);
    const [valueCommand, setValueCommand] = useState<CommandAction>();

    const [contentLabel, setContentLabel] = useState('');
    const [transmission, setTransmission] = useState<ValueChanged>()
    const [inputAreaInvisible, setInputAreaInvisible] = useState('');
    const [labelOfFieldName, setLabelOfFieldName] = useState('');
    const [commitType, setCommitType] = useState(1); // 1 更新，2新增
    const inputInitialValue = useRef<string>();
    const oldValue = useRef<string>();
    const currKeyType = useRef('');

    const handleChangeValue = (e: any) => {
        const changed = inputInitialValue.current != e.target.value;
        setInputChanged(changed);
        setFieldValue(e.target.value);
        console.log(changed + "\t" + currKeyType.current)
        if (changed) {
            if (currKeyType.current == 'hash') {
                setCommitType(COMMIT_TYPE_NEW);
            } else {
                setCommitType(COMMIT_TYPE_UPDATE);
            }
        } else {
            if (currKeyType.current == 'hash') {
                setCommitType(COMMIT_TYPE_UPDATE);
            } else {
                setCommitType(COMMIT_TYPE_NEW);
            }
        }
    };

    const onEditorChanged: OnChange = (val, ev, keyType, changed) => {
        if (changed) {
            if (keyType == 'zset') {
                setCommitType(COMMIT_TYPE_NEW);
            } else {
                setCommitType(COMMIT_TYPE_UPDATE);
            }
        } else {
            if (inputChanged) {
                setCommitType(COMMIT_TYPE_UPDATE);
            } else {
                setTimeout(() => {
                    setCommitType(COMMIT_TYPE_UPDATE);
                }, 300);
            }
        }

        setEditorChanged(changed);
        //setContentValue(val);


        // 判断是否是会导致变成新数据项的变化类型
        console.log('当前变更的数据类型', keyType, val, changed);

    };

    const saveChanged = (editorVal: string, transmission: any) => {
        const req: UpdateRequest = {
            key: props.data!.redisKey!,
            type: props.data!.dataType!,
            field: fieldValueRef.current?.input?.value,
            value: editorVal,
            transmission: transmission
        };

        const payload = {
            key: req.key,
            key_type: req.type,
            field: req.field,
            value: req.value,
            old_value: oldValue.current,
            datasource_id: 'datasource01'
        };

        redis_invoke('redis_update', payload, props.datasourceId, props.selectedDatabase).then(r => {
            const ret: UpdateResult = JSON.parse(r as string);
            if (ret.success) {
                if (req.type == 'zset') {
                    oldValue.current = req.field;
                } else {
                    oldValue.current = req.value;
                }
                setEditorChanged(false);
                emitTo('main', 'redis/update-value', req).finally();
            } else {
                console.error(`fail to update redis value, key = ${req.key}, keyType = ${req.type}, field = ${req.field}, value = ${req.value}, msg = ${ret.msg}`);
            }
        })
    };

    useEffect(() => {
        setTransmission(props.data);
        console.log('ValueEditor', props.data);
        if (props.data?.type == 'FIELD_CLK' || props.data?.type == 'KEY_CLK') {
            const keyType = props.data?.dataType;
            let field = props.data?.field;
            let value = props.data?.value;

            if (props.data?.type == 'KEY_CLK') {
                field = '';
                value = '';
            } else {
                setCommitType(COMMIT_TYPE_UPDATE);
                oldValue.current = value;
            }

            setLabelOfFieldName(t(`redis.main.right_panel.tabs.value.field_name_${keyType}`));
            const labelOfContent = t(`redis.main.right_panel.tabs.value.content_${keyType}`);
            let fieldInputVisible = true;
            let fieldRealValue = field;
            currKeyType.current = keyType;
            if (keyType == 'hash') {
                setContentValue(value);
                setContentLabel(labelOfContent);
            } else if (keyType == 'zset') {
                setContentValue(field);
                setContentLabel(labelOfContent);
                fieldRealValue = value;
            } else if (keyType == 'list') {
                setFieldValue(field);
                setContentValue(value);
                fieldInputVisible = false;
                setContentLabel(labelOfContent);
            } else if (keyType == 'set') {
                setContentValue(value);
                fieldInputVisible = false;
                setContentLabel(labelOfContent);
            } else {
                setContentValue('');
            }

            if (fieldInputVisible) {
                setFieldValue(fieldRealValue);
                inputInitialValue.current = fieldRealValue;
                setInputAreaInvisible('');
            } else {
                setInputAreaInvisible('invisible');
            }

            setEditorChanged(false);
        } else if (props.data?.type == 'ADD_ROW') {
            fieldValueRef.current?.focus();
            setFieldValue('');
            setContentValue('');
            setCommitType(COMMIT_TYPE_NEW);
        }
    }, [props.data]);

    const setCommandAction = (cmd: Command, transmission: any) => {
        setValueCommand({
            command: cmd,
            ts: new Date().getDate(),
            transmission: transmission
        });
    }

    return <>
        <div className={'value-viewer-container'}>

            <div className={`field-input-area ${inputAreaInvisible}`}>
                <Divider className={'divider first-divider'} orientation="left">
                    <Space>
                        {labelOfFieldName}

                        <DeleteOutlined className={'toolbar-btn delete-field'}/>

                    </Space>
                </Divider>
                <Input ref={fieldValueRef}
                       size={"small"}
                       className={'field-viewer'}
                       value={fieldValue}
                       onChange={handleChangeValue}
                       autoCapitalize={'none'}
                       autoCorrect={'off'}
                />
            </div>

            <Divider className={'divider'} orientation="left">
                <Space>
                    {contentLabel}

                    <FormatPainterOutlined
                        className={'toolbar-btn'}
                        onClick={() => setCommandAction(Command.FORMAT_DOCUMENT, transmission)}/>

                    <CopyOutlined
                        className={'toolbar-btn'}
                        onClick={() => setCommandAction(Command.COPY_DOCUMENT, transmission)}/>

                    <SettingOutlined className={'toolbar-btn'}/>
                </Space>
            </Divider>

            <CommonValueViewer height={'calc(100vh-30px)'}
                               value={contentValue as string}
                               keyType={props.data?.dataType}
                               onChanged={onEditorChanged}
                               command={valueCommand}
                               onSave={saveChanged}/>
        </div>

        <div className={'value-viewer-footer-tools'}>
        </div>

        <Row>
            <Col span={20}></Col>
            <Col span={4}>
                <Button type="default" size="small"
                        className={`footer-apply-button ${inputChanged || editorChanged ? 'visible' : ''} ${commitType == 1 ? 'update' : 'new'}`}
                        onClick={() => setCommandAction(Command.ON_SAVE, transmission)}>
                    {t(`redis.main.right_panel.tabs.value.${commitType == 1 ? 'update' : 'new'}`)}
                </Button>
            </Col>
        </Row>

    </>
};

export default ValueEditor;