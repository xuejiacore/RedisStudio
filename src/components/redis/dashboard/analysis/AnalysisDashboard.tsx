import React, {useEffect, useRef, useState} from "react";
import {Button, Flex, Progress} from "antd";
import {AreaChartOutlined, KeyOutlined, SaveOutlined} from "@ant-design/icons";
import {ResponsivePie} from "@nivo/pie";
import MemoryFreeOverTime, {DataItem} from "./MemoryFreeOverTime.tsx";
import {invoke} from "@tauri-apps/api/core";
import {listen, UnlistenFn} from "@tauri-apps/api/event";
import {humanNumber} from "../../../../utils/Util.ts";
import {SqlLiteManager} from "../../../../utils/SqlLiteManager.ts";
import {formatTimestamp} from "../../../../utils/TimeUtil.ts";

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
    const [reportDateTime, setReportDateTime] = useState<string | undefined>();

    const datasourceRef = useRef(props.datasource);
    const databaseRef = useRef(props.database);

    const removeListenerRef = useRef<UnlistenFn>();
    const removeListenerIdRef = useRef(0);

    function parseAnalysisResult(payload: any) {
        if (payload == null) {
            payload = {
                progress: 0,
                scan_total: 0,
                dbsize: 0,
                mem_total: 0,
                type_memory: [],
                type_count: []
            }
        }
        setScanPercentage(parseFloat((payload.progress * 100).toFixed(2)));
        setScannedKeyCount(payload.scan_total);
        setDbsize(payload.dbsize);
        setMemUsageTotal(humanNumber(payload.mem_total));
        setCountTotal(payload.scan_total);

        const memoryData = [];
        const types = ['hash', 'string', 'list', 'set', 'zset'];
        const colors = ["#364cff", "#008556", "#9c5c2b", "#6a1dc3", "#a00a6b"];
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
    }

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
                    parseAnalysisResult(payload);

                    if (payload.finished) {
                        const ts = Date.now();
                        setReportDateTime(formatTimestamp(ts));
                        SqlLiteManager.use(db => {
                            db.execute(`
                                INSERT INTO tbl_database_analysis_result(datasource_id, database, create_time, analysis_json_result, ver)
                                VALUES ($1, $2, $3, $4, $5)
                            `, [
                                datasourceRef.current, databaseRef.current, ts, JSON.stringify(payload), 1
                            ]).finally();
                        });
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
        SqlLiteManager.use(db => {
            db.select<string>("select * from tbl_database_analysis_result where datasource_id = $1 and database = $2", [
                datasourceRef.current,
                databaseRef.current
            ]).then(r => {
                if (r.length > 0) {
                    const row: any = r[0];
                    const ts = row.create_time;
                    setReportDateTime(formatTimestamp(ts));
                    const payload = JSON.parse(row.analysis_json_result);
                    parseAnalysisResult(payload);
                } else {
                    setReportDateTime(undefined);
                    parseAnalysisResult(null);
                }
            })
        });
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
            setProgressStatus('success');
        });
    };

    const reportTips = reportDateTime == undefined ? <>Never analyse this database.</> :
        <>Report generated on: <span>{reportDateTime}</span></>;

    return <>
        <Flex className={'statistic-generate-info'} vertical={true}>
            <Progress percent={scanPercentage}
                      strokeWidth={3}
                      size={'small'}
                      status={progressStatus}
                      strokeColor={{from: '#046db8', to: '#63f126'}}/>

            <Flex className={'analysis-info'} justify={'space-between'}>
                <Flex>
                    <span className={'generate-time'}>{reportTips}</span>
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
                                colors={{datum: 'data.color'}}
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
                                colors={{datum: 'data.color'}}
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
