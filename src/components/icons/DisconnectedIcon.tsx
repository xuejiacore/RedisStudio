import React, {CSSProperties} from 'react';
import Icon from '@ant-design/icons';
// @ts-ignore
import type {GetProps} from 'antd';

type CustomIconComponentProps = GetProps<typeof Icon>;

interface DisconnectedIconProp {
    style?: CSSProperties | undefined;
    className?: string
}

const DisconnectedIcon: React.FC<DisconnectedIconProp> = (props, context) => {
    // noinspection HtmlUnknownAttribute
    const svg = () => (
            // @ts-ignore
            <svg t="1714567757166" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
                 p-id="6793" width={props.style?.width} height={props.style?.height}>
                <path className={props.className}
                      d="M871.488 246.016a183.68 183.68 0 0 0-28.864-55.552l86.656-87.04L889.856 64l-87.04 86.656c-16.896-12.864-35.456-22.464-55.552-28.928a196.672 196.672 0 0 0-136.96 4.8 193.92 193.92 0 0 0-63.424 42.496L448 268.288l276.928 276.992 99.328-98.88c18.368-18.368 32.512-39.552 42.432-63.488a196.736 196.736 0 0 0 4.8-136.96z m-56.896 115.456a137.6 137.6 0 0 1-30.144 45.12l-59.52 59.52-197.76-197.76 59.52-59.52a137.6 137.6 0 0 1 45.056-30.208 136.576 136.576 0 0 1 108.096 0.448c16.896 7.296 31.616 17.344 44.16 30.208 12.8 12.48 22.912 27.264 30.208 44.16a136.576 136.576 0 0 1 0.448 108.032z m-308.736 319.616l94.976-98.88-39.424-39.808-95.36 99.264-119.04-118.976 95.424-99.328L402.624 384 307.712 482.88l-39.424-39.36-99.264 98.88c-18.368 18.368-32.576 39.68-42.432 63.872a193.472 193.472 0 0 0-14.912 74.816c0 21.248 3.2 41.984 9.6 62.08 6.72 19.84 16.512 38.208 29.376 55.168L64 885.376l39.36 39.36 87.04-86.592c16.96 12.8 35.328 22.592 55.168 29.312 20.096 6.4 40.832 9.6 62.08 9.6 25.984 0 50.944-4.928 74.88-14.848 24.192-9.92 45.44-24.064 63.872-42.432l98.88-99.328-39.424-39.36z m-144.768 129.472a138.24 138.24 0 0 1-53.376 10.496c-19.264 0-37.504-3.648-54.72-10.88a145.792 145.792 0 0 1-44.608-29.824 145.92 145.92 0 0 1-29.76-44.608 138.688 138.688 0 0 1-10.88-54.656 138.24 138.24 0 0 1 41.088-98.88l59.52-59.52 197.76 197.76-59.52 59.52a142.08 142.08 0 0 1-45.504 30.592z"
                      fill="#A1260D" p-id="6794"></path>
            </svg>
        )
    ;

    const Disconnected = (props: Partial<CustomIconComponentProps>) => (
        <Icon component={svg} {...props} />
    );
    return (<><Disconnected/></>);
}

export default DisconnectedIcon;