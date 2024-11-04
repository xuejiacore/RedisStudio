import React, {useEffect, useRef, useState} from 'react';
import {Tabs} from "antd";

import "./HomeDashboardMini.less";
import Scrollbar from "smooth-scrollbar";
import MonitorDashboard from "./monitor/MonitorDashboard.tsx";
import AnalysisDashboard from "./analysis/AnalysisDashboard.tsx";

interface MiniRedisDashboardMiniProps {
    className?: string;
    datasource: string;
    database: number;
}

const MiniRedisDashboardMini = (props: MiniRedisDashboardMiniProps) => {

    const scrollbarRef = useRef<HTMLDivElement>(null);
    const [datasource, setDatasource] = useState(props.datasource);
    const [database, setDatabase] = useState(props.database);
    const datasourceRef = useRef(props.datasource);
    const databaseRef = useRef(props.database);

    useEffect(() => {
        const scrollbar = Scrollbar.init(scrollbarRef.current!, {
            damping: 0.1,
            alwaysShowTracks: false,
        });

        return () => {
            if (scrollbar) scrollbar.destroy();
        };
    }, []);

    useEffect(() => {
        setDatasource(props.datasource);
        setDatabase(props.database);
        datasourceRef.current = props.datasource;
        databaseRef.current = props.database;
    }, [props.datasource, props.database]);

    return <>
        <div className={`home-dashboard-mini ${props.className}`}>
            <Tabs
                size={'small'}
                onChange={activityKey => {
                }}
                items={[
                    {
                        label: <>Analysis</>,
                        key: 'Analysis',
                        children: <>
                            <div className={'scroll-content'} ref={scrollbarRef}
                                 style={{height: '86vh', overflow: 'hidden'}}>
                                <AnalysisDashboard datasource={datasource} database={database}/>
                            </div>
                        </>
                    },
                    {
                        label: <>Monitor</>,
                        key: 'Monitor',
                        children: <>
                            <div className={'scroll-content'}>
                                <MonitorDashboard/>
                            </div>
                        </>
                    },
                    {
                        label: <>Tips</>,
                        key: 'datasource',
                        children: <>aaa</>,
                    },
                ]}
            />
        </div>
    </>
}

export default MiniRedisDashboardMini;