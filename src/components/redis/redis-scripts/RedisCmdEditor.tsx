import React, {FC, useRef} from "react";
import Editor, {BeforeMount, OnChange, OnMount, OnValidate} from "@monaco-editor/react";
import {redisCompletionFunction, redisScriptEditorOptions} from "./RedisScriptHelper.tsx";

interface RedisCmdEditorProp {

}

const RedisCmdEditor: FC<RedisCmdEditorProp> = (props, context) => {
    const editorRef = useRef(null);

    const handleEditorChange: OnChange = (value, ev) => {
        // 内容变更回调
    }

    const generateInsertText = () => {
        return
    }

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        console.log('onMount: the editor instance:', editor, editor.addAction);
        editorRef.current = editor;


        const action = {
            id: 'commitContent',
            label: 'commitContent',
            precondition: 'true',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
            run: () => {
                const selection = editor.getSelection();
                const model = editor.getModel();
                let scripts;
                if (model && selection) {
                    scripts = model.getValueInRange(selection);
                    if (!scripts) {
                        const position = selection.getStartPosition();
                        scripts = model.getLineContent(position.lineNumber);
                    } else {
                        const startLineNumber = selection.startLineNumber; // 行号从0开始
                        const endLineNumber = selection.endLineNumber;
                        let selectedLinesContent = '';

                        for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
                            const lineContent = model.getLineContent(lineNumber);
                            selectedLinesContent += lineContent + '\n';
                        }

                        scripts = selectedLinesContent.trim(); // 移除最后的换行符
                    }
                }
                // TODO: CMD+Enter 提交文本内容
                console.log('chrome: cmd + k: ', scripts, selection);
            },
        };
        editor.addAction(action);

        console.log('onMount: the monaco instance:', monaco);

        monaco.languages.registerCompletionItemProvider('redis', {
            provideCompletionItems: (model: any, position: any) => redisCompletionFunction(model, position, monaco),
            triggerCharacters: [".", "", " "]
        });
    }

    const handleEditorWillMount: BeforeMount = (monaco) => {
        console.log('beforeMount: the monaco instance:', monaco);
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
    }

    const handleEditorValidation: OnValidate = (markers) => {
        // model markers
        // markers.forEach(marker => console.log('onValidate:', marker.message));
    }

    return <>
        <Editor
            height="60vh"
            defaultLanguage="redis"
            theme={"redis-theme"}
            defaultValue="dbsize"
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            beforeMount={handleEditorWillMount}
            onValidate={handleEditorValidation}
            options={redisScriptEditorOptions}
        />
    </>
}

export default RedisCmdEditor;


// CompletionItemKind 的枚举值：
// Text: 普通的文本补全。
// Method: 方法或函数的补全。
// Function: 另一种函数或方法的补全，有时可能与 Method 有所不同。
// Constructor: 构造函数的补全。
// Field: 类或对象的字段的补全。
// Variable: 变量的补全。
// Class: 类的补全。
// Interface: 接口的补全。
// Module: 模块的补全。
// Property: 属性的补全。
// Unit: 单元或枚举成员的补全。
// Value: 值的补全。
// Enum: 枚举的补全。
// Keyword: 关键字的补全。
// Snippet: 代码片段的补全。
// Color: 颜色的补全。
// File: 文件的补全。
// Reference: 引用的补全。
// Folder: 文件夹的补全。
// EnumMember: 枚举成员的补全。
// Constant: 常量的补全。
// Struct: 结构体的补全。
// Event: 事件的补全。
// Operator: 操作符的补全。
// TypeParameter: 类型参数的补全。