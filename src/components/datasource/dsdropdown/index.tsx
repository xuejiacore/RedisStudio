import React from "react";
import ReactDOM from "react-dom/client";
import {Divider} from "antd";
import "./index.less";
import RecentDatasource from "./RecentDatasource.tsx";
import DatasourceManagerHeader from "./DatasourceManagerHeader.tsx";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <>
        <div className={'datasource-dropdown-content'}>
            <div className={'content'}>
                <DatasourceManagerHeader/>
                <RecentDatasource/>
            </div>
        </div>
    </>
);
