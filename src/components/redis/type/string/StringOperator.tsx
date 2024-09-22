import RedisToolbar from "../../toolbar/RedisToolbar.tsx";
import React, {useEffect, useState} from "react";
import ContentEditor from "../../../editor/ContentEditor/ContentEditor.tsx";
import {rust_invoke} from "../../../../utils/RustIteractor.tsx";
import {FooterAction} from "../../footer/RedisFooter.tsx";

interface StringOperatorProps {
    data: any,
    pinMode?: boolean;
    onClose?: React.MouseEventHandler<HTMLSpanElement>;
    onReload?: () => void;
}

const StringOperator: React.FC<StringOperatorProps> = (props, context) => {
    const [key, setKey] = useState('');
    const [keyType, setKeyType] = useState('');
    const [contentData, setContentData] = useState('');
    const [language, setLanguage] = useState('text');
    // 捕获hash的key值发生了变化，变化后需要重新请求后端数据加载
    useEffect(() => {
        if (props.data && props.data.keyType == 'string') {
            setKey(props.data.key);
            setKeyType(props.data.keyType);
            rust_invoke("redis_get_string", {
                key: props.data.key,
            }).then(r => {
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
        if (props.onReload) {
            props.onReload();
        }
    }
    return <>
        <RedisToolbar keyName={key} keyType={keyType} pinMode={props.pinMode} onClose={props.onClose}
                      onReload={onReload}/>

        <ContentEditor defaultValue={''} value={contentData} pinMode={props.pinMode} language={language}/>
    </>
};

export default StringOperator;