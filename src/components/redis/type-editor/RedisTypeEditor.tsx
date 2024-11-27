import React, {forwardRef} from "react";
import HashOperator from "../type/hash/HashOperator.tsx";
import {Flex} from "antd";
import RedisToolbar from "../toolbar/RedisToolbar.tsx";
import ZSetOperator from "../type/zset/ZSetOperator.tsx";
import StringOperator from "../type/string/StringOperator.tsx";
import ListOperator from "../type/list/ListOperator.tsx";
import SetOperator from "../type/set/SetOperator.tsx";

interface RedisTypeEditorRef {

}

interface FieldInfo {
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
    onFieldClicked: (field: FieldInfo) => void;
}

const RedisTypeEditor: React.FC<RedisTypeEditorProps> = forwardRef<RedisTypeEditorRef | undefined, RedisTypeEditorProps>((props, ref) => {
    const onFieldClicked = (data: any) => {
        //props?.onFieldClicked();
    };

    let operatorComponent: React.ReactNode;
    switch (props.keyInfo.keyType) {
        case 'hash':
            operatorComponent = (
                <HashOperator data={props.keyInfo}
                              onFieldClicked={onFieldClicked}
                              datasourceId={props.datasource}
                              selectedDatabase={props.database}/>)
            break;
        case 'zset':
            operatorComponent = (
                <ZSetOperator data={props.keyInfo}
                              onFieldClicked={onFieldClicked}
                              datasourceId={props.datasource}
                              selectedDatabase={props.database}/>)
            break;
        case 'list':
            operatorComponent = (
                <ListOperator data={props.keyInfo}
                              onFieldClicked={onFieldClicked}
                              datasourceId={props.datasource}
                              selectedDatabase={props.database}
                />)
            break;
        case 'set':
            operatorComponent = (
                <SetOperator data={props.keyInfo}
                             onFieldClicked={onFieldClicked}
                             datasourceId={props.datasource}
                             selectedDatabase={props.database}/>
            )
            break;
        case 'string':
            operatorComponent = (
                <StringOperator data={props.keyInfo}
                                datasourceId={props.datasource}
                                selectedDatabase={props.database}/>)
            break
    }

    const onReload = () => {

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
            />

            {/* operator */}
            {operatorComponent}

            {/* footer */}
        </Flex>
    </>
});

RedisTypeEditor.displayName = 'RedisTypeEditor';
export default RedisTypeEditor;