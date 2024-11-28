import React, {forwardRef, useRef} from "react";
import HashOperator from "./hash/HashOperator.tsx";
import {Flex} from "antd";
import RedisToolbar from "../toolbar/RedisToolbar.tsx";
import ZSetOperator from "./zset/ZSetOperator.tsx";
import StringOperator from "./string/StringOperator.tsx";
import ListOperator from "./list/ListOperator.tsx";
import SetOperator from "./set/SetOperator.tsx";

export interface RedisOperatorRef {
    reload: () => void;
}

interface RedisTypeEditorRef {

}

export interface FieldInfo {
    redisKey: string;
    keyType?: string;

    key?: string;
    field?: string;
    value?: string;
    type: string;
    dataType: string;
}

export interface RedisKeyInfo {
    keyName: string;
    keyType: string | 'hash' | 'zset' | 'list' | 'set' | 'string';
}

interface RedisTypeEditorProps {
    datasource: number;
    database: number;
    keyInfo: RedisKeyInfo;
    pinMode?: boolean;
    onFieldSelected: (field: FieldInfo) => void;
    onClose?: () => void;
}

const RedisTypeEditor: React.FC<RedisTypeEditorProps> = forwardRef<RedisTypeEditorRef | undefined, RedisTypeEditorProps>((props, ref) => {
    const typeOperatorRef = useRef<RedisOperatorRef>();
    let operator: React.ReactNode;
    switch (props.keyInfo.keyType) {
        case 'hash':
            operator = (
                <HashOperator
                    ref={typeOperatorRef}
                    data={props.keyInfo}
                    datasourceId={props.datasource}
                    selectedDatabase={props.database}
                    onFieldSelected={props.onFieldSelected}
                    pinMode={props.pinMode}/>)
            break;
        case 'zset':
            operator = (
                <ZSetOperator
                    ref={typeOperatorRef}
                    data={props.keyInfo}
                    datasourceId={props.datasource}
                    selectedDatabase={props.database}
                    onFieldSelected={props.onFieldSelected}
                    pinMode={props.pinMode}/>)
            break;
        case 'list':
            operator = (
                <ListOperator
                    ref={typeOperatorRef}
                    data={props.keyInfo}
                    datasourceId={props.datasource}
                    selectedDatabase={props.database}
                    onFieldSelected={props.onFieldSelected}
                    pinMode={props.pinMode}/>)
            break;
        case 'set':
            operator = (
                <SetOperator
                    ref={typeOperatorRef}
                    data={props.keyInfo}
                    datasourceId={props.datasource}
                    selectedDatabase={props.database}
                    onFieldSelected={props.onFieldSelected}
                    pinMode={props.pinMode}/>
            )
            break;
        case 'string':
            operator = (
                <StringOperator
                    ref={typeOperatorRef}
                    data={props.keyInfo}
                    datasourceId={props.datasource}
                    selectedDatabase={props.database}
                    onFieldSelected={props.onFieldSelected}
                    pinMode={props.pinMode}/>)
            break
    }

    const onReload = () => {
        typeOperatorRef.current?.reload();
    };

    return <>
        <Flex className={'redis-type-editor-container'} vertical={true}>
            {/* toolbar */}
            <RedisToolbar keyName={props.keyInfo.keyName}
                          keyType={props.keyInfo.keyType}
                          pinMode={props.pinMode}
                          onReload={onReload}
                          datasourceId={props.datasource}
                          selectedDatabase={props.database}
                          onClose={props.onClose}
            />

            {/* operator */}
            {operator}

            {/* footer */}
        </Flex>
    </>
});

RedisTypeEditor.displayName = 'RedisTypeEditor';
export default RedisTypeEditor;