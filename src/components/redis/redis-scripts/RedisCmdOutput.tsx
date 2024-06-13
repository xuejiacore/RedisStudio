import React, {FC, useRef} from "react";
import Editor, {BeforeMount, OnChange, OnMount, OnValidate} from "@monaco-editor/react";
import {redisCompletionFunction, redisScriptEditorOptions} from "./RedisScriptHelper.tsx";

interface RedisCmdOutputProp {

}

const RedisCmdOutput: FC<RedisCmdOutputProp> = (props, context) => {
    const editorRef = useRef(null);
    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
    }

    const handleEditorWillMount: BeforeMount = (monaco) => {
        monaco.editor.defineTheme("redis-output-theme", {
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
                // "editor.background": "#000000",
            },
        });
    }

    return <>
        <Editor
            height="100vh"
            defaultLanguage="text"
            theme={"redis-theme"}
            defaultValue="dbsize3"
            onMount={handleEditorDidMount}
            beforeMount={handleEditorWillMount}
            options={{
                "readOnly": true,
                "lineNumbers": "off",
                "minimap": {
                    enabled: false
                },
            }}
        />
    </>
}

export default RedisCmdOutput;
