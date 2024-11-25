import React, {useRef, useState} from "react";
import {Flex, Input} from "antd";
import "./VarNode.less";
import "./VarNodeEditor.less";

interface VarNodeEditorProps {
    data: any;
    parent: any;
    onCancel: (data: any) => void;
    onSave: (data: any) => void;
}

const VarNodeEditor: React.FC<VarNodeEditorProps> = (props, context) => {
    const [typeSelectorVisible, setTypeSelectorVisible] = useState(false);
    const value = useRef<string>();
    const selectorVisible = useRef(typeSelectorVisible);
    const onTypeSelector = () => {
        const curr = !typeSelectorVisible;
        setTypeSelectorVisible(curr);
        selectorVisible.current = curr;
    }

    return <>
        <Flex align={"center"} className={'var-node var-node-editor'} gap={4}>
            <div>
                <div className={`key-type-prefix redis-type unknown`} onClick={onTypeSelector}>
                    U
                </div>
                <Flex justify={"center"} align={"start"}
                      className={`type-selector ${typeSelectorVisible ? '' : 'invisible'}`} vertical={true}>
                    <div className={'type-selector-item'}>
                        <span className={'key-type-prefix redis-type string'}>S</span>
                        <span className={'type-desc'}>String</span>
                    </div>
                    <div className={'type-selector-item'}>
                        <span className={'key-type-prefix redis-type hash'}>H</span>
                        <span className={'type-desc'}>Hash</span>
                    </div>
                    <div className={'type-selector-item'}>
                        <span className={'key-type-prefix redis-type set'}>S</span>
                        <span className={'type-desc'}>Set</span>
                    </div>
                    <div className={'type-selector-item'}>
                        <span className={'key-type-prefix redis-type zset'}>Z</span>
                        <span className={'type-desc'}>ZSet</span>
                    </div>
                    <div className={'type-selector-item'}>
                        <span className={'key-type-prefix redis-type list'}>L</span>
                        <span className={'type-desc'}>List</span>
                    </div>
                </Flex>
            </div>
            <Input
                className={'name-input'}
                autoComplete={'off'}
                spellCheck={false}
                onChange={e => {
                    value.current = e.target.value;
                }}
                autoFocus={true}
                onKeyDown={e => {
                    if (e.code === 'Escape') {
                        props.onCancel(props.data);
                    }
                }}
                onBlur={(e) => {
                    if (!selectorVisible.current) {
                        props.onCancel(props.data);
                    }
                }}
                onPressEnter={e => {
                    const update = props.data;
                    update.key = value.current;
                    // eslint-disable-next-line
                    // @ts-ignore
                    update.path = `${props.parent.path}:${value.current}`;
                    update.node_type = 3;
                    props.onSave(update);
                }}
                // style={{width: props.pinMode ? '60px' : '10vw'}}
                placeholder={'Key Name ⏎'}
            />
        </Flex>
    </>
}

export default VarNodeEditor;