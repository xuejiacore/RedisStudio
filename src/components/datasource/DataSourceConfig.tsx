import {Col, ColorPicker, ColorPickerProps, Flex, Input, Row, Tabs, theme} from 'antd';
import React, {useState} from "react";
import "./DataSource.less";
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
            <Flex vertical={true} gap={10}>
                <Row className={'datasource-base-info first-info'}>
                    <Col span={2}>Name:</Col>
                    <Col span={22}>
                        <Flex>
                            <Input className={'ds-input'} placeholder=""/>
                            <Flex justify={"center"} align={"center"}>
                                <ColorPicker
                                    className={'ds-color'}
                                    defaultValue={presets[0].colors[0]}
                                    presets={presets}/>
                            </Flex>
                        </Flex>
                    </Col>
                </Row>
                <Row className={'datasource-base-info'}>
                    <Col span={2}>Comment:</Col>
                    <Col span={22}>
                        <Input className={'ds-input'} placeholder=""/>
                    </Col>
                </Row>
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
