import React, {useRef, useState} from "react";
import RedisCmdEditor, {RedisCmdEditorRef} from "./RedisCmdEditor.tsx";
import {Button, Col, Flex, Row} from "antd";
import RedisCmdOutput, {CmdOutputChannel, RedisCmdOutputRef} from "./RedisCmdOutput.tsx";
import "./RedisScript.less";
import {useTranslation} from "react-i18next";

interface RedisScriptProps {
    datasourceId: number;
    selectedDatabase: number;
}

const RedisScript: React.FC<RedisScriptProps> = (props, context) => {
    const {t} = useTranslation();
    const outputRef = useRef<RedisCmdOutputRef>();
    const cmdEditorRef = useRef<RedisCmdEditorRef>(null);

    const [selectedLines, setSelectedLines] = useState(0);

    const channel: CmdOutputChannel = {
        onOutput: item => {
            outputRef.current?.channel.onOutput(item);
        }
    };
    const onMultiLineSelected = (startLine: number, endLine: number) => {
        setSelectedLines(endLine - startLine + 1);
    }
    const onExecuteCmd = () => {
        if (cmdEditorRef.current) {
            cmdEditorRef.current?.commitQuery();
        }
    }
    return <>
        <Flex className={'redis-script-panel'} gap={2} vertical={true}>
            <RedisCmdEditor ref={cmdEditorRef}
                            channel={channel}
                            onMultiLineSelected={onMultiLineSelected}
                            datasourceId={props.datasourceId}
                            selectedDatabase={props.selectedDatabase}/>
            <Row className={'script-tools'}>
                <Col span={18}>
                    <Flex className={'tips'} justify={'start'} align={'center'}>
                        <span>{t('redis.key_tree.command_script.script.selected_lines', {'count': selectedLines})}</span>
                    </Flex>
                </Col>
                <Col span={6}>
                    <Flex className={'operator'} justify={'end'} align={'center'}>
                        <Button
                            className={`execute-cmd-button`}
                            type="default"
                            size="small"
                            onClick={onExecuteCmd}>
                            {t('redis.key_tree.command_script.script.execute_button')}
                        </Button>
                    </Flex>
                </Col>
            </Row>
            <RedisCmdOutput ref={outputRef}
                            datasourceId={props.datasourceId}
                            selectedDatabase={props.selectedDatabase}/>
        </Flex>
    </>
}

export default RedisScript;
