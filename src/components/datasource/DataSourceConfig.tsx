import {Breadcrumb, ColorPicker, ColorPickerProps, Flex, Form, Input, Tabs, theme} from 'antd';
import React, {useState} from "react";
import "./DataSourceConfig.less";
import {SettingOutlined} from "@ant-design/icons";
import DataSourceType from "./DataSourceType.tsx";
import SSLIcon from "../icons/SSLIcon.tsx";
import AdvancedSettingsIcon from "../icons/AdvancedSettingsIcon.tsx";
import SSHConfiguration from "./ssh/SSHConfiguration.tsx";
import {presetPalettes} from '@ant-design/colors';
import {PresetsItem} from "antd/es/color-picker/interface";

type Presets = Required<ColorPickerProps>['presets'][number];
const genPresets = (presets = presetPalettes) =>
    Object.entries(presets).map<Presets>(([label, colors]) => ({label, colors}));

interface DataSourceConfigProp {

}

const DataSourceConfig: React.FC<DataSourceConfigProp> = (props, context) => {
    const [greetMsg, setGreetMsg] = useState("");
    const [name, setName] = useState("");
    const [selectedTabKey, setSelectedTabKey] = useState('1');
    const [datasourceType, setDatasourceType] = useState('redis')

    const onFinish = (values: any) => {
        console.log('Received values of form: ', values);
    };
    const {token} = theme.useToken();
    const presets: PresetsItem[] = [{
        label: 'presets',
        colors: [
            '#1D3D3B', '#2D4252', '#35363B',
            '#273828', '#2F442C', '#5A2725',
            '#472B2B', '#3B3147', '#45322B',
            '#3D3223', '#AF7B43',
        ],
        defaultOpen: true
    }];

    return (<>
        <div className={'datasource-config-detail'}>
            <Flex className={'datasource-name-comment'} vertical={true} gap={10}>
                <Breadcrumb
                    className={'datasource-breadcrumb'}
                    items={[
                        {
                            title: '公司项目',
                        },
                        {
                            title: '游戏服务',
                        },
                        {
                            title: 'snake-game-biz',
                        },
                    ]}
                    separator={<>&gt;</>}
                />
                <Form
                    labelAlign={"right"}
                    layout="horizontal"
                    size={'small'}
                    style={{maxWidth: 400}}>
                    <Form.Item label="Name">
                        <Flex gap={5}>
                            <Input className={'ds-input'} placeholder="Enter Database Alias"/>
                            <ColorPicker
                                className={'ds-color'}
                                defaultValue={presets[0].colors[0]}
                                presets={presets}/>
                        </Flex>
                    </Form.Item>
                    <Form.Item label="Notes">
                        <Input className={'ds-input'} placeholder="Description of Database"/>
                    </Form.Item>
                </Form>
            </Flex>
            <Tabs
                className={'property-tabs datasource-type-general'}
                activeKey={selectedTabKey}
                type="card"
                size={'small'}
                onTabClick={(k, e) => {
                    setSelectedTabKey(k);
                }}
                items={[
                    {
                        label: 'General',
                        key: '1',
                        icon: <SettingOutlined className={'tab-setting'}/>,
                        children: <DataSourceType type={datasourceType}/>,
                    },
                    {
                        label: 'SSH/SSL',
                        key: '2',
                        icon: <SSLIcon className={'tab-ssl'} style={{width: 15}}/>,
                        children: <SSHConfiguration/>
                    },
                    {
                        label: 'Advanced',
                        key: '3',
                        icon: <AdvancedSettingsIcon className={'tab-advanced-setting'}
                                                    style={{width: 15}}/>,
                        children: <></>,
                    },
                ]}
            />
        </div>

    </>);
}

export default DataSourceConfig;
