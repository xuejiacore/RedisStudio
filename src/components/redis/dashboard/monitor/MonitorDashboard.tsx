import React from "react";
import {Flex} from "antd";
import ThroughoutMonitor from "./ThroughoutMonitor.tsx";
import "./ThroughoutMonitor.less";

interface MonitorDashboardProps {

}

const MonitorDashboard: React.FC<MonitorDashboardProps> = props => {
    return <>
        <Flex className={'monitor-dashboard'} vertical={true} gap={10}>
            <div className={'monitor throughout-monitor'}>
                <span className={'metric-title'}>Network I/O</span>
                <ThroughoutMonitor/>
            </div>

            <div className={'monitor throughout-monitor'}>
                <span className={'metric-title'}>CPU Utility</span>
                <ThroughoutMonitor/>
            </div>

            <div className={'monitor throughout-monitor'}>
                <span className={'metric-title'}>Memory Usage</span>
                <ThroughoutMonitor/>
            </div>

            <div className={'monitor throughout-monitor'}>
                <span className={'metric-title'}>Key Count</span>
                <ThroughoutMonitor/>
            </div>
        </Flex>
    </>
}

export default MonitorDashboard