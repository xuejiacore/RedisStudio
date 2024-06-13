import {Col, Empty, Row} from "antd";
import {Key, useState} from "react";
import "./index.less";
import ZkNodeTree, {NodeStat} from "./ZkNodeTree";
import mac_cmd_icon from '../../assets/images/icons/mac_cmd_icon.svg';
import no_data_svg from "../../assets/images/icons/no-data.svg";
import TextOperator from "./text/TextOperator.tsx";
import {zk_invoke} from "../../utils/RustIteractor.tsx";

interface ZookeeperProps {
    dataSourceId: string,
}

interface GetDataResp {
    success: boolean,
    type: string,
    content: string,
    stat: NodeStat
}

const Zookeeper: (props: ZookeeperProps) => JSX.Element = (props: ZookeeperProps) => {
    // 父组件的高度，用于计算树的最大高度
    const parentHeight = window.innerHeight
        || document.documentElement.clientHeight
        || document.body.clientHeight;

    const empty = (<>
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
            <Empty
                image={no_data_svg}
                imageStyle={{height: 130}}
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

    /* 选中某一个redis key后弹出对应不同数据结构的操作面板 */
    const onKeyNodeSelected = (keys: Key[], info: any) => {
        const node = info.node;
        let subContent;
        if (node.children) {
            // 如果点击的是非叶子节点，不需要重新渲染操作面板
            return;
        }
        const path = node.nodeInfo.path;
        zk_invoke('get_data', {path}).then(r => {
            const data: GetDataResp = JSON.parse(r as string);
            let language = 'text';
            if (path.endsWith('yaml') || path.endsWith('yml')) {
                language = 'yaml';
            } else if (path.endsWith('json')) {
                language = 'json';
            } else if (path.endsWith('properties')) {
                language = 'ini';
            } else {
                try {
                    JSON.parse(data.content);
                    language = 'json';
                } catch (e) {
                }
            }
            if (data.success) {
                setContent(<TextOperator data={data.content} language={language}/>)
            }
        })
    }

    /* Zookeeper script 操作面板 */
    const onCommandQueryOpen = () => {
    };

    return (<>
        <Row>
            {/* 左侧面板 */}
            <Col span={5}>
                <ZkNodeTree datasourceId={'localhost'}
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

                    </Col>
                </Row>
            </Col>
        </Row>
    </>);
}

export default Zookeeper;
