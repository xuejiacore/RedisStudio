import React, {CSSProperties} from 'react';
import Icon from '@ant-design/icons';
// @ts-ignore
import type {GetProps} from 'antd';

type MacCommandIconComponentProps = GetProps<typeof Icon>;

interface MacCommandIconProp {
    style?: CSSProperties | undefined;
}

const MacCommandIcon: React.FC<MacCommandIconProp> = (props, context) => {
    // noinspection HtmlUnknownAttribute
    const MacCommandSvg = () => (
        // @ts-ignore
        <svg t="1702777605496" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
             p-id="18324" width={props.style?.width} height={props.style?.height}>
            <path
                d="M832 384h-64v256h64c105.984 0 192 86.016 192 192s-86.016 192-192 192-192-86.016-192-192v-64H384v64c0 105.984-85.952 192-192 192s-192-86.016-192-192 85.952-192 192-192h64V384H192a192 192 0 0 1-192-192c0-106.048 85.952-192 192-192s192 85.952 192 192c0 22.592-4.608 43.904-11.776 64h279.552c-7.168-20.096-11.776-41.408-11.776-64 0-106.048 86.016-192 192-192s192 85.952 192 192-86.016 192-192 192z m0 512c35.392 0 64-28.608 64-64s-28.608-64-64-64-64 28.608-64 64 28.608 64 64 64zM192 768a64 64 0 1 0 0 128 64 64 0 1 0 0-128zM192 128a64.021333 64.021333 0 0 0 0 128 64.021333 64.021333 0 0 0 0-128z m448 256H384v256h256V384z m192-256a64 64 0 1 0 0 128 64 64 0 1 0 0-128z"
                fill={props.style?.color} p-id="18325"></path>
        </svg>
    );

    return (<> <Icon component={MacCommandSvg} {...props} /></>);
}

export default MacCommandIcon;