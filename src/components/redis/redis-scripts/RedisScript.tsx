import React from "react";
import RedisCmdEditor from "./RedisCmdEditor.tsx";
import TextArea from "antd/es/input/TextArea";
import {Col, Flex, Row} from "antd";
import RedisCmdOutput from "./RedisCmdOutput.tsx";

interface RedisScriptProps {

}

const RedisScript: React.FC<RedisScriptProps> = (props, context) => {
    return <>
        <Flex gap={"middle"} vertical={true}>
            <RedisCmdEditor/>
            <RedisCmdOutput/>
        </Flex>
    </>
}

export default RedisScript;
