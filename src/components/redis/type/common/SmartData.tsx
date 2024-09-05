import React from "react";
import "../datatable.less";
import {Tooltip} from "antd";

interface SmartDataProp {
    value: any;
}

const SmartData: React.FC<SmartDataProp> = (props, context) => {

    let node;
    if (props.value == '') {
        node = <i className={'empty-data'}>&lt;Empty&gt;</i>
    } else if (props.value) {
        if (props.value == 'null') {
            node =
                <div className='table-row-data null-text'>
                    <Tooltip className={'tooltips'} title={'`null` string'} placement={"right"} color={'#424449'}>
                        {props.value}
                    </Tooltip>
                </div>
            ;
        } else {
            node = <div className='table-row-data'>{props.value}</div>;
        }
    } else {
        node = <div className='table-row-data null'>{props.value}</div>;
    }
    return <>
        {node}
    </>
}

export default SmartData;