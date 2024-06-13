// import RedisToolbar from "../../RedisToolbar.tsx";
import React, {useEffect, useState} from "react";
import ContentEditor from "../../editor/ContentEditor/ContentEditor.tsx";
import {redisScriptEditorOptions} from "../../redis/redis-scripts/RedisScriptHelper.tsx";
import Editor, {BeforeMount, OnChange, OnMount, OnValidate} from "@monaco-editor/react";
// import ContentEditor from "../../../editor/ContentEditor/ContentEditor.tsx";
// import {rust_invoke} from "../../../../utils/RustIteractor.tsx";
import "./TextOperator.less";

interface TextOperatorProps {
    data: string,
    language: string,
    onClose?: React.MouseEventHandler<HTMLSpanElement>;
}

const TextOperator: React.FC<TextOperatorProps> = (props, context) => {
    const [key, setKey] = useState('');
    const [keyType, setKeyType] = useState('');
    const [contentData, setContentData] = useState(props.data);
    // 捕获hash的key值发生了变化，变化后需要重新请求后端数据加载
    useEffect(() => {
        // if (props.data && props.data.keyType == 'string') {
        //     setKey(props.data.key);
        //     setKeyType(props.data.keyType);
        //     rust_invoke("redis_get_string", {
        //         key: props.data.key,
        //     }).then(r => {
        //         const obj = JSON.parse(r as string);
        //         setContentData(obj.content)
        //     });
        // }
    }, [props.data]);
    const handleEditorChange: OnChange = (value, ev) => {
        // 内容变更回调
    }
    const handleEditorDidMount: OnMount = (editor, monaco) => {
        console.log('onMount: the editor instance:', editor);
        console.log('onMount: the monaco instance:', monaco);

        monaco.languages.registerCompletionItemProvider('javascript', {
            provideCompletionItems: function (model: any, position: any) {
                return {
                    suggestions: [
                        {
                            label: 'SELECT',
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: 'SELECTssssssss '
                        },
                        {label: 'FROM', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'FROM '},
                        {label: 'WHERE', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'WHERE '}
                    ]
                };
            }
        })
    }

    const handleEditorWillMount: BeforeMount = (monaco) => {
        console.log('beforeMount: the monaco instance:', monaco);
    }

    const handleEditorValidation: OnValidate = (markers) => {
        // model markers
        // markers.forEach(marker => console.log('onValidate:', marker.message));
    }
    return <>
        <Editor
            className={'zookeeper-value-editor'}
            options={{
                ...redisScriptEditorOptions,
                lineNumbers: 'off',
                automaticLayout: true,
            }}
            height="90vh"
            language={props.language}
            theme={"vs-dark"}
            value={props.data}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            beforeMount={handleEditorWillMount}
            onValidate={handleEditorValidation}
        />
    </>
};

export default TextOperator;