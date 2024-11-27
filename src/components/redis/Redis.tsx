import {Col, Row, Splitter} from "antd";
import React, {Key, useEffect, useRef, useState} from "react";
import "./index.less";
import RedisKeyTree, {CustomDataNode} from "./RedisKeyTree";
import RedisScript from "./redis-scripts/RedisScript.tsx";
import RightWatcherPanel from "./watcher/RightWatcherPanel.tsx";
import {ValueChanged} from "./watcher/ValueEditor.tsx";
import {OutlineAction} from "./watcher/KeyOutline.tsx";
import MiniRedisDashboardMini from "./dashboard/HomeDashboardMini.tsx";
import RedisTypeEditor, {RedisKeyInfo} from "./type-editor/RedisTypeEditor.tsx";

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
    const [currentKey, setCurrentKey] = useState('');
    const [currentKeyType, setCurrentKeyType] = useState('');
    const [nodeData, setNodeData] = useState<CustomDataNode>();
    const [selectedField, setSelectedField] = useState<ValueChanged>();
    const [outlineAction, setOutlineAction] = useState<OutlineAction>();
    const [showAnalysis, setShowAnalysis] = useState(true);
    const [showCommandLine, setShowCommandLine] = useState(false);
    const [operatorUniqueId, setOperatorUniqueId] = useState(Date.now());
    const [currentKeyInfo, setCurrentKeyInfo] = useState<RedisKeyInfo>()

    const datasourceRef = useRef(props.datasourceId);
    const databaseRef = useRef(props.selectedDatabase);

    const [content, setContent] = useState(<></>);
    useEffect(() => {
        datasourceRef.current = props.datasourceId;
        databaseRef.current = props.selectedDatabase;
        setDatasource(props.datasourceId);
        setDatabase(props.selectedDatabase);
    }, [props.datasourceId, props.selectedDatabase]);

    const onRowAdd = (data: any) => {
        setSelectedField({type: 'ADD_ROW', dataType: data.keyType, redisKey: data.key});
    };

    const onReload = () => {
        setOutlineAction({type: 'RELOAD'})
    };

    // const hashOperator = <HashOperator
    //     key={operatorUniqueId}
    //     data={nodeData}
    //     onFieldClicked={setSelectedField}
    //     onRowAdd={onRowAdd}
    //     onReload={onReload}
    //     datasourceId={datasource}
    //     selectedDatabase={database}/>;
    // const stringOperator = <StringOperator
    //     key={operatorUniqueId}
    //     data={nodeData}
    //     onReload={onReload}
    //     datasourceId={datasource}
    //     selectedDatabase={database}/>;
    // const zsetOperator = <ZSetOperator
    //     key={operatorUniqueId}
    //     data={nodeData}
    //     onFieldClicked={setSelectedField}
    //     onRowAdd={onRowAdd}
    //     onReload={onReload}
    //     datasourceId={datasource}
    //     selectedDatabase={database}/>;
    // const setOperator = <SetOperator
    //     key={operatorUniqueId}
    //     data={nodeData}
    //     onFieldClicked={setSelectedField}
    //     onReload={onReload}
    //     datasourceId={datasource}
    //     selectedDatabase={database}/>;
    // const listOperator = <ListOperator
    //     key={operatorUniqueId}
    //     data={nodeData}
    //     onFieldClicked={setSelectedField}
    //     onReload={onReload}
    //     datasourceId={datasource}
    //     selectedDatabase={database}/>;

    useEffect(() => {
        if (nodeData?.key) {
            setCurrentKeyInfo({
                keyName: nodeData.key as string,
                keyType: nodeData.keyType as string,
            })
            setCurrentKey(nodeData.key as string);
            setCurrentKeyType(nodeData.keyType as string);
            setShowAnalysis(false);
            setShowCommandLine(false);
        }
    }, [nodeData]);

    /* 选中某一个redis key后弹出对应不同数据结构的操作面板 */
    const onKeyNodeSelected = (keys: Key[], info: any) => {
        const node = info.node;
        if (node.children && node.children.length > 0) {
            // 如果点击的是非叶子节点，不需要重新渲染操作面板
            return;
        }
        setCurrentKeyInfo({
            keyName: node.key,
            keyType: node.keyType,
        });
    }

    /* Redis script 操作面板 */
    const redisScript = (<RedisScript datasourceId={datasource} selectedDatabase={database}/>);
    const onCommandQueryOpen = () => {
        setShowAnalysis(false);
        setShowCommandLine(true);
        setContent(redisScript);
    };

    return (<>
        <Splitter className={'redis-main-container'}>
            <Splitter.Panel defaultSize="24%" min="20%" max="40%">
                <RedisKeyTree
                    windowId={props.windowId}
                    datasourceId={datasource}
                    selectedDatabase={database}
                    parentHeight={parentHeight}
                    onSelect={onKeyNodeSelected}
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
                                             keyInfo={currentKeyInfo!}
                                             onFieldClicked={setSelectedField}/>
                        }
                    </Col>

                    {/* 右侧属性面板 */}
                    <Col className={'right-watcher-panel'} span={showAnalysis || showCommandLine ? 0 : 7}>
                        <RightWatcherPanel currentKey={currentKey}
                                           keyType={currentKeyType}
                                           selectedField={selectedField}
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
