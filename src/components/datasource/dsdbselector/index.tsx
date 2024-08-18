import React from "react";
import ReactDOM from "react-dom/client";
import "./index.less";
import DatabaseList from "./DatabaseList";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <>
        <div className={'datasource-dropdown-content'}>
            <div className={'content'}>
                <DatabaseList/>
            </div>
        </div>
    </>
);
