import React, {FC, useEffect, useState} from "react";
import "./RedisResp.less";
import {CmdResultItem} from "./RedisCmdEditor.tsx";
import {Flex} from "antd";
import {formatTimestamp} from "../../../utils/TimeUtil.ts";
import {REDIS_CMD_TYPE, RedisCommand} from "../../../utils/RedisTypeUtil.ts";
import {useTranslation} from "react-i18next";
import {redis_invoke} from "../../../utils/RustIteractor.tsx";

interface RedisRespProp {
    index?: number;
    resp: CmdResultItem;

    datasourceId: string;
    selectedDatabase: number;
}

const RedisResp: FC<RedisRespProp> = (props, context) => {
    const {t} = useTranslation();
    const resp = props.resp;
    const cmd = resp.origin_cmd.split(" ");
    const baseCommand = cmd[0];
    const maybekey = cmd.length >= 2 ? cmd[1] : 'unknown';
    const type = REDIS_CMD_TYPE[baseCommand as RedisCommand] ?? "unknown";

    let keyName = <></>;
    let remainCommand;
    if (type != 'unknown' && maybekey != 'unknown') {
        remainCommand = cmd.slice(2).join(" ");
        keyName = <>
            <span className={`redis-resp-key-name ${type}`}>{maybekey}</span>&nbsp;
        </>
    } else {
        remainCommand = cmd.slice(1).join(" ");
    }

    const errmsg = resp.success ? '' : props.resp.msg;
    const [errMsg, setErrMsg] = useState('');

    const errstyle = resp.success ? '' : 'error';

    useEffect(() => {
        const message = resp.msg;
        if (message) {
            if (message.indexOf("wrong kind of value") > 0) {
                redis_invoke("redis_key_type", {
                    keys: [maybekey]
                }, props.datasourceId, props.selectedDatabase).then(ret => {
                    const obj = JSON.parse(ret as string);
                    setErrMsg(t('redis.key_tree.command_script.error.wrong_kind_of_value', {'type': obj.types[maybekey]}));
                });
            } else {
                setErrMsg(message);
            }

        }
        return () => {

        }
    }, [resp]);

    let result;
    const wrapText = (text: string, hideEmptyLine?: boolean) => {
        if (text.length == 0 && !hideEmptyLine) {
            return <>
                <span className='redis-empty-value'>
                    <em>
                    &lt;empty&gt;
                        </em>
                </span>
            </>;
        } else {
            return text;
        }
    }
    if (resp.success) {
        if (resp.plain_text != null) {
            if (resp.plain_text === '(nil)') {
                result = <span className={"redis-output-plain nil"}>{resp.plain_text}</span>;
            } else {
                if (resp.plain_text.indexOf('\n') > 0) {
                    result = resp.plain_text.split('\n').map((line, index) => {
                        return <span key={`idx_${resp.index}_${index}_${Math.random()}`}>
                            <span className={'redis-output-plain'}>{wrapText(line, true)}</span><br/>
                        </span>
                    })
                } else {
                    result = <span className={"redis-output-plain"}>{wrapText(resp.plain_text)}</span>;
                }
            }
        } else if (resp.vec) {
            result = resp.vec.map((vecItem, index) => {
                return <>
                    <span className='redis-output-bulk'>
                        <span className='redis-output-bulk-index'>
                            {index}）
                        </span>
                        {wrapText(vecItem)}
                    </span>
                    <br/>
                </>
            })
        }
    } else if (errmsg) {
        result = <span className={"error-message"}>• {errMsg}</span>;
    }

    return <>
        <Flex className="redis-output-item" vertical={true}>
            <Flex align={'center'} justify={'start'}>
                <span className="redis-output-args">
                    <span className={`command-symbol ${errstyle}`}>→</span>
                    <span className="redis-execute-time">[{formatTimestamp(Date.now(), 'HH:mm:ss')}]</span>&nbsp;
                    <span className={`redis-output-cmd ${type}`}>{baseCommand}</span>&nbsp;
                    {keyName}
                    {remainCommand}
                </span>
            </Flex>
            <div>{result}</div>
        </Flex>
    </>
}

export default RedisResp;