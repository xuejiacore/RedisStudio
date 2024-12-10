/* eslint-disable */
import React, {CSSProperties, MouseEventHandler} from 'react';
import Icon from '@ant-design/icons';
// @ts-ignore
import type {GetProps} from 'antd';

type CustomIconComponentProps = GetProps<typeof Icon>;

interface DataViewIconProp {
    className?: string | undefined;
    style?: CSSProperties | undefined;
    onMouseDown?: MouseEventHandler<any> | undefined;
    onMouseUp?: MouseEventHandler<any> | undefined;
    onMouseMove?: MouseEventHandler<any> | undefined;
}

const DataViewIcon: React.FC<DataViewIconProp> = (props, context) => {
    // noinspection HtmlUnknownAttribute
    const svg = () => (
        // @ts-ignore
        <svg className={props.className} viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
             width={props.style?.width} height={props.style?.height}>
            <path className={`${props.className} path`}
                  d="M907 959.75H117c-29.224 0-53-23.775-53-53V117c0-29.224 23.776-53 53-53h790c29.225 0 53 23.776 53 53v789.75c0 29.225-23.775 53-53 53zM117 110c-3.794 0-7 3.206-7 7v789.75c0 3.794 3.206 7 7 7h790c3.794 0 7-3.206 7-7V117c0-3.794-3.206-7-7-7H117z"
                  p-id="7810"></path>
            <path className={`${props.className} path`}
                  d="M840.533 294.933c0 4.4-3.6 8-8 8H191.464c-4.4 0-8-3.6-8-8V191.464c0-4.4 3.6-8 8-8h641.069c4.4 0 8 3.6 8 8v103.469zM362.666 474.131c0 4.4-3.6 8-8 8H191.464c-4.4 0-8-3.6-8-8V370.666c0-4.4 3.6-8 8-8h163.202c4.4 0 8 3.6 8 8v103.465zM601.601 474.039c0 4.4-3.6 8-8 8H430.398c-4.4 0-8-3.6-8-8V370.804c0-4.4 3.6-8 8-8H593.6c4.4 0 8 3.6 8 8v103.235zM840.536 474.039c0 4.4-3.6 8-8 8H669.333c-4.4 0-8-3.6-8-8V370.804c0-4.4 3.6-8 8-8h163.203c4.4 0 8 3.6 8 8v103.235zM362.666 653.443c0 4.4-3.6 8-8 8H191.464c-4.4 0-8-3.6-8-8v-103.68c0-4.4 3.6-8 8-8h163.202c4.4 0 8 3.6 8 8v103.68zM601.601 653.327c0 4.4-3.6 8-8 8H430.398c-4.4 0-8-3.6-8-8V549.879c0-4.4 3.6-8 8-8H593.6c4.4 0 8 3.6 8 8v103.448zM840.536 653.327c0 4.4-3.6 8-8 8H669.333c-4.4 0-8-3.6-8-8V549.879c0-4.4 3.6-8 8-8h163.203c4.4 0 8 3.6 8 8v103.448zM362.666 832.646c0 4.4-3.6 8-8 8H191.464c-4.4 0-8-3.6-8-8V728.95c0-4.4 3.6-8 8-8h163.202c4.4 0 8 3.6 8 8v103.696zM601.601 832.53c0 4.4-3.6 8-8 8H430.398c-4.4 0-8-3.6-8-8V729.066c0-4.4 3.6-8 8-8H593.6c4.4 0 8 3.6 8 8V832.53zM840.536 832.53c0 4.4-3.6 8-8 8H669.333c-4.4 0-8-3.6-8-8V729.066c0-4.4 3.6-8 8-8h163.203c4.4 0 8 3.6 8 8V832.53z"
                  p-id="7811"></path>
        </svg>
    );

    return (<>
        <Icon component={svg} {...props}/>
    </>);
}

export default DataViewIcon;