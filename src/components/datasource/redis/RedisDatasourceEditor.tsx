import React from "react";
import {Divider, Flex, Form, Input, Select, Space} from "antd";
import "./index.less";

interface RedisDatasourceEditorProp {

}

const RedisDatasourceEditor: React.FC<RedisDatasourceEditorProp> = (props, context) => {

    return (<>
        <Flex justify={"center"} align={"center"}>
            <Form
                labelAlign={"right"}
                layout="horizontal"
                style={{maxWidth: 800}}>
                <Space direction={"horizontal"}>
                    <Form.Item label="Host">
                        <Input placeholder={'localhost'} style={{width: '300px'}}/>
                    </Form.Item>
                    <Form.Item label="Port">
                        <Input placeholder={'6379'} style={{width: '80px'}}/>
                    </Form.Item>
                </Space>

                <Space direction={"horizontal"}>
                    <Form.Item label="Password" valuePropName="checked">
                        <Input.Password
                            style={{width: '266px'}}
                            visibilityToggle={{visible: false}}
                        />
                    </Form.Item>
                    <Form.Item label="">
                        <Select
                            defaultValue="keychain"
                            style={{width: 200}}
                            options={[
                                {value: 'keychain', label: 'Store in keychain'},
                                {value: 'ask', label: 'Ask every time'},
                            ]}
                        />
                    </Form.Item>
                </Space>

                <Form.Item label="Username" style={{marginBottom: 0}}>
                    <Input style={{width: '266px'}}/>
                </Form.Item>
                <div className={'user-name-tips'}>
                    Username is supported after Redis 6 with Redis ACL.
                </div>

                <Divider type={"horizontal"} className={'divider'}/>

                <Form.Item label="Connect Mode">
                    <Select
                        defaultValue="standalone"
                        style={{width: 200}}
                        options={[
                            {value: 'standalone', label: 'Standalone'},
                            {value: 'cluster', label: 'Cluster'},
                        ]}
                    />
                </Form.Item>

                <Divider type={"horizontal"} className={'divider'}/>

            </Form>
        </Flex>
    </>)
}

export default RedisDatasourceEditor;