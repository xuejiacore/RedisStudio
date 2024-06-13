import React, {ReactNode} from "react";
import "./BsIconButton.less";

interface BsIconButtonProp {
    icon?: ReactNode
}

const BsIconButton: React.FC<BsIconButtonProp> = (props, context) => {

    return (
        <>
            <div className={'bs-icon-button'}>
                {props.icon}
            </div>
        </>
    )
}

export default BsIconButton;