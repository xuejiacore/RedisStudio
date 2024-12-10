import React, {MouseEventHandler} from "react";
import "./DatabaseItem.less";
import {Flex} from "antd";

interface DatabaseItemProp {
    database: number;
    key_size: number;
    selected?: boolean;
    onClick?: MouseEventHandler<HTMLDivElement> | undefined;
}

const DatabaseItem: React.FC<DatabaseItemProp> = (props, context) => {
    return <>
        <Flex
            justify={"space-between"}
            align={"center"}
            className={`database-item ${props.selected ? 'selected' : ''}`}
            onClick={props.onClick}>

            <div className={'database-index'}>DB{props.database}</div>
            <div className={'key-size'}>{props.key_size}</div>
        </Flex>
    </>;
}

export default DatabaseItem;