// import {invoke} from "@tauri-apps/api/core";
// import {useState} from "react";
// import type {TabsProps} from 'antd';
// import {Tabs, theme} from 'antd';
// import StickyBox from 'react-sticky-box';
//
// const items = new Array(3).fill(null).map((_, i) => {
//     const id = String(i + 1);
//     return {
//         label: `Tab ${id}`,
//         key: id,
//         children: `Content of Tab Pane ${id}`,
//         style: i === 0 ? {height: 200} : undefined,
//     };
// });
//
// const NodeConfiguration: React.FC = () => {
//     const [greetMsg, setGreetMsg] = useState("");
//     const [name, setName] = useState("");
//     const [activityKey, setActivityKey] = useState("main")
//
//     const {
//         token: {colorBgContainer},
//     } = theme.useToken();
//
//     async function greet() {
//         // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
//         setGreetMsg(await invoke("greet", {name}));
//     }
//
//     const renderTabBar: TabsProps['renderTabBar'] = (props, DefaultTabBar) => (
//         <StickyBox offsetTop={0} offsetBottom={20} style={{zIndex: 1}}>
//             <DefaultTabBar {...props} style={{background: colorBgContainer}}/>
//         </StickyBox>
//     );
//     return <Tabs defaultActiveKey="1" renderTabBar={renderTabBar} items={items}/>;
// }
//
// export default NodeConfiguration;
