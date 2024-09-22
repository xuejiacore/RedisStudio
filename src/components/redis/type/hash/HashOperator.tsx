import React, {useEffect, useRef, useState} from "react";
import {Table} from "antd";
import {ColumnsType} from "antd/es/table";
import "./HashOperator.less";
import {rust_invoke} from "../../../../utils/RustIteractor.tsx";
import RedisToolbar from "../../toolbar/RedisToolbar.tsx";
import RedisFooter, {FooterAction, ValueFilterParam} from "../../footer/RedisFooter.tsx";
import {invoke} from "@tauri-apps/api/core";
import {UpdateRequest, ValueChanged} from "../../watcher/ValueEditor.tsx";
import {useTranslation} from "react-i18next";
import {PushpinFilled} from "@ant-design/icons";
import {TableRowSelection} from "antd/es/table/interface";
import {listen, UnlistenFn} from "@tauri-apps/api/event";
import SmartData, {UpdateEvent} from "../common/SmartData.tsx";

interface HashOperatorProps {
    data: any;
    pinMode?: boolean;
    onFieldClicked: (e: ValueChanged) => void;
    onRowAdd?: (keyInfo: any) => void;
    onClose?: React.MouseEventHandler<HTMLSpanElement>;
    onReload?: () => void;
}

interface DataType {
    key?: string;
    field?: string;
    content?: string;
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
    const hasRun = useRef(false);
    const [fieldToolActivated, setFieldToolActivated] = useState('');
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
    const [tableUniqueId, setTableUniqueId] = useState(Date.now())

    // 父组件的高度，用于计算树的最大高度
    const calParentHeight = () => (window.innerHeight
        || document.documentElement.clientHeight
        || document.body.clientHeight) - (props.pinMode ? 100 : 140);
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

    }
    const onContentValueChange = (e: UpdateEvent) => {

    }

    const renderField = (fieldName: string, text: string) => {
        return text ? <>
            <div className='field-toolkits'>
                <SmartData value={text} keyName={key} fieldName={fieldName} onChange={onFieldValueChange}/>
                <div className={'field-tool ' + (pinnedFields.includes(text) ? 'activated' : '')}>
                    <PushpinFilled
                        className={'toolbar-btn pushpin-btn ' + (pinnedFields.includes(text) ? 'selected' : '')}
                        onClick={e => onPushpinField(e, text)}/>
                </div>
            </div>
        </> : <>
            <i className={'empty-data'}>&lt;Empty&gt;</i>
        </>
    }

    const renderCell = (field: string, text: string) => {
        return <SmartData keyName={key} fieldName={field} value={text} onChange={onContentValueChange}/>
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
            render: val => renderField('field', val)
        },
        {
            title: <>
                <div className='table-header'>{t('redis.main.hash.main.table.content_col_name')}</div>
            </>,
            dataIndex: 'content',
            key: 'content',
            ellipsis: true,
            render: val => renderCell('content', val)
        }
    ];

    useEffect(() => {
        const handleResize = () => {
            const newHeight = calParentHeight();
            setComHeight(newHeight);
        }
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        }
    }, []);

    const removeListenerRef = useRef<UnlistenFn>();
    const removeListenerIdRef = useRef(0);
    const currentKey = useRef(key);
    useEffect(() => {
        const ts = Date.now();
        const addListenerAsync = async (data: DataType[]) => {
            return new Promise<UnlistenFn>(resolve => {
                listen('redis/update-value', (event) => {
                    const pl = event.payload as UpdateRequest;
                    if (pl.type == 'hash' && pl.key == currentKey.current) {
                        let isNewItem = true;
                        const newDs = data.map(v => {
                            if (v.key == pl.field) {
                                v.content = pl.value;
                                isNewItem = false;
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
                        setDataSource(newDs);
                    }
                }).then(unlistenFn => {
                    if (removeListenerIdRef.current != ts) {
                        //loadData();
                        resolve(unlistenFn);
                    } else {
                        unlistenFn();
                    }
                })
            })
        }
        (async () => {
            removeListenerRef.current = await addListenerAsync(dataSource);
        })();
        return () => {
            removeListenerIdRef.current = ts;
            const removeListenerAsync = async () => {
                return new Promise<void>(resolve => {
                    if (removeListenerRef.current) {
                        removeListenerRef.current();
                    }
                    resolve();
                })
            }

            removeListenerAsync().then(t => {
            });
        };
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
            rust_invoke("redis_get_hash", {
                key: props.data.key,
                datasource_id: "datasource01",
                cursor: cursor,
                count: pageSize,
                pattern: scanPattern
            }).then(r => {
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
        />
        {/*<RedisTableView columns={columns}/>*/}
        <Table
            key={tableUniqueId}
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
                            y: e.clientY
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