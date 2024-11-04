import React, {ReactNode} from "react";
import "./BsButton.less";

interface BsButtonProp {
    label?: ReactNode
    width?: number | string
    type?: string | 'default' | 'submit'
    className?: string
}

const BsButton: React.FC<BsButtonProp> = (props, context) => {

    const btnType = props.type;

    return (<>
        <div className={`bs-button ${btnType} ${props.className}`} style={{width: props.width}}>
            {props.label}
        </div>
    </>)
}

export default BsButton;