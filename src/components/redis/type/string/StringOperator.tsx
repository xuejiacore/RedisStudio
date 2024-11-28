import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from "react";
import ContentEditor from "../../../editor/ContentEditor/ContentEditor.tsx";
import {redis_invoke} from "../../../../utils/RustIteractor.tsx";
import {FieldInfo, RedisKeyInfo, RedisOperatorRef} from "../RedisTypeEditor.tsx";

interface StringOperatorProps {
    data: RedisKeyInfo,
    pinMode?: boolean;
    onClose?: React.MouseEventHandler<HTMLSpanElement>;
    onFieldSelected: (field: FieldInfo) => void;

    datasourceId: number;
    selectedDatabase: number;
}

const StringOperator = forwardRef<RedisOperatorRef | undefined, StringOperatorProps>((props, ref) => {
    const [datasource, setDatasource] = useState(props.datasourceId);
    const [database, setDatabase] = useState(props.selectedDatabase);
    const datasourceRef = useRef(datasource);
    const databaseRef = useRef(database);

    useEffect(() => {
        setDatasource(props.datasourceId);
        setDatabase(props.selectedDatabase);
        datasourceRef.current = props.datasourceId;
        databaseRef.current = props.selectedDatabase;
    }, [props.datasourceId, props.selectedDatabase]);

    useImperativeHandle(ref, () => ({
        reload: () => {
            onReload();
        }
    }));

    const [key, setKey] = useState('');
    const [keyType, setKeyType] = useState('');
    const [contentData, setContentData] = useState('');
    const [language, setLanguage] = useState('text');
    // 捕获hash的key值发生了变化，变化后需要重新请求后端数据加载
    useEffect(() => {
        if (props.data && props.data.keyType == 'string') {
            setKey(props.data.keyName);
            setKeyType(props.data.keyType);
            redis_invoke("redis_get_string", {
                key: props.data.keyName,
            }, props.datasourceId, props.selectedDatabase).then(r => {
                const obj = JSON.parse(r as string);
                let languageTmp = "text";
                if (obj.content) {
                    const trimStr = obj.content.trimStart();
                    if (trimStr.startsWith("{") || trimStr.startsWith("[")) {
                        languageTmp = 'json';
                    } else {
                        languageTmp = 'text';
                    }
                }
                setLanguage(languageTmp);
                setContentData(obj.content)
            });
        }
    }, [props.data]);
    const onReload = () => {

    }
    return <>
        <ContentEditor defaultValue={''} value={contentData} pinMode={props.pinMode} language={language}/>
    </>
});

StringOperator.displayName = "StringOperator";
export default StringOperator;