import Editor, {BeforeMount, OnMount} from "@monaco-editor/react";
import React, {useEffect, useRef, useState} from "react";
import {redisScriptEditorOptions} from "../redis-scripts/RedisScriptHelper.tsx";
import {writeText} from "@tauri-apps/plugin-clipboard-manager";


export type OnChange = (value: string | undefined, ev: any, keyType: string | undefined, changed: boolean) => void;

interface CommonValueViewerProp {
    height: string
    value: string
    onChanged: OnChange
    command?: CommandAction
    onSave?: (value: string, transmission?: any) => void
    keyType: string | undefined
}

export interface CommandAction {
    command: Command;
    ts: number;
    transmission: any;
}

export enum Command {
    NONE,
    FORMAT_DOCUMENT,
    COPY_DOCUMENT,
    ON_SAVE
}

const CommonValueViewer: React.FC<CommonValueViewerProp> = (props, context) => {
    const editorRef = useRef<any>(null);
    const [language, setLanguage] = useState('text');
    const [keyType, setKeyType] = useState(props.keyType);
    const [changed, setChanged] = useState(false);
    const initialValue = useRef('');

    const handleEditorWillMount: BeforeMount = (monaco) => {
        monaco.editor.defineTheme("redis-theme", {
            base: "vs-dark", // can also be vs-dark or hc-black
            inherit: true, // can also be false to completely replace the builtin rules
            rules: [
                {
                    token: "keyword",
                    foreground: "#BC77B1",
                },
                {
                    token: "comment",
                }
            ],
            colors: {
                // "editor.foreground": "#000000",
            },
        });
    };

    useEffect(() => {
        let languageTmp = "text";
        if (props.value) {
            const trimStr = props.value.trimStart();
            if (trimStr.startsWith("{") || trimStr.startsWith("[")) {
                languageTmp = 'json';
            } else {
                languageTmp = 'text';
            }
        }
        setLanguage(languageTmp);
        setKeyType(props.keyType);
        initialValue.current = props.value;
        setChanged(false);
    }, [props.value]);

    useEffect(() => {
        if (props.command) {
            switch (props.command.command) {
                case Command.FORMAT_DOCUMENT:
                    editorRef.current?.trigger('', 'editor.action.formatDocument', {});
                    break;
                case Command.COPY_DOCUMENT:
                    writeText(editorRef.current?.getValue()).then(r => {
                    });
                    break;
                case Command.ON_SAVE:
                    if (props.onSave) {
                        props.onSave(editorRef.current?.getValue(), props.command.transmission);
                    }
                    break
            }
        }
    }, [props.command]);

    const onMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
    };

    return <>
        <Editor
            className={'value-viewer'}
            height={'67vh'}
            language={language}
            theme={"redis-theme"}
            beforeMount={handleEditorWillMount}
            onMount={onMount}
            value={props.value}
            onChange={(v, e) => {
                props.onChanged(v, e, keyType, initialValue.current != v);
            }}
            options={{
                ...redisScriptEditorOptions,
                lineNumbers: 'off',
                automaticLayout: true,
            }}
        />
    </>;
}

export default CommonValueViewer;