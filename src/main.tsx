import React, {StrictMode} from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.less";
import GlobalWindowTitleBar from "./components/titlebar/GlobalWindowTitleBar.tsx";
import {SysManager} from "./utils/SysManager.ts";
import {invoke} from "@tauri-apps/api/core";

const windowId = Date.now();
SysManager.use(db => {

    const last_datasource = SysManager.value("last_datasource");
    const last_datasource_id = last_datasource.datasource;
    const last_database = last_datasource.database;
    const host = last_datasource.host;
    const port = last_datasource.port;
    const dsname = last_datasource.dsname;
    const color = last_datasource.color;
    const id = last_datasource.id;

    if (last_datasource_id) {
        invoke('initialize_datasource_pattern', {
            datasource: parseInt(last_datasource_id)
        }).then(r => {

        });
    }
    console.log(last_datasource)

    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <StrictMode>
            <div>
                <GlobalWindowTitleBar windowId={windowId}
                                      datasourceId={id}
                                      datasource={parseInt(last_datasource_id)}
                                      database={last_database}
                                      host={host}
                                      port={port}
                                      dsname={dsname}
                                      color={color}
                />
                <div className={'project-drop-down'}></div>
                <App windowId={windowId}
                     datasourceId={id}
                     datasource={last_datasource_id}
                     database={last_database}
                />
            </div>
        </StrictMode>
    );
});
