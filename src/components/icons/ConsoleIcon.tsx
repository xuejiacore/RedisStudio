import React, {CSSProperties} from 'react';
import Icon from '@ant-design/icons';
// @ts-ignore
import type {GetProps} from 'antd';

type CustomIconComponentProps = GetProps<typeof Icon>;

interface ConsoleIconProp {
    style?: CSSProperties | undefined;
    className?: string
}

const ConsoleIcon: React.FC<ConsoleIconProp> = (props, context) => {
    // noinspection HtmlUnknownAttribute
    const ConsoleSvg = () => (
            // @ts-ignore
            <svg t="1717293390993" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
                 p-id="57746" data-spm-anchor-id="a313x.search_index.0.i5.4d583a81gFUd4y" width={props.style?.width}
                 height={props.style?.height}>
                <path className={props.className}
                      d="M960 128H67.2a64 64 0 0 0-64 64v640a64 64 0 0 0 64 64H960a64 64 0 0 0 64-64V195.2A64 64 0 0 0 960 128zM246.4 737.28l-44.8-45.44L384 512 201.6 332.16l44.8-45.44L471.68 512z m585.6 0H512v-64h320z"
                      p-id="57747"></path>
            </svg>
        )
    ;

    return (<><Icon component={ConsoleSvg} {...props} /></>);
}

export default ConsoleIcon;