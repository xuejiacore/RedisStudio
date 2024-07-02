import React, {useEffect, useState} from "react";
import {Tabs} from "antd";
import "./index.less";
import KeyOutline, {OutlineAction} from "./KeyOutline.tsx";
import {EditOutlined, InfoCircleOutlined, TagsOutlined} from "@ant-design/icons";
import ValueEditor, {ValueChanged} from "./ValueEditor.tsx";
import {useTranslation} from "react-i18next";
import "../../../utils/i18n.ts";

interface RightWatcherPanelProp {
    currentKey: string
    selectedField?: ValueChanged;
    outlineAction?: OutlineAction;
}

const VALUE_CHANGED_KEY = '2';

const RightWatcherPanel: React.FC<RightWatcherPanelProp> = (props) => {
    const {t} = useTranslation();
    const [selectedTabKey, setSelectedTabKey] = useState('1');
    const [valueTabDisabled, setValueTabDisabled] = useState(false);
    useEffect(() => {
        if (props.selectedField?.type == 'KEY_CLK' && selectedTabKey != '1') {
            setSelectedTabKey('1');
        } else if (props.selectedField?.type == 'ADD_ROW' || props.selectedField?.type == 'FIELD_CLK') {
            setSelectedTabKey(VALUE_CHANGED_KEY);
        } else {
            if (props.selectedField && props.selectedField.key) {
                setSelectedTabKey(VALUE_CHANGED_KEY);
            }
        }
        setValueTabDisabled(props.selectedField?.dataType === 'string');
    }, [props.selectedField]);

    return (<>
        <div className={'right-watcher-panel-container'}>
            <Tabs
                activeKey={selectedTabKey}
                type="card"
                size={'small'}
                onTabClick={(k) => {
                    setSelectedTabKey(k);
                }}
                items={[
                    {
                        label: t('redis.main.right_panel.tabs.outline.name'),
                        key: '1',
                        icon: <TagsOutlined className={'tab-tags'}/>,
                        children: <KeyOutline selectedKey={props.currentKey} action={props.outlineAction}/>,
                    },
                    {
                        label: t('redis.main.right_panel.tabs.value.name'),
                        key: VALUE_CHANGED_KEY,
                        icon: <EditOutlined/>,
                        disabled: valueTabDisabled,
                        children: <ValueEditor data={props.selectedField}/>
                    },
                    {
                        label: t('redis.main.right_panel.tabs.info.name'),
                        key: '3',
                        icon: <InfoCircleOutlined className={'tab-info'}/>,
                        children: 'Key Information',
                    },
                ]}
            />
        </div>
    </>)
};

export default RightWatcherPanel;