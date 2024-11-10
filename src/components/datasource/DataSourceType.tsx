import React, {useEffect, useState} from "react";
import './DataSourceType.less'
import BsButton from "../../utils/button/BsButton.tsx";
import {Flex, Form, Input, Select, Space} from "antd";
import {Datasource} from "./dsdropdown/DatasourceItem.tsx";

interface DataSourceTypeProp {
    type: string;
    datasource?: Datasource
}

const DataSourceType: React.FC<DataSourceTypeProp> = (props, context) => {
    const [currentDatasourceType, setCurrentDatasourceType] = useState(props.type);

    const [host, setHost] = useState<string>();
    const [port, setPort] = useState<number>();
    const [password, setPassword] = useState<string | undefined>();
    const [defaultDatabase, setDefaultDatabase] = useState<number | undefined>(0);

    useEffect(() => {
        const ds = props.datasource;
        setHost(ds?.host);
        setPort(ds?.port);
        setPassword(ds?.password);
        setDefaultDatabase(ds?.default_database);
    }, [props.datasource]);

    const result = 'fail';// success
    const onConnectionTest = () => {

    }

    return (<>
        <Flex className={'configure'} justify={'space-between'} vertical={true}>
            <div>
                <Form
                    labelAlign={"right"}
                    layout="horizontal"
                    size={'small'}>

                    <Flex justify="start" align={"start"} gap={10}>
                        <Flex vertical={true}>
                            <Form.Item label="Host">
                                <Input className={'ds-input'}
                                       placeholder={'Enter Hostname / IP address / Connection URL'}
                                       value={host}
                                       style={{width: 'calc(32vw)'}}/>
                            </Form.Item>
                            <Form.Item label="Port" tooltip={'Should not exceed 65535.'}>
                                <Input className={'ds-input'} placeholder={'6379'} style={{width: '120px'}}
                                       value={port}/>
                            </Form.Item>
                            <Form.Item label="Database">
                                <Input className={'ds-input'} placeholder={'0 <default>'} style={{width: '120px'}}
                                       value={defaultDatabase}/>
                            </Form.Item>
                        </Flex>
                        <Flex className={'redis-url-tips'} justify="start" align={"start"} vertical={true}>
                            <div className={'header'}>Pasting a connection URL auto fills the database details.</div>
                            <div className={'header'}>The following connection URLs are supported.</div>
                            <div className={'items'}>
                                <ul>
                                    <li>redis://[[username]:[password]]@host:port</li>
                                    <li>rediss://[[username]:[password]]@host:port</li>
                                    <li>host:port</li>
                                </ul>
                            </div>
                        </Flex>
                    </Flex>

                    <Form.Item>
                        <Flex gap={10}>
                            <Form.Item label="Password" style={{marginBottom: 0}}>
                                <Input.Password
                                    className={'ds-input'}
                                    placeholder={'Enter Password'}
                                    value={password}
                                    visibilityToggle={{visible: false}}
                                />
                            </Form.Item>
                            <Form.Item style={{marginBottom: 0}}>
                                <Select
                                    className={'ds-input'}
                                    defaultValue="keychain"
                                    style={{width: '200px'}}
                                    options={[
                                        {value: 'keychain', label: 'Store in keychain'},
                                        {value: 'ask', label: 'Ask every time'},
                                    ]}
                                />
                            </Form.Item>
                        </Flex>
                    </Form.Item>

                    <Form.Item label="Username" style={{marginBottom: 0}}>
                        <Input className={'ds-input'} style={{width: '266px'}} placeholder={'Enter Username'}/>
                    </Form.Item>

                    <div className={'user-name-tips'}>
                        Username is supported after Redis 6 with Redis ACL.
                    </div>

                    <Form.Item label="Connect Mode">
                        <Select
                            className={'ds-input'}
                            defaultValue="standalone"
                            style={{width: 200}}
                            options={[
                                {value: 'standalone', label: 'Standalone'},
                                {value: 'cluster', label: 'Cluster'},
                            ]}
                        />
                    </Form.Item>

                </Form>
            </div>

            <Flex className={`connect-info ${result}`} justify={'space-between'} vertical={true}>
                <span className={'result-name'}>Failed</span>
                <Flex className={'result-detail'} justify={'space-between'} vertical={true}>
                    <span>Redis Version: 5.0.14</span>
                    <span>Memory Usage: 1.42GB</span>
                    <span>Keys: 4.75k</span>
                </Flex>
                <span>Ping: 3ms</span>
            </Flex>

            <Flex justify={"end"}>
                <Space>
                    <BsButton className={'test-connection-btn'} type={"default"} label={'Test connection'}
                              onClick={onConnectionTest}/>
                    <BsButton className={'save-connection'} type={"submit"} label={'Save'}/>
                </Space>
            </Flex>

        </Flex>
    </>);
}

export default DataSourceType;