const redisScriptEditorOptions = {
    "acceptSuggestionOnCommitCharacter": true,
    "acceptSuggestionOnEnter": "on",
    "accessibilitySupport": "auto",
    "autoIndent": false,
    "automaticLayout": true,
    "codeLens": true,
    "colorDecorators": true,
    "contextmenu": false,
    "cursorBlinking": "blink",
    "cursorSmoothCaretAnimation": false,
    "cursorStyle": "line",
    "disableLayerHinting": false,
    "disableMonospaceOptimizations": false,
    "dragAndDrop": false,
    "fixedOverflowWidgets": false,
    "folding": true,
    "foldingStrategy": "auto",
    "fontLigatures": false,
    "formatOnPaste": false,
    "formatOnType": false,
    "hideCursorInOverviewRuler": false,
    "highlightActiveIndentGuide": true,
    "links": true,
    "mouseWheelZoom": false,
    "multiCursorMergeOverlapping": true,
    "multiCursorModifier": "alt",
    "overviewRuler": false,
    "overviewRulerBorder": true,
    "overviewRulerLanes": 2,
    "quickSuggestions": true,
    "quickSuggestionsDelay": 100,
    "readOnly": false,
    "renderControlCharacters": false,
    "renderFinalNewline": true,
    "renderIndentGuides": true,
    "renderLineHighlight": "all",
    "renderWhitespace": "none",
    "revealHorizontalRightPadding": 30,
    "roundedSelection": true,
    "rulers": [],
    "scrollBeyondLastColumn": 5,
    /*是否允许滚动超过最后一行*/
    "scrollBeyondLastLine": false,
    "selectOnLineNumbers": true,
    "selectionClipboard": true,
    "selectionHighlight": true,
    "showFoldingControls": "mouseover",
    "smoothScrolling": false,
    "suggestOnTriggerCharacters": true,
    "wordBasedSuggestions": true,
    "wordSeparators": "~!@#$%^&*()-=+[{]}|;:'\",.<>/?",
    "wordWrap": "on",
    "wordWrapBreakAfterCharacters": "\t})]?|&,;",
    "wordWrapBreakBeforeCharacters": "{([+",
    "wordWrapBreakObtrusiveCharacters": ".",
    "wordWrapColumn": 80,
    "wordWrapMinified": true,
    "wrappingIndent": "none",
    "fontFamily": 'JetBrainsMonoBold, sans-serif',
    "minimap": {
        enabled: false
    }
};

function redisCompletionFunction(model: any, position: any, monaco: any) {
    console.log("执行了候选词~~~~~~~~");
    return {
        suggestions: [
            {label: 'get', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'get ', detail: 'get {key}', documentation: "# 标题11\nasdddd"},
            {label: 'hget', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'hget ', detail: 'hget {key} {field}'},
            {label: 'hgetall', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'hgetall ', detail: 'hgetall {key}'},
        ]
    };
}

export {redisCompletionFunction, redisScriptEditorOptions};