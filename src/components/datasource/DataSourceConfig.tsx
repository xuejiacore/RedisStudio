/* eslint-disable */
import {Breadcrumb, ColorPicker, Flex, Form, Input, Select, SelectProps, Tabs, Tag, theme} from 'antd';
import React, {useEffect, useState} from "react";
import "./DataSourceConfig.less";
import {FolderOutlined, SettingOutlined} from "@ant-design/icons";
import DataSourceType from "./DataSourceType.tsx";
import SSLIcon from "../icons/SSLIcon.tsx";
import AdvancedSettingsIcon from "../icons/AdvancedSettingsIcon.tsx";
import SSHConfiguration from "./ssh/SSHConfiguration.tsx";
import {PresetsItem} from "antd/es/color-picker/interface";
import {invoke} from "@tauri-apps/api/core";
import {wrapColor} from "../../utils/Util.ts";
import {Datasource} from "./dsdropdown/DatasourceItem.tsx";
import {DEFAULT_DATASOURCE_COLOR} from "../../utils/RedisTypeUtil.ts";
import {BreadcrumbItemType} from "antd/es/breadcrumb/Breadcrumb";

const options: SelectProps['options'] = [
    {
        label: 'test',
        value: 'test',
    },
    {
        label: 'prod',
        value: 'prod',
    },
    {
        label: 'dev',
        value: 'dev',
    }
];
type TagRender = SelectProps['tagRender'];

interface DataSourceConfigProp {
    datasource: number;
}

const DataSourceConfig: React.FC<DataSourceConfigProp> = (props, context) => {
    const [datasource, setDatasource] = useState(props.datasource);
    const [color, setColor] = useState('');
    const [datasourceName, setDatasourceName] = useState<string>();
    const [host, setHost] = useState('');
    const [port, setPort] = useState(6379);
    const [datasourceDetail, setDatasourceDetail] = useState<Datasource>();
    const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItemType[]>([{
        title: <FolderOutlined/>
    }]);

    const [selectedTabKey, setSelectedTabKey] = useState('1');
    const [datasourceType, setDatasourceType] = useState('redis')

    const onFinish = (values: any) => {
        console.log('Received values of form: ', values);
    };
    const {token} = theme.useToken();
    const presets: PresetsItem[] = [{
        label: 'presets',
        colors: DEFAULT_DATASOURCE_COLOR,
        defaultOpen: true
    }];

    useEffect(() => {
        setDatasource(props.datasource);
        if (props.datasource > 0) {
            invoke('query_datasource_detail', {
                datasource: props.datasource.toString(),
            }).then((r: any) => {
                console.log("选中了数据源树的节点：", props.datasource, r);
                setDatasourceName(r.name);
                setColor(r.ds_color);
                setHost(r.host);
                setPort(r.port);
                setDatasourceDetail(r);
                const path = r.path ?? '/';
                if (path) {
                    let breadcrumb = path.split("/").map((t: string) => {
                        if (t.length == 0) {
                            return {
                                title: <FolderOutlined/>
                            }
                        } else {
                            return {
                                title: <>{t}</>,
                            }
                        }
                    });
                    setBreadcrumb(breadcrumb);
                }
            });
        } else {
            setDatasourceDetail(undefined);
        }
    }, [props.datasource]);

    const tagRender: TagRender = (props) => {
        // @ts-ignored
        const {label, value, closable, onClose} = props;
        const onPreventMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
            event.preventDefault();
            event.stopPropagation();
        };
        let color = '';
        if (label === 'test') {
            color = '#397148';
        } else if (label === 'prod') {
            color = '#8f3030';
        } else if (label === 'dev') {
            color = '#9a5406';
        }
        return (
            <Tag className={'input-tag'}
                 color={wrapColor(color, '', label?.toString(), 0)}
                 onMouseDown={onPreventMouseDown}
                 closable={closable}
                 onClose={onClose}>{label}</Tag>
        );
    };

    return (<>
        <div className={'datasource-config-detail'}>
            <Flex className={'datasource-name-comment'} vertical={true} gap={10}>
                <Breadcrumb
                    className={'datasource-breadcrumb'}
                    items={breadcrumb}
                    separator={<>/</>}
                />
                <Form
                    labelAlign={"right"}
                    layout="horizontal"
                    size={'small'}
                    style={{maxWidth: 600}}>
                    <Form.Item label="Name">
                        <Flex gap={5}>
                            <Input className={'ds-input'} placeholder="Enter Database Alias" value={datasourceName}/>
                            <ColorPicker
                                className={'ds-color'}
                                value={wrapColor(color, datasource, host, port)}
                                presets={presets}/>

                            <Select
                                className={'ds-input'}
                                mode="tags"
                                placeholder="Env Tag"
                                options={options}
                                tagRender={tagRender}
                                maxCount={1}
                                maxTagTextLength={5}
                                style={{width: 300}}
                            />
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
                        children: <DataSourceType type={datasourceType} datasource={datasourceDetail}/>,
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
