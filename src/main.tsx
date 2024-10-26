import React, {StrictMode} from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.less";
import GlobalWindowTitleBar from "./components/titlebar/GlobalWindowTitleBar.tsx";
import {SqlLiteManager} from "./utils/SqlLiteManager.ts";

const windowId = Date.now();
SqlLiteManager.use(db => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <StrictMode>
            <div>
                <GlobalWindowTitleBar windowId={windowId}/>
                <div className={'project-drop-down'}></div>
                <App windowId={windowId}/>
            </div>
        </StrictMode>
    );
});

