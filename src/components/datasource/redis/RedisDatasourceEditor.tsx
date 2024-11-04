import React from "react";
import {Divider, Flex, Form, Input, Select} from "antd";
import "./index.less";

interface RedisDatasourceEditorProp {

}

const RedisDatasourceEditor: React.FC<RedisDatasourceEditorProp> = (props, context) => {

    return (<>
        <Form
            labelAlign={"right"}
            layout="horizontal"
            size={'small'}>

            <Flex justify="start" align={"start"} gap={10}>
                <Flex vertical={true}>
                    <Form.Item label="Host">
                        <Input className={'ds-input'}
                               placeholder={'Enter Hostname / IP address / Connection URL'}
                               style={{width: 'calc(32vw)'}}/>
                    </Form.Item>
                    <Form.Item label="Port" tooltip={'Should not exceed 65535.'}>
                        <Input className={'ds-input'} placeholder={'6379'} style={{width: '120px'}}/>
                    </Form.Item>
                    <Form.Item label="Database">
                        <Input className={'ds-input'} placeholder={'0 <default>'} style={{width: '120px'}}/>
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
                <Form
                    layout="inline"
                    size={'small'}
                    style={{maxWidth: 'none'}}>
                    <Form.Item label="Password">
                        <Input.Password
                            className={'ds-input'}
                            placeholder={'Enter Password'}
                            visibilityToggle={{visible: false}}
                        />
                    </Form.Item>
                    <Form.Item>
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
                </Form>
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
    </>)
}

export default RedisDatasourceEditor;