import React, {MouseEventHandler} from "react";
import "./DatabaseItem.less";

interface DatabaseItemProp {
    database: number;
    key_size: number;
    selected?: boolean;
    onClick?: MouseEventHandler<HTMLDivElement> | undefined;
}

const DatabaseItem: React.FC<DatabaseItemProp> = (props, context) => {
    return <>
        <div className={`database-item ${props.selected ? 'selected' : ''}`} onClick={props.onClick}>
            <span className={'selected-item'}>{props.selected ? '✓' : ''}</span>
            <span className={'database-index'}>DB{props.database}</span>
            <span className={'key-size'}>{props.key_size}</span>
        </div>
    </>;
}

export default DatabaseItem;