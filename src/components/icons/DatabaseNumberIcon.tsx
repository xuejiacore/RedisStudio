import React, {CSSProperties} from 'react';
import Icon from '@ant-design/icons';
import type {GetProps} from 'antd';

type CustomIconComponentProps = GetProps<typeof Icon>;

interface DatabaseNumberIconProp {
    onClick?: React.MouseEventHandler<HTMLSpanElement>;
    style?: CSSProperties | undefined;
    className?: string
}

const DatabaseNumberIcon: React.FC<DatabaseNumberIconProp> = (props, context) => {
    // noinspection HtmlUnknownAttribute
    const svg = () => (
            <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
                 width={props.style?.width} height={props.style?.height}>
                <path className={props.className}
                      d="M49.152 627.712c0 81.92 206.848 148.48 462.848 148.48 254.976 0 461.824-66.56 462.848-148.48V509.952c-95.232 68.608-279.552 101.376-462.848 101.376s-367.616-32.768-462.848-102.4v118.784z"></path>
                <path className={props.className}
                      d="M974.848 740.352c-95.232 69.632-279.552 102.4-462.848 102.4S144.384 808.96 49.152 740.352v135.168c25.6 75.776 225.28 133.12 462.848 133.12s437.248-57.344 462.848-132.096V740.352zM49.152 396.288c0 81.92 206.848 148.48 462.848 148.48 254.976 0 461.824-66.56 462.848-148.48V278.528c-95.232 69.632-279.552 102.4-462.848 102.4S144.384 348.16 49.152 278.528v117.76z"></path>
                <path className={props.className}
                      d="M512 16.384C256 16.384 49.152 82.944 49.152 164.864S256 313.344 512 313.344s462.848-66.56 462.848-148.48S768 16.384 512 16.384z m15.36 186.368C465.92 153.6 348.16 140.288 239.616 153.6c31.744-21.504 68.608-31.744 114.688-38.912H389.12c53.248 3.072 95.232 17.408 135.168 33.792 77.824-34.816 191.488-7.168 260.096 19.456-88.064-9.216-194.56 0-257.024 34.816z"></path>
            </svg>
        )
    ;

    const DbNumIcon = (props: Partial<CustomIconComponentProps>) => (
        <Icon component={svg} {...props} />
    );
    return (<><DbNumIcon onClick={props.onClick}/></>);
}

export default DatabaseNumberIcon;