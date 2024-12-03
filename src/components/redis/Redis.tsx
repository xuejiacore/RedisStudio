import {Col, Row, Splitter} from "antd";
import React, {useEffect, useRef, useState} from "react";
import "./index.less";
import RedisKeyTree from "./RedisKeyTree";
import RedisScript from "./redis-scripts/RedisScript.tsx";
import RightWatcherPanel from "./watcher/RightWatcherPanel.tsx";
import {OutlineAction} from "./watcher/KeyOutline.tsx";
import MiniRedisDashboardMini from "./dashboard/HomeDashboardMini.tsx";
import RedisTypeEditor, {FieldInfo, RedisKeyInfo} from "./type/RedisTypeEditor.tsx";

interface RedisProps {
    windowId: number;
    datasourceId: number;
    selectedDatabase: number;
}

const Redis: (props: RedisProps) => JSX.Element = (props: RedisProps) => {
    // 父组件的高度，用于计算树的最大高度
    const parentHeight = window.innerHeight
        || document.documentElement.clientHeight
        || document.body.clientHeight;

    const [datasource, setDatasource] = useState(props.datasourceId);
    const [database, setDatabase] = useState(props.selectedDatabase);
    const [currentKeyType, setCurrentKeyType] = useState('');
    const [selectedField, setSelectedField] = useState<FieldInfo>();
    const [outlineAction, setOutlineAction] = useState<OutlineAction>();
    const [showAnalysis, setShowAnalysis] = useState(true);
    const [showCommandLine, setShowCommandLine] = useState(false);
    const [currentKeyInfo, setCurrentKeyInfo] = useState<RedisKeyInfo>();

    const datasourceRef = useRef(props.datasourceId);
    const databaseRef = useRef(props.selectedDatabase);

    const [content, setContent] = useState(<></>);
    useEffect(() => {
        datasourceRef.current = props.datasourceId;
        databaseRef.current = props.selectedDatabase;
        setDatasource(props.datasourceId);
        setDatabase(props.selectedDatabase);
    }, [props.datasourceId, props.selectedDatabase]);


    /* Redis script 操作面板 */
    const redisScript = (<RedisScript datasourceId={datasource} selectedDatabase={database}/>);
    const onCommandQueryOpen = () => {
        setShowAnalysis(false);
        setShowCommandLine(true);
        setContent(redisScript);
    };

    const onFieldSelected = (fieldInfo: FieldInfo) => {
        //setSelectedField(fieldInfo);
    }

    return (<>
        <Splitter className={'redis-main-container'}>
            <Splitter.Panel defaultSize="24%" min="20%" max="40%">
                <RedisKeyTree
                    windowId={props.windowId}
                    datasourceId={datasource}
                    selectedDatabase={database}
                    parentHeight={parentHeight}
                    onCmdOpen={onCommandQueryOpen}
                    onAnalysisOpen={e => {
                        setShowAnalysis(true);
                        setShowCommandLine(false);
                    }}
                    onKeySelect={keyInfo => {
                        setShowAnalysis(false);
                        setShowCommandLine(false);
                        setCurrentKeyInfo(keyInfo);
                    }}
                />
            </Splitter.Panel>

            <Splitter.Panel>
                <Row className={'redis-main-panel'}>
                    {/* 中间主区域 */}
                    <Col className={'main-container'} span={showAnalysis || showCommandLine ? 24 : 17}>
                        {showAnalysis ?
                            <MiniRedisDashboardMini className={`mini-dashboard`}
                                                    datasource={datasource}
                                                    database={database}/> :
                            <RedisTypeEditor datasource={datasource}
                                             database={database}
                                             keyInfo={currentKeyInfo!}/>
                        }
                    </Col>

                    {/* 右侧属性面板 */}
                    <Col className={'right-watcher-panel'} span={showAnalysis || showCommandLine ? 0 : 7}>
                        <RightWatcherPanel currentKey={currentKeyInfo?.keyName ?? ''}
                                           keyType={currentKeyType}
                                           outlineAction={outlineAction}
                                           datasourceId={datasource}
                                           selectedDatabase={database}/>
                    </Col>
                </Row>
            </Splitter.Panel>
        </Splitter>
    </>);
}

export default Redis;
