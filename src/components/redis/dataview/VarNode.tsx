import React from "react";
import {Flex} from "antd";
import "./VarNode.less";

interface VarNodeProps {
    name: string;
    defaultValue?: string;
    keyType?: string;
}

const VarNode: React.FC<VarNodeProps> = (props, context) => {

    const onValueDropdown = (e: React.MouseEvent<HTMLSpanElement>) => {
        e.stopPropagation()
        console.log("弹出菜单");
    };

    const containVars = props.name.indexOf("{") >= 0 && props.name.indexOf("}") >= 0;
    let empty = '';
    if (props.defaultValue && containVars) {
        empty = '';
    } else {
        empty = 'empty'
    }

    const varClass = containVars ? 'vars' : '';
    const typeChar = props.keyType?.substring(0, 1).toUpperCase();

    return <>
        <Flex align={"center"} className={'var-node'} gap={4}>
            <div className={`key-type-prefix redis-type ${props.keyType}`} style={{display: props.keyType ? undefined : 'none'}}>
                {typeChar}
            </div>

            <div className={`runtime-value redis-type ${empty}`}
                 onClick={onValueDropdown}>{props.defaultValue ?? ''}</div>

            <div className={`origin-name ${varClass}`}>{props.name}</div>
        </Flex>
    </>
}

export default VarNode;