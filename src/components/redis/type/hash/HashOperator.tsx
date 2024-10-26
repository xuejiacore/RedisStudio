/* eslint-disable */
import React, {useEffect, useRef, useState} from "react";
import {Table} from "antd";
import {ColumnsType} from "antd/es/table";
import "./HashOperator.less";
import {redis_invoke} from "../../../../utils/RustIteractor.tsx";
import RedisToolbar from "../../toolbar/RedisToolbar.tsx";
import RedisFooter, {FooterAction, ValueFilterParam} from "../../footer/RedisFooter.tsx";
import {invoke} from "@tauri-apps/api/core";
import {UpdateRequest, ValueChanged} from "../../watcher/ValueEditor.tsx";
import {useTranslation} from "react-i18next";
import {PushpinFilled} from "@ant-design/icons";
import {TableRowSelection} from "antd/es/table/interface";
import {emitTo, listen, Options, UnlistenFn} from "@tauri-apps/api/event";
import SmartData, {UpdateEvent} from "../common/SmartData.tsx";
import {Window} from "@tauri-apps/api/window";

interface HashOperatorProps {
    data: any;
    pinMode?: boolean;
    onFieldClicked: (e: ValueChanged) => void;
    onRowAdd?: (keyInfo: any) => void;
    onClose?: React.MouseEventHandler<HTMLSpanElement>;
    onReload?: () => void;

    datasourceId: string;
    selectedDatabase: number;
}

interface DataType {
    key?: string;
    field?: string;
    content?: string;
    draft?: boolean;
    editId?: string;

    fieldUpdated?: boolean;
    contentUpdated?: boolean;
}

interface HashGetResult {
    field_values: DataType[],
    ttl: number,
    length: number,
    cursor: number,
    pinned_fields: string[],
}

interface PinResult {
    status: string;
    fields: string[];
}

/**
 * Hash 类型的操作面板
 */
