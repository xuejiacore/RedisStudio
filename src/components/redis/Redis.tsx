import {Col, Row, Splitter} from "antd";
import React, {Key, useEffect, useRef, useState} from "react";
import "./index.less";
import RedisKeyTree, {CustomDataNode} from "./RedisKeyTree";
import HashOperator from "./type/hash/HashOperator.tsx";
import RedisScript from "./redis-scripts/RedisScript.tsx";
import StringOperator from "./type/string/StringOperator.tsx";
import RightWatcherPanel from "./watcher/RightWatcherPanel.tsx";
import {ValueChanged} from "./watcher/ValueEditor.tsx";
import ZSetOperator from "./type/zset/ZSetOperator.tsx";
import ListOperator from "./type/list/ListOperator.tsx";
import SetOperator from "./type/set/SetOperator.tsx";
import {OutlineAction} from "./watcher/KeyOutline.tsx";
import MiniRedisDashboardMini from "./dashboard/HomeDashboardMini.tsx";

interface RedisProps {
    windowId: number;
    datasourceId: string;
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

    const hashOperator = <HashOperator data={nodeData}
                                       onFieldClicked={setSelectedField}
                                       onRowAdd={onRowAdd}
                                       onReload={onReload}
                                       datasourceId={datasource}
                                       selectedDatabase={database}/>;
    const stringOperator = <StringOperator data={nodeData}
                                           onReload={onReload}
                                           datasourceId={datasource}
                                           selectedDatabase={database}/>;
    const zsetOperator = <ZSetOperator data={nodeData}
                                       onFieldClicked={setSelectedField}
                                       onRowAdd={onRowAdd}
                                       onReload={onReload}
                                       datasourceId={datasource}
                                       selectedDatabase={database}/>;
    const setOperator = <SetOperator data={nodeData}
                                     onFieldClicked={setSelectedField}
                                     onReload={onReload}
                                     datasourceId={datasource}
                                     selectedDatabase={database}/>;
    const listOperator = <ListOperator data={nodeData}
                                       onFieldClicked={setSelectedField}
                                       onReload={onReload}
                                       datasourceId={datasource}
                                       selectedDatabase={database}/>;

    useEffect(() => {
        const lastKeyName = currentKey;
        if (nodeData?.key) {
            setCurrentKey(nodeData.key as string);
            setCurrentKeyType(nodeData.keyType as string);
            setShowAnalysis(false);
            switch (nodeData.keyType) {
                case 'hash':
                    setContent(hashOperator);
                    break
                case 'string':
                    setContent(stringOperator);
                    break
                case 'zset':
                    setContent(zsetOperator);
                    break
                case 'list':
                    setContent(listOperator);
                    break
                case 'set':
                    setContent(setOperator);
                    break;
            }
        }
    }, [nodeData]);

    /* 选中某一个redis key后弹出对应不同数据结构的操作面板 */
    const onKeyNodeSelected = (keys: Key[], info: any) => {
        const node = info.node;
        if (node.children && node.children.length > 0) {
            // 如果点击的是非叶子节点，不需要重新渲染操作面板
            return;
        }
        node.children = [];
        setSelectedField({type: "KEY_CLK", keyType: node.keyType, dataType: node.keyType, redisKey: node.key});
        setNodeData(node)
    }

    /* Redis script 操作面板 */
    const redisScript = (<RedisScript datasourceId={datasource} selectedDatabase={database}/>);
    const onCommandQueryOpen = () => setContent(redisScript);

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
                    onAnalysisOpen={e => setShowAnalysis(true)}
                />
            </Splitter.Panel>

            <Splitter.Panel>
                <Row className={'redis-main-panel'}>
                    {/* 中间主区域 */}
                    <Col className={'main-container'} span={showAnalysis ? 24 : 17}>
                        {showAnalysis ?
                            <MiniRedisDashboardMini className={`mini-dashboard`}
                                                    datasource={datasource}
                                                    database={database}/> : content}
                    </Col>

                    {/* 右侧属性面板 */}
                    <Col className={'right-watcher-panel'} span={showAnalysis ? 0 : 7}>
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
