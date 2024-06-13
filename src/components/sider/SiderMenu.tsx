import { ReconciliationOutlined, SettingOutlined, SlackOutlined } from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import { Avatar, Tooltip } from "antd";
import { useState } from "react";
import logo from '../../assets/icon.ico';
import "./SiderMenu.css";

const menu = [
    {
        icon: <SlackOutlined />,
        name: "数据源"
    },
    {
        icon: <ReconciliationOutlined />,
        name: "查询"
    },
    {
        icon: <SettingOutlined />,
        name: "设置"
    }
]

const SiderMenu: React.FC = () => {
    const [actived, setActive] = useState(0);
    const [greetMsg, setGreetMsg] = useState("");
    const [name, setName] = useState("");

    async function greet() {
        // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
        setGreetMsg(await invoke("greet", { name }));
    }

    const generateMenu = () => {
        return <>{
            menu.map((v, idx) => {
                return <>
                    <Tooltip placement="right" title={v.name} mouseEnterDelay={1} key={"tip-" + idx}>
                        <div className={"sider-item " + (idx == actived ? "actived" : "")} key={"itm" + idx} onClick={() => setActive(idx)}>{v.icon}</div>
                    </Tooltip>
                </>
            })
        }</>
    }

    return (
        <div className={"sider-menu"}>
            <div className="sider-panel">
                <div className="sider-logo">
                    <Avatar shape="square" src={logo} size="small" />
                </div>
                {generateMenu()}
            </div>
        </div>
        // <PageContainer>
        //     <Row>
        //         <Col span={6} className="explorer-panel">
        //             <Tree
        //                 className="server-tree"
        //                 showLine
        //                 switcherIcon={<DownOutlined/>}
        //                 defaultExpandedKeys={['0-0-0']}
        //                 treeData={treeData}
        //             />
        //         </Col>
        //         <Col span={18} className="workspace-panel">
        //             <div>3333333</div>
        //         </Col>
        //     </Row>
        // </PageContainer>
    );
}

export default SiderMenu;
