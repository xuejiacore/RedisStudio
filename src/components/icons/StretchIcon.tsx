/* eslint-disable */
import React, {CSSProperties, DragEventHandler, MouseEventHandler, TouchEventHandler} from 'react';
import Icon from '@ant-design/icons';
// @ts-ignore
import type {GetProps} from 'antd';

type CustomIconComponentProps = GetProps<typeof Icon>;

interface RedisIconProp {
    className?: string | undefined;
    style?: CSSProperties | undefined;
    onMouseDown?: MouseEventHandler<any> | undefined;
    onMouseUp?: MouseEventHandler<any> | undefined;
    onMouseMove?: MouseEventHandler<any> | undefined;
}

const StretchIcon: React.FC<RedisIconProp> = (props, context) => {
    // noinspection HtmlUnknownAttribute
    const StretchSvg = () => (
        // @ts-ignore
        <svg t="1726919305845" className={props.className} viewBox="0 0 1024 1024" version="1.1"
             xmlns="http://www.w3.org/2000/svg"
             p-id="4278" width={props.style?.width} height={props.style?.height}>
            <path className={`${props.className} path`}
                  d="M768 1024V768h256v256H768z m0-640h256v256H768V384z m0-384h256v256H768V0zM384 768h256v256H384V768z m0-384h256v256H384V384zM0 768h256v256H0V768z"
                  p-id="4279"></path>
        </svg>
    );

    return (<>
        <Icon component={StretchSvg} {...props}/>
    </>);
}

export default StretchIcon;