import React from 'react';

import Editor, {BeforeMount, OnChange, OnMount, OnValidate} from '@monaco-editor/react';
import {redisScriptEditorOptions} from "../../redis/redis-scripts/RedisScriptHelper.tsx";

interface ContentEditorProp {
    defaultValue: string,
    value?: string,
    pinMode?: boolean,
    language: string,
}

const ContentEditor: React.FC<ContentEditorProp> = (props, context) => {
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
            options={{
                ...redisScriptEditorOptions,
                lineNumbers: 'on',
                automaticLayout: true,
            }}
            height="90vh"
            language={props.language}
            theme={"vs-dark"}
            defaultValue={props.defaultValue}
            value={props.value}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            beforeMount={handleEditorWillMount}
            onValidate={handleEditorValidation}
        />
    </>
};

export default ContentEditor;