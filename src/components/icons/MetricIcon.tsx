import React, {CSSProperties} from 'react';
import Icon from '@ant-design/icons';
// @ts-ignore
import type {GetProps} from 'antd';

type CustomIconComponentProps = GetProps<typeof Icon>;

interface MetricIconProp {
    style?: CSSProperties | undefined;
    className?: string
}

const ClientsNumIcon: React.FC<MetricIconProp> = (props, context) => {
    // noinspection HtmlUnknownAttribute
    const Svg = () => (
        <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
             width={props.style?.width ?? 12} height={props.style?.height ?? 12}>
            <path
                d="M471.2 368.4c-0.2-10.9 4.1-21.4 11.8-29.1 7.7-7.7 18.2-12 29.1-11.8h56.3L350.9 102 133.4 327.4h56.3c10.6 0 20.8 4.4 28.1 12.1 7.3 7.8 11 18.2 10.2 28.8v292c0 21.2-17.2 38.3-38.3 38.3s-38.3-17.2-38.3-38.3v-251H38.7c-21.4-1.8-38-19.5-38.3-41 0.7-10.2 4.2-19.9 10.2-28.2L325.3 12.2c15.6-15.4 40.7-15.4 56.3 0l309.6 325.3c15.3 16.7 15.3 42.3 0 58.9-7.4 7.8-17.5 12.3-28.2 12.8H548v251c0.6 21.8-16.5 40.1-38.3 41h-56.3l217.4 225.4 217.5-225.4H832c-21.8-0.9-38.9-19.2-38.3-41v-292c-0.6-21.8 16.5-40.1 38.3-41 10.9-0.1 21.4 4.1 29.1 11.9 7.7 7.7 12 18.2 11.8 29.1v251.1h110c10.9-0.8 21.5 4 28.2 12.8 15.3 16.6 15.3 42.3 0 58.9l-309.6 320.2c-15.6 15.4-40.7 15.4-56.3 0L330.6 688.5c-7.1-7.6-10.8-17.8-10.3-28.2-0.6-21.8 16.5-40.1 38.3-41h112.6V368.2v0.2z m0 0"
                className={props.className}>
            </path>
        </svg>
    );

    const SvgIcon = (props: Partial<CustomIconComponentProps>) => (
        <Icon component={Svg} {...props} />
    );
    return (<><SvgIcon/></>);
}

export default ClientsNumIcon;