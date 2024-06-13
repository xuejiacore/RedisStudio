import React, {CSSProperties} from 'react';
import Icon from '@ant-design/icons';
// @ts-ignore
import type {GetProps} from 'antd';

type CustomIconComponentProps = GetProps<typeof Icon>;

interface ZkIconProp {
    style?: CSSProperties | undefined;
}

const ZkIcon: React.FC<ZkIconProp> = (props, context) => {
    // noinspection HtmlUnknownAttribute
    const RedisSvg = () => (
        // @ts-ignore
        <svg t="1711876732787" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
             p-id="8989" width={props.style?.width} height={props.style?.height}>
            <path
                d="M198.7 784l66.4 12.5c0.2-4.3 0.5-6.8 0.5-9.2 0-106.6 0.1-213.2 0.2-319.8 0-5.8-1-9.2-7-11.9-6.6-3-12.5-7.8-18.3-12.4-7.7-5.9-9.5-13.9-6-23.3-11.3-4.1-23.4-7.3-22.1-23 0.9-10 7.5-14.8 16.1-18.9-7.4-7.2-12.4-15.7-5.5-25.2 12.4-17.2 27.1-7.8 42.2-0.9V245.3h29c0 17.2-0.2 33.8 0.1 50.4 0.2 12.1 1.3 24.2 1.4 36.3 0.1 5.7-1 11.4-1.5 17.2-0.4 4.5 1.5 6.4 6.2 6.5 22.3 0.7 36.6 13.4 46.2 32.2 7.1 14 19.7 20.4 33.6 22.1 6.8 0.8 14.4-5.3 21.6-8.3 21.4-9 37.7-25.2 55.5-39.3 31.9-25.4 63.5-51.2 95.7-76.1 7.6-5.8 17.4-8.7 26.7-13.2 0.1 0.3 0.2-0.7-0.2-1.1-12.5-11.5-12.3-27.4-13.5-42.2-0.6-6.9-2.9-12-8.3-13.6-9.6-2.9-9.9-10.5-11.2-17.8-1.3-6.8-1.9-13.8-2.9-21.6l6.4-3.5c-0.9-8.7-2-17.4-2.5-26.2-0.3-5.1-2.3-7.7-6.9-10.1-14-7.2-21-19.6-16.1-30.7 2.9-6.5 8.4-12.5 14.1-16.8C560 73 584.9 65.7 611.8 64.2c28.2-1.5 55.6 1.9 80 16.7 11.5 7 21.7 16 30.1 26.5 12.9 16.4 8.6 32.9-9 44.5-2.3 1.5-4.7 2.9-7.2 4.1-9.9 4.9-9.9 4.9-3.3 14.1 0.5 0.7 1.2 1.4 1.2 2.1 0.1 8.7 1 17.5-0.1 26.1-1.1 9.2-7.3 15.7-14.8 21-1.6 1.3-2.6 3.1-2.8 5.1-0.3 5-0.2 10 0.4 15 1.5 10.6 0.3 20.3-7.2 28.6-3.1 3.4-2 5.5 1.7 7.8 11 6.7 22 13.3 32.6 20.6 6.3 4.4 12.4 9.4 17.2 15.3 5.2 6.6 10.9 12.7 17.1 18.3 6.6 5.8 10.3 15.1 14.3 23.4 1.9 4 2.7 7.6 7.6 9.7 7.8 3.4 13.8 9.2 14.4 18.7 0.1 1.7 1.4 3.5 2.5 4.9 12.5 15.6 12.5 34.1 1 51-10.8 15.8-19 32.8-20.9 53.5-17.9-4.4-23.8 7.7-29.7 22.4 3.3 0.4 6.2 1.4 8.9 0.9 9.7-1.6 15.5 2.3 20.2 11.3 3.9 7.4 8.9 14.2 14.7 20.2 6.1 6.3 8.8 20.2 3.4 28-14.1 20.1-32.5 28.9-56.5 23-7.4-1.8-13.9-7.2-23.2-12.1 0.5 4.6-0.4 9.1 1.5 11.6 7.8 10.3 16.5 20.1 25.1 30.3l-10.7 2.9c7.6 14.3 6.4 31.6 18.6 43.5 0.7 0.7 1.7 2.1 1.5 2.8-3.1 8.7 3.8 14.3 6.1 21.3 1.1 3.1 1.1 6.6 0 9.7-3.7 8.9-8.3 17.4-12.5 25.9 10.9 9.9 10.9 9.9 0.8 19.3 2.8 1.2 5.1 2.2 7.4 3.2 4.5 2 9.6 3.3 13.4 6.3 2.9 2.3 4.1 6.8 6.1 10.4-3.5 1.7-7.2 5.2-10.5 4.9-9.8-1.1-17.3 2.7-25 8-4.9 3.4-10.8 5.3-16.3 7.9-3.5 1.7-9.9 3.1-10.1 5.1-0.7 8.4-5.9 17 0.2 25.6 6.9 9.7 7.4 20.9 4.8 31.8-1.5 6.3 1.4 10 5.2 12.4 2.6 1.7 8 1.3 10.9-0.3 8.2-4.7 16.1-10 23.7-15.6 17.2-12.5 55.1-8.1 67.7 15.4 3.9 7.3 4.8 16.7 5.6 25.2 0.7 7.6-0.9 15.5-1 23.2 0 1.7 1.6 3.8 3 5.1 5.8 5.2 7.7 11.6 5.6 18.8-2 6.6-6.9 10.3-14 11.2-11.5 1.4-23 4.6-34.4 4.5-45.2-0.5-90.4-1.9-135.6-3.1-4.7-0.3-9.3-1.2-13.7-2.8-9.7-3.1-12.3-11.5-7.2-20.5 1.5-2.8 1.9-6.1 1.1-9.1-4.3-12.8-2.8-24.4 5.7-35.1 8.2-10.4 7.9-22.7 6.6-34.9-1.3-12.6 0.4-23.6 11.5-31.7 1.5-1.5 2.2-3.5 1.9-5.6-1.1-5.4-2.8-10.6-4.9-15.6-0.9-2-3.9-3.2-6.1-4.4-10.3-5.7-20.7-11.2-30.8-17.2-1.4-0.8-2-4.4-1.6-6.4 7.8-35.7 9-71.5 2.5-107.7-2.4-13.2-2.3-26.9-5.1-40.3-0.6 9-1.2 18.1-1.8 27.1-1.8 27.9-3.1 55.9-5.7 83.7-0.6 6.4-4.7 12.7-8 18.6-2.3 4.1-4.7 7-0.3 11.5 3.9 4 1 17.4-3.7 20.2-0.9 0.5-2.4 1.1-3 0.7-6.8-4.7-10.2 1.7-15.1 4.1-9.3 4.6-19 8.6-28.8 12-7 2.3-12.8 11.3-9.5 18 5.2 10.6 6.2 21.6 5.2 33.2 0 2.7 1.2 5.3 3.3 7 13.9 10 21.3 22.2 17.5 40.2-1.6 7.4-0.5 15.4-0.3 23.1 0 1.6 1.5 3.3 2.7 4.7 9.7 11.1 5.7 25.2-8.6 28.3-34.7 7.8-70.7 7.8-105.4 0.1-12.5-2.7-18.2-16.3-10-25.5 7.2-7.9 7.3-16.2 5.6-24.9-4.3-22.3 5.3-38 22.6-50.3 0.2-0.2 0.4-0.5 0.6-0.5 15.5 0.6 9.2-11.2 10.8-18.6 1.5-6.9 2.7-14.1 5.8-20.4 4.6-9.3 3.3-19.3-4.8-25.6-7.4-5.8-13.6-12.2-16.9-21.5-1.9-5.4-7.1-9.6-11.6-15.2 5.5-6.6 11-13.7 17-20.5 7.4-8.4 7.5-8.5-2.3-13.4-1.1-0.6-2.1-1.3-3.1-2.2 8.6-23 16.9-45.3 25.6-68.6l-13.1-1.1c5.7-9.2 11-17.5 16-25.9 1.6-2.8 3.8-6.1 3.5-8.9-1.7-15.4 3.9-28.7 10.4-41.9 7.9-16.1 15.2-32.5 23-48.6 3.4-7 1-12.6-3.3-18.1-1.3-1.7-3.5-3.3-3.6-5.1-0.7-12.8-1.4-25.7-1.1-38.5 0.1-3.6 3-7.5 5.3-10.8 7.6-10.6 11-22.1 8-35.1-1.6-6.8-6.2-9.3-11.8-5.3-14.6 10.5-28.9 21.5-43.5 31.9-14.9 10.6-29.4 22-48.1 25.9-6.1 1.2-11.8 4.7-17.5 7.4-14.8 7-21.1 2.3-22.7-11.8-13.7-2.2-27.3-6.3-40.8-6.2-14 0.1-28.1 4.1-42 7.1-1.3 0.3-2.5 5-2.5 7.6 0 11.5 0.8 23 0.8 34.5 0.1 48.8 0.1 97.6 0.1 146.3v147.7h44c4.3 22.2 7.8 43.9 12.7 65.3 3.7 15.5 8.3 30.9 13.8 45.8 2.7 7.4 7.5 14.1 12.2 20.5 4.9 6.7 6.1 13.1-0.5 18.2-6.3 4.8-14.1 9-21.8 10.4-30.4 5.4-60.4 3.3-90.4-4.4-27.6-7.1-41.5-25.1-49.3-51.3-11-36.8-17.5-74.1-18.2-112.5-0.5-2-0.3-3.7-0.1-5.3z m510.2-395.8c0 10.8 6.1 21.2-4.8 28.5-0.9 0.6-0.8 3.1-0.9 4.8l-0.9 46.6c0 0.8 0.8 1.6 1.9 3.7 1.1-3.7 2.9-6.3 2.3-8.2-2.5-8.6 2.6-14.9 5.9-21.7 4.2-8.4 8.7-16.7 13-25.1 6.2-11.8 5.4-15.1-5.7-22.9-2.9-2.1-6.3-3.4-10.8-5.7z"
                fill={props.style?.color} p-id="8990"></path>
        </svg>
    );

    const ZkIcon = (props: Partial<CustomIconComponentProps>) => (
        <Icon component={RedisSvg} {...props} />
    );
    return (<><ZkIcon/></>);
}

export default ZkIcon;