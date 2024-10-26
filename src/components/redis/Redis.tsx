import {Col, Empty, Row} from "antd";
import React, {Key, useEffect, useState} from "react";
import "./index.less";
import RedisKeyTree, {CustomDataNode} from "./RedisKeyTree";
import mac_cmd_icon from '../../assets/images/icons/mac_cmd_icon.svg';
import HashOperator from "./type/hash/HashOperator.tsx";
import RedisScript from "./redis-scripts/RedisScript.tsx";
import StringOperator from "./type/string/StringOperator.tsx";
import RightWatcherPanel from "./watcher/RightWatcherPanel.tsx";
import {ValueChanged} from "./watcher/ValueEditor.tsx";
import no_data_svg from "../../assets/images/icons/no-data.svg";
import ZSetOperator from "./type/zset/ZSetOperator.tsx";
import ListOperator from "./type/list/ListOperator.tsx";
import SetOperator from "./type/set/SetOperator.tsx";
import {OutlineAction} from "./watcher/KeyOutline.tsx";

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

    const empty = (<>
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
            <Empty
                image={no_data_svg}
                imageStyle={{height: 150}}
                description={
                    <>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '100%'
                        }}>
                            <div className={'empty-panel-tips-icon shortcut'}>
                                <img src={mac_cmd_icon} alt={'cmd'}/>
                            </div>
                            <div className={'empty-panel-tips-icon shortcut'}>K</div>
                            <div className={'empty-panel-tips-icon tips'}>Open Anything</div>
                        </div>
                    </>
                }>
            </Empty>
        </div>
    </>)
    const [content, setContent] = useState(empty);
    useEffect(() => {
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
                default:
                    setContent(empty);
                    return;
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
        <Row>
            {/* 左侧面板 */}
            <Col span={5}>
                <RedisKeyTree
                    windowId={props.windowId}
                    datasourceId={datasource}
                    selectedDatabase={database}
                    parentHeight={parentHeight}
                    onSelect={onKeyNodeSelected}
                    onCmdOpen={onCommandQueryOpen}/>
            </Col>

            <Col span={19} className={'redis-main-panel'}>
                <Row style={{height: '100vh'}}>
                    {/* 中间主区域 */}
                    <Col className={'main-container'} span={17}>{content}</Col>

                    {/* 右侧属性面板 */}
                    <Col className={'right-watcher-panel'} span={7}>
                        <RightWatcherPanel currentKey={currentKey}
                                           keyType={currentKeyType}
                                           selectedField={selectedField}
                                           outlineAction={outlineAction}
                                           datasourceId={datasource}
                                           selectedDatabase={database}/>
                    </Col>
                </Row>
            </Col>
        </Row>
    </>);
}

export default Redis;
