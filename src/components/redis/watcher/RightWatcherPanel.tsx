import React, {useEffect, useState} from "react";
import {Tabs} from "antd";
import "./index.less";
import KeyOutline, {OutlineAction} from "./KeyOutline.tsx";
import {EditOutlined, InfoCircleOutlined, TagsOutlined} from "@ant-design/icons";
import ValueEditor from "./ValueEditor.tsx";
import {useTranslation} from "react-i18next";
import "../../../utils/i18n.ts";
import {FieldInfo} from "../type/RedisTypeEditor.tsx";
import {useEvent} from "../../../utils/TauriUtil.tsx";

interface RightWatcherPanelProp {
    currentKey: string;
    keyType: string;
    outlineAction?: OutlineAction;

    datasourceId: number;
    selectedDatabase: number;
}

const VALUE_CHANGED_KEY = 'tab-value-editor';

const RightWatcherPanel: React.FC<RightWatcherPanelProp> = (props) => {
    const {t} = useTranslation();
    const [selectedTabKey, setSelectedTabKey] = useState('1');
    const [valueTabDisabled, setValueTabDisabled] = useState(false);
    const [selectedField, setSelectedField] = useState<FieldInfo>()

    useEvent('redis-type-editor/field-selector', event => {
        const selectedField = event.payload as FieldInfo;
        setSelectedField(selectedField);
        console.log("RightWatcherPanel", selectedField);
        if (selectedField?.type == 'KEY_CLK' && selectedTabKey != '1') {
            setSelectedTabKey('tab-outline');
        } else if (selectedField?.type == 'ADD_ROW' || selectedField?.type == 'FIELD_CLK') {
            setSelectedTabKey(VALUE_CHANGED_KEY);
        } else {
            if (selectedField && selectedField.key) {
                setSelectedTabKey(VALUE_CHANGED_KEY);
            }
        }
        setValueTabDisabled(selectedField?.dataType === 'string');
    });

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
                        children: <ValueEditor data={selectedField}
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