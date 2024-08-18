import React, {useEffect, useRef} from "react";
import DatasourceItem from "./DatasourceItem.tsx";
import {Flex} from "antd";
import "./index.less";
import Scrollbar from "smooth-scrollbar";

interface RecentDatasourceProp {

}

const RecentDatasource: React.FC<RecentDatasourceProp> = (props, context) => {
    const containerRef = useRef(null);
    const scrollbarRef = useRef<Scrollbar>();
    useEffect(() => {
        if (containerRef.current) {
            scrollbarRef.current = Scrollbar.init(containerRef.current, {
                damping: 0.1, // 设置滚动的阻尼大小
                thumbMinSize: 10, // 设置滚动条的最小大小
                alwaysShowTracks: false
            });

            // 在组件销毁时销毁 Smooth Scrollbar
            return () => {
                if (scrollbarRef.current) {
                    scrollbarRef.current.destroy();
                }
            };
        }
    }, []);

    return <>
        <Flex justify={"start"} align={"start"} vertical className={'datasource-list'}>
            <span className={'recent-datasource-label'}>Recent Sources</span>
            <div ref={containerRef} className="scrollbar-container">
                <div className="scroll-content">
                    <DatasourceItem name={'本地测试'} host={'127.0.0.1'} port={'6379'} datasourceId={'test01'}
                                    dscolor={'#51A374'}/>
                    <DatasourceItem name={'测试服'} host={'172.31.86.29'} port={'6379'} datasourceId={'test02'}
                                    dscolor={'#BC50A7'}/>
                    <DatasourceItem name={'测试服'} host={'172.31.65.68'} port={'6379'} datasourceId={'test02'}
                                    dscolor={'#526DF0'}/>
                    <DatasourceItem name={'测试服'} host={'172.31.65.68'} port={'6379'} datasourceId={'test02'}
                                    dscolor={'#526DF0'}/>
                    <DatasourceItem name={'测试服'} host={'172.31.65.68'} port={'6379'} datasourceId={'test02'}
                                    dscolor={'#526DF0'}/>
                    <DatasourceItem name={'测试服'} host={'172.31.65.68'} port={'6379'} datasourceId={'test02'}
                                    dscolor={'#526DF0'}/>
                    <DatasourceItem name={'测试服'} host={'172.31.65.68'} port={'6379'} datasourceId={'test02'}
                                    dscolor={'#526DF0'}/>
                    <DatasourceItem name={'测试服'} host={'172.31.65.68'} port={'6379'} datasourceId={'test02'}
                                    dscolor={'#526DF0'}/>
                    <DatasourceItem name={'测试服'} host={'172.31.65.68'} port={'6379'} datasourceId={'test02'}
                                    dscolor={'#526DF0'}/>
                    <DatasourceItem name={'测试服'} host={'172.31.65.68'} port={'6379'} datasourceId={'test02'}
                                    dscolor={'#526DF0'}/>
                    <DatasourceItem name={'测试服'} host={'172.31.65.68'} port={'6379'} datasourceId={'test02'}
                                    dscolor={'#526DF0'}/>
                    <DatasourceItem name={'测试服'} host={'172.31.65.68'} port={'6379'} datasourceId={'test02'}
                                    dscolor={'#526DF0'}/>
                    <DatasourceItem name={'测试服'} host={'172.31.65.68'} port={'6379'} datasourceId={'test02'}
                                    dscolor={'#526DF0'}/>
                    <DatasourceItem name={'测试服'} host={'172.31.65.68'} port={'6379'} datasourceId={'test02'}
                                    dscolor={'#526DF0'}/>
                </div>
            </div>
        </Flex>
    </>
        ;
}

export default RecentDatasource;