import React, {ReactNode} from "react";
import "./BsButton.less";

interface BsButtonProp {
    label?: ReactNode
    width?: number | string
    type?: string | 'default' | 'submit'
}

const BsButton: React.FC<BsButtonProp> = (props, context) => {

    let btnType = props.type;

    return (<>
        <div className={'bs-button ' + btnType} style={{width: props.width}}>
            {props.label}
        </div>
    </>)
}

export default BsButton;