const HashOperator: React.FC<HashOperatorProps> = (props, context) => {
    const {t} = useTranslation();

    const [datasource, setDatasource] = useState(props.datasourceId);
    const [database, setDatabase] = useState(props.selectedDatabase);
    const datasourceRef = useRef(datasource);
    const databaseRef = useRef(database);

    useEffect(() => {
        setDatasource(props.datasourceId);
        setDatabase(props.selectedDatabase);
        datasourceRef.current = props.datasourceId;
        databaseRef.current = props.selectedDatabase;
    }, [props.datasourceId, props.selectedDatabase]);

    const [pinnedFields, setPinnedFields] = useState<string[]>([]);
    const [dataSource, setDataSource] = useState<DataType[]>([{key: '-'}]);
    const [key, setKey] = useState('');
    const [keyType, setKeyType] = useState('');
    const [length, setLength] = useState(0);
    const [pageLength, setPageLength] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(30);
    const [cursor, setCursor] = useState(0);
    const cachedPage = useRef(new Map<number, HashGetResult>);
    const cachedPageShown = useRef(0);
    const [dynamicPageSize, setDynamicPageSize] = useState(0);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [scanPattern, setScanPattern] = useState('*');
    const [pageOnly, setPageOnly] = useState(false);
    const [maxPage, setMaxPage] = useState(1);
    const [noMoreDataPage, setNoMoreDataPage] = useState(false);
    const [pageChanged, setPageChanged] = useState(0);
    const [footerAction, setFooterAction] = useState<FooterAction>();
    const [maxFieldWidth, setMaxFieldWidth] = useState(180);
    const [tableUniqueId, setTableUniqueId] = useState(Date.now());
    const dataSourceRef = useRef(dataSource);
    const draftRef = useRef<DataType>();

    // 父组件的高度，用于计算树的最大高度
    const calParentHeight = () => (window.innerHeight
        || document.documentElement.clientHeight
        || document.body.clientHeight) - (props.pinMode ? 107 : 140);
    const [comHeight, setComHeight] = useState(calParentHeight());

    const onPushpinField = (e: React.MouseEvent<HTMLSpanElement>, field: string) => {
        e.stopPropagation();
        const op = pinnedFields.includes(field) ? 'remove' : 'add';
        invoke('pattern_add_tag', {datasourceId: 'datasource01', key: key, pinField: field, op: op}).then(r => {
            const ret = r as PinResult;
            if (ret.status == 'success') {
                setPinnedFields(ret.fields);
                onReload(false);
            }
        })
    };
    const onFieldValueChange = (e: UpdateEvent) => {
        console.log('Field changed:', e);
        let fieldName = e.value;
        let content = undefined;
        let oldField: string | undefined = e.oldValue;
        if (e.editId && draftRef.current && draftRef.current.editId === e.editId) {
            draftRef.current.field = e.value;
            draftRef.current.fieldUpdated = true;
            if (!draftRef.current.contentUpdated) {
                return;
            }
            content = draftRef.current.content;
            oldField = undefined;
            draftRef.current = undefined;
        }

        const req: UpdateRequest = {
            key: e.keyName,
            type: 'hash',
            field: fieldName,
            value: content,
            oldField: oldField,
            fieldRename: true,
        };
        const payload = {
            key: e.keyName,
            key_type: 'hash',
            old_field: oldField,
            field: fieldName,
            value: content,
            datasource_id: 'datasource01'
        };
        console.log("保存数据--->Field", payload, req)
        redis_invoke('redis_update', payload, props.datasourceId, props.selectedDatabase).then(r => {
            emitTo('main', 'redis/update-value', req).finally();
        });
    }
    const onContentValueChange = (e: UpdateEvent) => {
        console.log("Content Changed:", e);
        let fieldName: string | undefined = e.fieldName;
        let content = e.value;
        if (e.editId && draftRef.current && draftRef.current.editId === e.editId) {
            draftRef.current.content = e.value;
            draftRef.current.contentUpdated = true;
            if (!draftRef.current.fieldUpdated) {
                return;
            }
            fieldName = draftRef.current.field;
            draftRef.current = undefined;
        }

        const req: UpdateRequest = {
            key: e.keyName,
            type: 'hash',
            field: fieldName,
            value: content,
        };
        const payload = {
            key: e.keyName,
            key_type: 'hash',
            field: fieldName,
            value: content,
            datasource_id: 'datasource01'
        };
        console.log("保存数据--->Value", payload, req)
        redis_invoke('redis_update', payload, props.datasourceId, props.selectedDatabase).then(r => {
            const ret: any = JSON.parse(r as string);
            if (ret.success) {
                emitTo('main', 'redis/update-value', req).finally();
            } else {
                console.error(`fail to update redis value, key = ${e.keyName}, keyType = hash, field = ${e.fieldName}, value = ${e.value}, msg = ${ret.msg}`);
            }
        });
    }
    const renderField = (fieldName: string, text: string, editable: boolean, editId?: string) => {
        return <div className='field-toolkits'>
            <SmartData value={text}
                       keyName={key}
                       fieldName={fieldName}
                       onChange={onFieldValueChange}
                       editId={editId}
                       editable={editable}
                       placeholder={'Field Name'}
            />
            <div className={'field-tool ' + (pinnedFields.includes(text) ? 'activated' : '')}>
                <PushpinFilled
                    className={'toolbar-btn pushpin-btn ' + (pinnedFields.includes(text) ? 'selected' : '')}
                    onClick={e => onPushpinField(e, text)}/>
            </div>
        </div>;
    }

    const renderCell = (field: string, text: string, editable: boolean, editId?: string) => {
        return <SmartData key={`${Date.now()}-${key}-${field}`}
                          keyName={key}
                          fieldName={field}
                          value={text}
                          onChange={onContentValueChange}
                          editId={editId}
                          editable={editable}
                          placeholder={"Content Value"}
        />
    };

    const columns: ColumnsType<DataType> = [
        {
            title: <>
                <div className='table-header'>{t('redis.main.hash.main.table.field_col_name')}</div>
            </>,
            dataIndex: 'field',
            key: 'field',
            width: props.pinMode ? 'calc(30vw)' : maxFieldWidth,
            ellipsis: true,
            render: (val, record) => renderField(record.field!, val, record.draft ?? false, record.editId)
        },
        {
            title: <>
                <div className='table-header'>{t('redis.main.hash.main.table.content_col_name')}</div>
            </>,
            dataIndex: 'content',
            key: 'content',
            ellipsis: true,
            render: (val, record) => renderCell(record.field!, val, record.draft ?? false, record.editId)
        }
    ];

    const removeListenerRef = useRef<UnlistenFn>();
    const removeListenerIdRef = useRef(0);
    const currentKey = useRef(key);
    useEffect(() => {
        const ts = Date.now();
        const handleResize = () => {
            const newHeight = calParentHeight();
            setComHeight(newHeight);
        }
        window.addEventListener("resize", handleResize);

        const addListenerAsync = async (data: DataType[]) => {
            return new Promise<UnlistenFn>(resolve => {
                const listenOption: Options = {
                    target: {
                        kind: 'Window',
                        label: Window.getCurrent().label
                    }
                };
                const resolveFn = (unlistenFn: UnlistenFn) => {
                    if (removeListenerIdRef.current != ts) {
                        //loadData();
                        resolve(unlistenFn);
                    } else {
                        unlistenFn();
                    }
                };

                listen('redis/update-value', (event) => {
                    const pl = event.payload as UpdateRequest;
                    if (pl.type == 'hash' && pl.key == currentKey.current) {
                        let isNewItem = true;
                        const newDs = dataSourceRef.current.filter(v => {
                            return !v.draft;
                        }).map(v => {
                            if (pl.fieldRename) {
                                if (v.key == pl.oldField) {
                                    v.field = pl.field;
                                    v.key = pl.field;
                                    isNewItem = false;
                                }
                            } else {
                                if (v.key == pl.field) {
                                    v.content = pl.value;
                                    isNewItem = false;
                                }
                            }
                            return v;
                        });
                        if (isNewItem) {
                            newDs.push({
                                key: pl.field,
                                field: pl.field,
                                content: pl.value
                            });

                            // 重新计算field宽度
                            let maxField: string | undefined = '';
                            newDs.forEach((c: DataType) => {
                                if (c.field!.length > maxField!.length!) {
                                    maxField = c.field;
                                }
                            });
                            calculateWidth(maxField);
                        }
                        dataSourceRef.current = newDs;
                        setDataSource([...newDs]);
                    }
                }).then(resolveFn);

                listen("operator/add_row", (event) => {
                    const id = `tmp_${Date.now()}`;
                    const data: DataType = {
                        key: id,
                        field: '',
                        content: '',
                        draft: true,
                        editId: id
                    };
                    dataSourceRef.current.push(data);

                    draftRef.current = data;
                    setDataSource([...dataSourceRef.current]);
                    setTableUniqueId(Date.now());
                }, listenOption).then(resolveFn);

                listen("operator/del_row", (event) => {
                    const payload = event.payload || {};
                    console.log("on row delete", payload);
                    // @ts-ignore
                    dataSourceRef.current = dataSourceRef.current.filter(t => t.field !== payload.field);
                    setDataSource(dataSourceRef.current);
                    setTableUniqueId(Date.now());
                }, listenOption).then(resolveFn)
            })
        }
        (async () => {
            removeListenerRef.current = await addListenerAsync(dataSource);
        })();
        return () => {
            window.removeEventListener("resize", handleResize);
            removeListenerIdRef.current = ts;
            const removeListenerAsync = async () => {
                return new Promise<void>(resolve => {
                    if (removeListenerRef.current) {
                        removeListenerRef.current();
                    }
                    resolve();
                })
            }

            removeListenerAsync().finally();
        };
    }, []);
    useEffect(() => {
        dataSourceRef.current = dataSource;
    }, [dataSource]);

    function clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    }

    function calculateWidth(maxField: string) {
        // 创建一个隐藏的span元素
        const span = document.createElement('span');
        span.style.visibility = 'hidden';
        span.textContent = maxField;
        document.body.appendChild(span);
        const textWidth = span.offsetWidth;
        // 移除span元素
        document.body.removeChild(span);
        setMaxFieldWidth(clamp(textWidth + 70, 60, 200));
    }

    function fillData(obj: HashGetResult) {
        let maxField: string | undefined = '';
        obj.field_values.forEach(c => {
            c.key = c.field;
            if (c.field!.length > maxField!.length!) {
                maxField = c.field;
            }
        })
        setDataSource(obj.field_values);
        setPageLength(obj.field_values.length);
        setLength(obj.length);

        calculateWidth(maxField);
    }

    function loadHashData(cursor: number) {
        if (cursor <= 0) {
            setTableUniqueId(Date.now());
        }
        if (cachedPage.current.has(page)) {
            const obj = cachedPage.current.get(page);
            if (obj) {
                setNoMoreDataPage(obj.cursor <= 0);
                fillData(obj);
            }
        } else {
            redis_invoke("redis_get_hash", {
                key: props.data.key,
                cursor: cursor,
                count: pageSize,
                pattern: scanPattern
            }, props.datasourceId, props.selectedDatabase).then(r => {
                const obj: HashGetResult = JSON.parse(r as string);
                cachedPage.current.set(page, obj);
                cachedPageShown.current = cachedPageShown.current + obj.field_values.length;
                setPinnedFields(obj.pinned_fields);
                setDynamicPageSize(page + Math.ceil((obj.length - cachedPageShown.current) / pageSize));
                setNoMoreDataPage(obj.cursor <= 0);
                fillData(obj);
                setCursor(obj.cursor);
            });
        }
        setKey(props.data.key);
        // const keyTypeNameFirstChar = props.data.keyType?.substring(0, 1).toUpperCase();
        setKeyType(props.data.keyType);
    }

    function clean(page?: number) {
        setSelectedRowKeys([]);
        setMaxPage(1);
        setNoMoreDataPage(false);
        if (page) {
            cachedPage.current.delete(page);
        } else {
            setPage(1);
            setCursor(0);
            cachedPage.current.clear();
            cachedPageShown.current = 0;
            setDynamicPageSize(0);
        }
    }

    // 捕获hash的key值发生了变化，变化后需要重新请求后端数据加载
    useEffect(() => {
        if (props.data && props.data.keyType == 'hash') {
            if (currentKey.current != props.data.key) {
                clean();
                currentKey.current = props.data.key;
                loadHashData(0);
            }
        }
    }, [props.data]);

    useEffect(() => {
        if (cachedPage.current.size > 0) {
            loadHashData(cursor);
        } else {
            loadHashData(0);
        }
    }, [pageChanged]);

    useEffect(() => {
        if (cachedPage.current.size > 0) {
            clean();
            loadHashData(0);
            if (scanPattern == '*') {
                setPage(1);
                setPageChanged(1);
            }
        }
    }, [scanPattern]);

    const onPage = (page: number) => {
        setPage(page);
        setPageChanged(page);
    }
    const onNextPage = (page: number) => {
        setPage(page);
        setPageChanged(page);
    }
    const onPreviousPage = (page: number) => {
        setPage(page);
        setPageChanged(page);
    };
    const selectRow = (record: DataType) => {
        const t = [...selectedRowKeys];
        if (t.indexOf(record.key as string) >= 0) {
            t.splice(t.indexOf(record.key as string), 1);
        } else {
            t.push(record.key as string);
        }
        setSelectedRowKeys(t)
    };
    const onSelectedRowKeysChange = (selectedRowKeys: any) => {
        setSelectedRowKeys(selectedRowKeys)
    };
    const rowSelection: TableRowSelection<DataType> = {
        selectedRowKeys,
        onChange: onSelectedRowKeysChange,
        columnWidth: 0,
        renderCell: t => <></>
    };
    const onFilter = (param: ValueFilterParam) => {
        if (param.query) {
            setPageOnly(true);
            setScanPattern(`*${param.query}*`)
        } else {
            setPageOnly(false);
            setScanPattern('*');
        }
    };
    const onReload = (all: boolean) => {
        console.log("重新加载数据：", pageChanged, cursor)
        if (all) {
            clean();
        } else {
            clean(page);
        }
        if (pageChanged == 1) {
            loadHashData(0);
        } else {
            setPage(1);
            setPageChanged(1);
        }
        if (props.onReload) {
            props.onReload();
        }
        setFooterAction({type: 'RESET', ts: Date.now()});
    };
    return (<>
        <RedisToolbar keyName={key}
                      keyType={keyType}
                      pinMode={props.pinMode}
                      onClose={props.onClose}
                      onReload={() => onReload(true)}
                      datasourceId={datasource}
                      selectedDatabase={database}
        />
        {/*<RedisTableView columns={columns}/>*/}
        <Table
            // key={tableUniqueId}
            columns={columns}
            dataSource={dataSource}
            size={"small"}
            className={"redis-datatable " + (props.pinMode ? 'pinned' : '')}
            pagination={false}
            scroll={{y: comHeight}}
            rowSelection={rowSelection}
            onRow={(record: DataType) => {
                return {
                    onClick: (e) => {
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault()
                            selectRow(record);
                        } else {
                            if (record.draft) {
                                return;
                            }
                            props.onFieldClicked({
                                key: record.key,
                                field: record.field,
                                value: record.content,
                                redisKey: props.data.key,
                                type: 'FIELD_CLK',
                                dataType: 'hash'
                            });
                        }
                    },
                    onContextMenu: (e) => {
                        // 调用 Rust 代码显示右键菜单
                        invoke('show_content_editor_menu', {
                            x: e.clientX,
                            y: e.clientY,
                            datasource: datasourceRef.current,
                            database: databaseRef.current,
                            field: record.field,
                            value: record.content,
                            key: props.data.key,
                        }).then(r => {

                        });
                    },
                }
            }}
        />
        <RedisFooter
            data={props.data}
            total={length}
            pageLength={pageLength}
            pageSize={pageSize}
            keyName={key}
            pinMode={props.pinMode}
            pageNumberOnly={pageOnly}
            noMoreDataPage={noMoreDataPage}
            dynamicPageSize={dynamicPageSize}
            scannedSize={cachedPageShown.current}
            action={footerAction}
            onPage={onPage}
            onNextPage={onNextPage}
            onPreviousPage={onPreviousPage}
            onRowAdd={props.onRowAdd}
            onFilter={onFilter}
        />
    </>)
}

export default HashOperator;