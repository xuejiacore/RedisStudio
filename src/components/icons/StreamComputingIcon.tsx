import React, {CSSProperties} from 'react';
import Icon from '@ant-design/icons';
// @ts-ignore
import type {GetProps} from 'antd';

type CustomIconComponentProps = GetProps<typeof Icon>;

interface ZkIconProp {
    style?: CSSProperties | undefined;
}

const StreamComputingIcon: React.FC<ZkIconProp> = (props, context) => {
    // noinspection HtmlUnknownAttribute
    const RedisSvg = () => (
        // @ts-ignore
        <svg t="1711877137321" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
             p-id="11832" width={props.style?.width} height={props.style?.height}>
            <path
                d="M860.91 772.77c-45.4 0-83.66 30.46-94.58 71.59H645.89c-2.98-0.67-16.75-5.29-62.31-36.78-32.42-22.4-72.15-52.21-110.58-81.03-40.46-30.35-82.3-61.73-116.36-85.06-51.8-35.48-71.73-42.75-85.72-42.75H88.64c-13.81 0-25 11.19-25 25s11.19 25 25 25h181.47c2.98 0.67 16.75 5.29 62.31 36.78 32.42 22.4 72.15 52.21 110.58 81.03 40.46 30.35 82.3 61.73 116.36 85.06 51.8 35.48 71.73 42.75 85.72 42.75h121.77c11.58 40.16 49.36 69.68 94.05 69.68 53.88 0 97.71-42.9 97.71-95.64 0.01-52.73-43.82-95.63-97.7-95.63z m0 141.27c-26.31 0-47.71-20.47-47.71-45.64s21.4-45.64 47.71-45.64 47.71 20.47 47.71 45.64-21.4 45.64-47.71 45.64z"
                p-id="11833" fill={props.style?.color} ></path>
            <path
                d="M248.3 710.41c-44.92 0-82.86 29.83-94.23 70.31l-65.05-0.99c-13.8-0.21-25.17 10.81-25.38 24.61-0.21 13.81 10.81 25.17 24.61 25.38l65.63 1c11.15 40.81 49.25 70.96 94.41 70.96 53.88 0 97.71-42.9 97.71-95.64s-43.82-95.63-97.7-95.63z m0 141.27c-26.31 0-47.71-20.47-47.71-45.64s21.4-45.64 47.71-45.64 47.71 20.47 47.71 45.64-21.4 45.64-47.71 45.64zM769.29 466.84c-42.38 0-78.54 26.54-92.04 63.53l-104.6-1.15h-0.4c-13.83-36.39-49.68-62.38-91.62-62.38-53.88 0-97.71 42.9-97.71 95.64s43.83 95.64 97.71 95.64c48.03 0 88.07-34.09 96.2-78.84l96.46 1.06c8.57 44.23 48.35 77.78 96 77.78 53.88 0 97.71-42.9 97.71-95.64s-43.83-95.64-97.71-95.64zM480.64 608.11c-26.31 0-47.71-20.47-47.71-45.64s21.4-45.64 47.71-45.64c26.31 0 47.71 20.47 47.71 45.64s-21.41 45.64-47.71 45.64z m288.65 0c-26.31 0-47.71-20.47-47.71-45.64s21.4-45.64 47.71-45.64S817 537.3 817 562.47s-21.4 45.64-47.71 45.64z"
                p-id="11834" fill={props.style?.color} ></path>
            <path
                d="M208.47 461.64H88.64c-13.81 0-25 11.19-25 25s11.19 25 25 25h119.83c60.41 0 109.55-49.14 109.55-109.55V373.9h215.59c11.26 40.65 49.28 70.64 94.32 70.64 53.88 0 97.71-42.9 97.71-95.64s-43.83-95.64-97.71-95.64c-45.04 0-83.06 29.99-94.32 70.64H318.02v-63.5c0-32.84 26.71-59.55 59.55-59.55h392.15c14.13 35.82 49.68 61.29 91.19 61.29 53.88 0 97.71-42.9 97.71-95.64s-43.83-95.64-97.71-95.64c-48.43 0-88.74 34.67-96.4 79.98H377.57c-60.41 0-109.55 49.14-109.55 109.55v63.5H88.64c-13.81 0-25 11.19-25 25s11.19 25 25 25h179.38v28.19c0 32.84-26.71 59.56-59.55 59.56z m419.46-158.38c26.31 0 47.71 20.47 47.71 45.64s-21.4 45.64-47.71 45.64-47.71-20.47-47.71-45.64 21.4-45.64 47.71-45.64z m232.98-182.4c26.31 0 47.71 20.47 47.71 45.64s-21.4 45.64-47.71 45.64-47.71-20.47-47.71-45.64 21.4-45.64 47.71-45.64z"
                p-id="11835" fill={props.style?.color} ></path>
        </svg>
    );

    const StreamComputingIcon = (props: Partial<CustomIconComponentProps>) => (
        <Icon component={RedisSvg} {...props} />
    );
    return (<><StreamComputingIcon/></>);
}

export default StreamComputingIcon;