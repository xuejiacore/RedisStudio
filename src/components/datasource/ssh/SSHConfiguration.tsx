import React, {useState} from "react";
import {Checkbox, CheckboxProps, Divider, Form, Input, Select, Space} from "antd";
import "./SSHConfiguration.less";
import BsButton from "../../../utils/button/BsButton.tsx";

interface SSHConfigurationProp {

}

const SSHConfiguration: React.FC<SSHConfigurationProp> = (props, context) => {
    const [sshTunnelEnabled, setSshTunnelEnabled] = useState(false);

    const onSSHEnabled: CheckboxProps['onChange'] = (e) => {
        setSshTunnelEnabled(e.target.checked);
    }
    return (
        <>
            <Form
                labelAlign={"right"}
                layout="horizontal"
                style={{maxWidth: 800}}>
                <Form.Item>
                    <Checkbox onChange={onSSHEnabled}>Use SSH tunnel</Checkbox>
                </Form.Item>

                <Form className={'ssh-config ' + (sshTunnelEnabled ? 'enabled' : '')} disabled={!sshTunnelEnabled}>
                    <Space direction={"horizontal"}>
                        <Form.Item label="Host">
                            <Input placeholder={'localhost'} style={{width: '300px'}}/>
                        </Form.Item>
                        <Form.Item label="Port">
                            <Input placeholder={'22'} style={{width: '80px'}}/>
                        </Form.Item>
                    </Space>

                    <Form.Item label={'Username'}>
                        <Input placeholder={'root'} style={{width: '120px'}}/>
                    </Form.Item>
                    <Form.Item label={'Authentication type'}>
                        <Select
                            defaultValue="standalone"
                            style={{width: 200}}
                            options={[
                                {value: 'standalone', label: 'Standalone'},
                                {value: 'cluster', label: 'Cluster'},
                            ]}
                        />
                    </Form.Item>

                    <Form.Item label={'Password'} style={{marginBottom: 0}}>
                        <Input.Password
                            style={{width: '266px'}}
                            placeholder="Input password"
                            visibilityToggle={{visible: false}}/>
                    </Form.Item>

                    <Form.Item className={'parse-checkbox'}>
                        <Checkbox defaultChecked={true}>Parse config file ~/.ssh/config</Checkbox>
                    </Form.Item>

                    <Divider/>

                    <Form.Item label={'Local port'}>
                        <Input placeholder={'<Dynamic>'} style={{width: '120px'}}/>
                    </Form.Item>

                    <Divider/>

                    <BsButton label={'Test Connection'} width={120}/>
                </Form>

            </Form>

        </>
    )
}

export default SSHConfiguration;