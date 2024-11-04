import React, {useEffect, useRef, useState} from "react";
import {Button, Flex, Progress} from "antd";
import {AreaChartOutlined, KeyOutlined, SaveOutlined} from "@ant-design/icons";
import {ResponsivePie} from "@nivo/pie";
import MemoryFreeOverTime, {DataItem} from "./MemoryFreeOverTime.tsx";
import {invoke} from "@tauri-apps/api/core";
import {listen, UnlistenFn} from "@tauri-apps/api/event";
import {humanNumber} from "../../../../utils/Util.ts";

interface AnalysisDashboardProps {
    datasource: string;
    database: number;
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = props => {
    const [scannedKeyCount, setScannedKeyCount] = useState(0);
    const [scanPercentage, setScanPercentage] = useState(0);
    const [dbsize, setDbsize] = useState(0);
    const [progressStatus, setProgressStatus] = useState<"normal" | "active" | "exception" | "success" | undefined>('normal');
    const [memUsageTotal, setMemUsageTotal] = useState('');
    const [countTotal, setCountTotal] = useState(0);
    const [memoryData, setMemoryData] = useState<any[]>([]);
    const [countData, setCountData] = useState<any[]>([]);
    const empty = [{'id': '-', label: '-', value: 0}];
    const [ttlData, setTtlData] = useState<DataItem[]>(empty);
    const [database, setDatabase] = useState(props.database);

    const datasourceRef = useRef(props.datasource);
    const databaseRef = useRef(props.database);

    const removeListenerRef = useRef<UnlistenFn>();
    const removeListenerIdRef = useRef(0);
    useEffect(() => {
        const ts = Date.now();
        const addListenerAsync = async () => {
            return new Promise<UnlistenFn>(resolve => {
                const resolveFn = (unlistenFn: UnlistenFn) => {
                    if (removeListenerIdRef.current != ts) {
                        //loadData();
                        resolve(unlistenFn);
                    } else {
                        unlistenFn();
                    }
                };
                listen('database/analysis', event => {
                    const payload: any = event.payload;
                    setScanPercentage(parseFloat((payload.progress * 100).toFixed(2)));
                    setScannedKeyCount(payload.scan_total);
                    setDbsize(payload.dbsize);
                    setMemUsageTotal(humanNumber(payload.mem_total));
                    setCountTotal(payload.scan_total);

                    const memoryData = [];
                    const types = ['hash', 'string', 'list', 'set', 'zset'];
                    const colors =["#364cff", "#008556", "#9c5c2b", "#6a1dc3", "#a00a6b"];
                    for (const k in payload.type_memory) {
                        memoryData.push({
                            id: k,
                            label: k,
                            value: payload.type_memory[k],
                            color: colors[types.indexOf(k)]
                        })
                    }
                    setMemoryData(memoryData);

                    const countData = [];
                    for (const k in payload.type_count) {
                        countData.push({
                            id: k,
                            label: k,
                            value: payload.type_count[k],
                            color: colors[types.indexOf(k)]
                        })
                    }
                    setCountData(countData);

                    const ttlData = [];
                    for (const k in payload.ttl_sec) {
                        if (k !== 'perm') {
                            ttlData.push({
                                id: k,
                                label: k,
                                value: payload.ttl_sec[k].total,
                                lv: payload.ttl_sec[k].lv
                            })
                        }
                    }
                    if (ttlData.length == 0) {
                        setTtlData(empty);
                    } else {
                        ttlData.sort((a, b) => b.lv - a.lv);
                        setTtlData(ttlData);
                    }
                }).then(resolveFn);

            });
        };
        (async () => {
            removeListenerRef.current = await addListenerAsync();
        })();
        /*

         */
        return () => {
            removeListenerIdRef.current = ts;
            const removeListenerAsync = async () => {
                return new Promise<void>(resolve => {
                    if (removeListenerRef.current) {
                        removeListenerRef.current();
                    }
                    resolve();
                })
            }
            removeListenerAsync().then(t => {
            });
        };
    }, []);

    useEffect(() => {
        setDatabase(props.database);
        datasourceRef.current = props.datasource;
        databaseRef.current = props.database;
    }, [props.datasource, props.database]);

    const reset = () => {
        setScanPercentage(0);
        setScannedKeyCount(0);
        setDbsize(0);
        setMemUsageTotal('0');
        setProgressStatus('normal');
    };
    const doAnalysis = () => {
        reset();
        setProgressStatus('active');
        invoke('database_analysis', {
            datasource: datasourceRef.current,
            database: databaseRef.current,
            keyPattern: "*",
            scanCount: 5000,
            pageSize: 100,
            separator: "[:]"
        }).then(r => {
            console.log("分析完成");
            setProgressStatus('success');
        });
    };

    return <>
        <Flex className={'statistic-generate-info'} vertical={true}>
            <Progress percent={scanPercentage}
                      strokeWidth={3}
                      size={'small'}
                      status={progressStatus}
                      strokeColor={{from: '#046db8', to: '#63f126'}}/>

            <Flex className={'analysis-info'} justify={'space-between'}>
                <Flex>
                    <span className={'generate-time'}>Report generated on: <span>2024-10-31 00:01:12</span></span>
                    <span className={'scan-percentage'}>
                        Scanned {dbsize == 0 ? '0.00' : ((scannedKeyCount / dbsize) * 100).toFixed(2)}%
                    </span>
                    <span className={'scan-keys'}>({scannedKeyCount}/{dbsize} keys)</span>
                </Flex>
                <Flex>
                    <Button className={'new-report-btn'} type="primary" size="small" icon={<AreaChartOutlined/>}
                            onClick={doAnalysis}>
                        <span>Analyze</span>
                        <span className={'database-index'}>DB{database}</span>
                    </Button>
                </Flex>
            </Flex>

            <div className={'scroll-content'}
                 style={{height: '82vh', overflow: 'hidden'}}>
                <Flex className={'summary-panel summary-per-data-type'} vertical={true}>
                    <div className={'title'}>SUMMARY PER DATA TYPE</div>
                    <Flex justify={'space-between'}>
                        <div className={'pie memory-pie'}>
                            <Flex className={'inner-info left'} justify={"center"} align={"center"}
                                  vertical={true}>
                                <Flex gap={2}>
                                    <SaveOutlined className={'icon'}/>
                                    <span>Memory</span>
                                </Flex>
                                <span className={'span-splitter'}></span>
                                <span>~{memUsageTotal}</span>
                            </Flex>
                            <ResponsivePie
                                data={memoryData}
                                colors={{ datum: 'data.color' }}
                                margin={{bottom: 30, left: 10, top: 30, right: 10}}
                                innerRadius={0.9}
                                padAngle={0.7}
                                cornerRadius={1}
                                enableArcLabels={false}
                                enableArcLinkLabels={true}
                                arcLinkLabelsSkipAngle={10}
                                arcLinkLabelsTextColor="#B5B6BF"
                                arcLinkLabelsThickness={1}
                                arcLinkLabelsColor={{from: 'color'}}
                                arcLabel="value"
                                arcLabelsRadiusOffset={0.45}
                                arcLabelsSkipAngle={10}
                                arcLabelsTextColor="black"
                                activeOuterRadiusOffset={8}
                            />
                        </div>
                        <div className={'pie type-key-size-pie'}>
                            <Flex className={'inner-info right'} justify={"center"} align={"center"}
                                  vertical={true}>
                                <Flex gap={2}>
                                    <KeyOutlined className={'icon'}/>
                                    <span>Keys</span>
                                </Flex>
                                <span className={'span-splitter'}></span>
                                <span>~{countTotal}</span>
                            </Flex>

                            <ResponsivePie
                                data={countData}
                                colors={{ datum: 'data.color' }}
                                margin={{bottom: 30, left: 10, top: 30, right: 10}}
                                innerRadius={0.9}
                                padAngle={0.7}
                                cornerRadius={1}
                                enableArcLabels={false}
                                enableArcLinkLabels={true}
                                arcLinkLabelsSkipAngle={10}
                                arcLinkLabelsTextColor="#B5B6BF"
                                arcLinkLabelsThickness={1}
                                arcLinkLabelsColor={{from: 'color'}}
                                arcLabel="value"
                                arcLabelsRadiusOffset={0.45}
                                arcLabelsSkipAngle={10}
                                arcLabelsTextColor="black"
                                activeOuterRadiusOffset={8}
                            />
                        </div>
                    </Flex>
                </Flex>

                <Flex className={'summary-panel summary-likely-tobe-free'} vertical={true}>
                    <div className={'title'}>MEMORY LIKELY TO BE FREE OVER TIME</div>
                    <Flex>
                        <div className={'memory-free-over-time'}>
                            <MemoryFreeOverTime data={ttlData}/>
                        </div>
                        <div className={'suggestion'}>
                            <p>When designing the TTL allocation for Redis keys, you can follow these principles:</p>
                            <ul>
                                <li>Avoid Frequent Expiration: Prevent short TTLs from causing frequent expiration
                                    cleanup, which can impact performance.
                                </li>
                                <li>Memory Management: Consider memory usage to avoid fragmentation.</li>
                                <li>Balanced Key Allocation: Maintain a balance of keys with different TTLs to avoid
                                    resource wastage.
                                </li>
                                <li>Layered Storage: Separate hot data from cold data and set TTLs accordingly.</li>
                            </ul>
                        </div>
                    </Flex>
                </Flex>
            </div>

        </Flex>
    </>;
}

export default AnalysisDashboard;

function createStyles(arg0: ({prefixCls, css}: { prefixCls: any; css: any; }) => { linearGradientButton: any; }) {
    throw new Error("Function not implemented.");
}
