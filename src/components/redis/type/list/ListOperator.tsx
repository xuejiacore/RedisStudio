/* eslint-disable */
import React, {useEffect, useRef, useState} from "react";
import RedisToolbar from "../../toolbar/RedisToolbar.tsx";
import {Table} from "antd";
import {ColumnsType} from "antd/es/table";
import {useTranslation} from "react-i18next";
import "./ListOperator.less";
import RedisFooter, {FooterAction, ValueFilterParam} from "../../RedisFooter.tsx";
import {rust_invoke} from "../../../../utils/RustIteractor.tsx";
import {TableRowSelection} from "antd/es/table/interface";
import {UpdateRequest, ValueChanged} from "../../watcher/ValueEditor.tsx";
import {listen, UnlistenFn} from "@tauri-apps/api/event";
import {toHexString} from "../../../../utils/Util.ts";
import SmartData from "../common/SmartData.tsx";

interface ListOperatorProp {
    data: any,
    pinMode?: boolean;
    onFieldClicked: (e: ValueChanged) => void;
    onClose?: React.MouseEventHandler<HTMLSpanElement>;
    onReload?: () => void;
}

interface DataType {
    key?: string;
    element?: string;
    bytes?: Uint8Array
    rank?: number;
    idx?: number;
}

interface LRangeMemberResult {
    data: DataType[],
    total: number
}

const ListOperator: React.FC<ListOperatorProp> = (props, context) => {
    const {t} = useTranslation();
    const [key, setKey] = useState('');
    const [keyType, setKeyType] = useState('');
    const [pageSize, setPageSize] = useState(30);
    const [dataSource, setDataSource] = useState<DataType[]>([{key: '-'}]);
    const [total, setTotal] = useState(0);
    const [dataRows, setDataRows] = useState(0);
    const [start, setStart] = useState(-1);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [filterPattern, setFilterPattern] = useState('');
    const [footerAction, setFooterAction] = useState<FooterAction>();
    const calParentHeight = () => (window.innerHeight
        || document.documentElement.clientHeight
        || document.body.clientHeight) - (props.pinMode ? 100 : 140);
    const [comHeight, setComHeight] = useState(calParentHeight());

    const renderCell = (text: string) => {
        return text || text == '0' ? <>
            <div className='table-row-data'>{text}</div>
        </> : <>
            <div className='table-row-data'>
                <i className={'empty-data'}>&lt;Empty&gt;</i>
            </div>
        </>
    };
    const renderBytesCell = (record: DataType) => {
        return <>
            <div className='table-row-data'>
                <span className={'byte-element-tag'}>HEX</span>
                <span className={'byte-element-value'}>{toHexString(record.bytes)}</span>
            </div>
        </>
    };
    const columns: ColumnsType<DataType> = [
        {
            title: <>
                <div className='table-header'>{t('redis.main.list.main.table.idx_col_name')}</div>
            </>,
            dataIndex: 'idx',
            key: 'idx',
            width: 80,
            ellipsis: true,
            render: renderCell
        },
        {
            title: <>
                <div className='table-header'>{t('redis.main.list.main.table.element_col_name')}</div>
            </>,
            dataIndex: 'element',
            key: 'element',
            ellipsis: true,
            render: (value: any, record: DataType, index: number) => {
                if (record.bytes?.length! > 0) {
                    return renderBytesCell(record);
                } else {
                    return <SmartData value={value as string}/>;
                }
            }
        }
    ];

    useEffect(() => {
        if (props.data && props.data.keyType == 'list') {
            currentKey.current = props.data.key;
            setKey(props.data.key);
            setKeyType(props.data.keyType);
            setStart(0);
            setSelectedRowKeys([]);
            queryData();
        }
    }, [props.data]);

    const removeListenerRef = useRef<UnlistenFn>();
    const removeListenerIdRef = useRef(0);
    const currentKey = useRef(key);
    useEffect(() => {
        const ts = Date.now();
        const addListenerAsync = async (data: DataType[]) => {
            return new Promise<UnlistenFn>(resolve => {
                listen('redis/update-value', (event) => {
                    // @ts-ignore
                    const pl: UpdateRequest = event.payload;
                    if (pl.type == 'list' && pl.key == currentKey.current) {
                        let isNewItem = true;
                        const newDs = data.map(v => {
                            if (v.key == pl.field) {
                                v.element = pl.value;
                                isNewItem = false;
                            }
                            return v;
                        });
                        if (isNewItem) {
                            newDs.push({
                                key: pl.field,
                                idx: parseInt(pl.field!),
                                element: pl.value
                            });
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

    function queryData() {
        if (start >= 0) {
            rust_invoke("redis_lrange_members", {
                key: props.data.key,
                start: start,
                size: pageSize,
                pattern: filterPattern
            }).then(r => {
                const obj: LRangeMemberResult = JSON.parse(r as string);
                obj.data.forEach(t => t.key = t.idx?.toString());
                setDataSource(obj.data);
                setTotal(obj.total);
                setDataRows(obj.data.length);
            });
        }
    }

    useEffect(() => {
        if (start >= 0) {
            queryData();
        }
    }, [start]);

    useEffect(() => {
        if (start == 0) {
            queryData();
        } else {
            setStart(0);
        }
    }, [filterPattern]);

    const onNextPage = (pageNum: number) => {
        setStart((pageNum - 1) * pageSize);
    };
    const onPreviousPage = (pageNum: number) => {
        setStart((pageNum - 1) * pageSize);
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
            setFilterPattern(`.*${param.query}.*`);
        } else {
            setFilterPattern("");
        }
    }

    const onReload = () => {
        if (props.onReload) {
            props.onReload();
        }
        setFooterAction({type: 'RESET', ts: Date.now()})
        if (start == 0) {
            queryData();
        } else {
            setStart(0);
        }
    }
    return <>
        <RedisToolbar keyName={key}
                      keyType={keyType}
                      pinMode={props.pinMode}
                      onClose={props.onClose}
                      onReload={onReload}
        />
        <Table
            columns={columns}
            size={"small"}
            dataSource={dataSource}
            className={"redis-datatable"}
            pagination={false}
            rowSelection={rowSelection}
            scroll={{y: comHeight}}
            onRow={(record: DataType) => {
                return {
                    onClick: (e) => {
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault()
                            selectRow(record);
                        } else {
                            props.onFieldClicked({
                                key: record.key,
                                field: record.idx?.toString(),
                                value: record.element,
                                redisKey: props.data.key,
                                type: 'FIELD_CLK',
                                dataType: 'list'
                            });
                        }
                    },
                }
            }}
        />
        <RedisFooter
            data={props.data}
            total={total}
            pageLength={dataRows}
            pageSize={pageSize}
            action={footerAction}
            pinMode={props.pinMode}
            onNextPage={onNextPage}
            onPreviousPage={onPreviousPage}
            onFilter={onFilter}
        />
    </>
}

export default ListOperator;