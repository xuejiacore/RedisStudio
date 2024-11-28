import React, {useEffect, useState} from "react";
import {Tabs} from "antd";
import "./index.less";
import KeyOutline, {OutlineAction} from "./KeyOutline.tsx";
import {EditOutlined, InfoCircleOutlined, TagsOutlined} from "@ant-design/icons";
import ValueEditor from "./ValueEditor.tsx";
import {useTranslation} from "react-i18next";
import "../../../utils/i18n.ts";
import {FieldInfo} from "../type/RedisTypeEditor.tsx";

interface RightWatcherPanelProp {
    currentKey: string;
    keyType: string;
    selectedField?: FieldInfo;
    outlineAction?: OutlineAction;

    datasourceId: number;
    selectedDatabase: number;
}

const VALUE_CHANGED_KEY = 'tab-value-editor';

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
    useEffect(() => {
        setSelectedTabKey('tab-outline');
    }, [props.currentKey]);

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
                        key: 'tab-outline',
                        icon: <TagsOutlined className={'tab-tags'}/>,
                        children: <KeyOutline selectedKeyType={props.keyType}
                                              selectedKey={props.currentKey}
                                              action={props.outlineAction}
                                              datasourceId={props.datasourceId}
                                              selectedDatabase={props.selectedDatabase}/>,
                    },
                    {
                        label: t('redis.main.right_panel.tabs.value.name'),
                        key: VALUE_CHANGED_KEY,
                        icon: <EditOutlined/>,
                        disabled: valueTabDisabled,
                        children: <ValueEditor data={props.selectedField}
                                               datasourceId={props.datasourceId}
                                               selectedDatabase={props.selectedDatabase}/>
                    },
                    {
                        label: t('redis.main.right_panel.tabs.info.name'),
                        key: 'tab-info',
                        icon: <InfoCircleOutlined className={'tab-info'}/>,
                        children: 'Key Information',
                    },
                ]}
            />
        </div>
    </>)
};

export default RightWatcherPanel;