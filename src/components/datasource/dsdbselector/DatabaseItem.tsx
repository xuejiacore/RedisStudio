import React from "react";
import "./DatabaseItem.less";
import {Flex} from "antd";

interface DatabaseItemProp {
    database: number;
    key_size: number;
    selected?: boolean;
}

const DatabaseItem: React.FC<DatabaseItemProp> = (props, context) => {
    return <>
        <div className={`database-item ${props.selected ? 'selected' : ''}`}>
            <span className={'selected-item'}>{props.selected ? '✓' : ''}</span>
            <span className={'database-index'}>DB{props.database}</span>
            <span className={'key-size'}>{props.key_size}</span>
        </div>
    </>;
}

export default DatabaseItem;