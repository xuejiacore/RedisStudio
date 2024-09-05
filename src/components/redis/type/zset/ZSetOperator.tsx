/* eslint-disable */
import React, {useEffect, useRef, useState} from "react";
import RedisToolbar from "../../toolbar/RedisToolbar.tsx";
import {Flex, Table} from "antd";
import {ColumnsType} from "antd/es/table";
import {useTranslation} from "react-i18next";
import "./ZSetOperator.less";
import RedisFooter, {FooterAction, ValueFilterParam} from "../../RedisFooter.tsx";
import {rust_invoke} from "../../../../utils/RustIteractor.tsx";
import {TableRowSelection} from "antd/es/table/interface";
import {SortAscendingOutlined, SortDescendingOutlined} from "@ant-design/icons";
import {UpdateRequest, ValueChanged} from "../../watcher/ValueEditor.tsx";
import {listen, UnlistenFn} from "@tauri-apps/api/event";
import {toHexString} from "../../../../utils/Util.ts";

interface ZSetOperatorProp {
    data: any,
    pinMode?: boolean;
    onFieldClicked: (e: ValueChanged) => void;
    onClose?: React.MouseEventHandler<HTMLSpanElement>;
    onRowAdd?: (keyInfo: any) => void;
    onReload?: () => void;
}

interface DataType {
    key?: string;
    member?: string;
    bytes?: Uint8Array
    score?: number;
    rank?: number;
    children?: any[];
}

interface ZRangeMemberResult {
    data: DataType[],
    total: number,
    nomore: boolean,
    left: number,
    right: number
}

const ZSetOperator: React.FC<ZSetOperatorProp> = (props, context) => {
    const {t} = useTranslation();
    const [key, setKey] = useState('');
    const [keyType, setKeyType] = useState('');
    const [pageSize, setPageSize] = useState(30);
    const [dataSource, setDataSource] = useState<DataType[]>([{
        key: "",
        member: "",
        rank: 0,
        score: 0
    }]);
    const [total, setTotal] = useState(0);
    const [dataRows, setDataRows] = useState(0);
    const [start, setStart] = useState(-1);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [filterPattern, setFilterPattern] = useState('');
    const [sortType, setSortType] = useState('asc');
    const [sortIcon, setSortIcon] = useState(<SortAscendingOutlined/>);
    const [pageOnly, setPageOnly] = useState(false);
    const [noMoreDataPage, setNoMoreDataPage] = useState(false);
    const [left, setLeft] = useState(0);
    const [right, setRight] = useState(0);
    const [currPage, setCurrPage] = useState(1);
    const [footerAction, setFooterAction] = useState<FooterAction>();

    const calParentHeight = () => (window.innerHeight
        || document.documentElement.clientHeight
        || document.body.clientHeight) - (props.pinMode ? 100 : 140);
    const [comHeight, setComHeight] = useState(calParentHeight());

    const onSort = () => {
        if (sortType == 'asc') {
            setSortType('desc');
            setSortIcon(<SortDescendingOutlined className={'sort-type-desc'}/>);
        } else {
            setSortType('asc');
            setSortIcon(<SortAscendingOutlined className={'sort-type-asc'}/>);
        }
    }
    const renderCell = (text: string) => {
        return text ? <>
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
    const scoreRender = (text: string) => {
        const scoreVal = parseFloat(text);
        const integerPart = Math.trunc(scoreVal);
        const decimalPart = scoreVal - integerPart;
        const decimalIdx = text.toString().indexOf(".") + 1;
        const decimalPartStr = decimalPart > 0 ? text.toString().substring(decimalIdx) : '';
        const decimalPartDom = decimalPartStr ? <>
            <span className='score-decimal-part'>.</span>
            <span className='score-decimal-part'>{decimalPartStr}</span>
        </> : <></>;

        return <div className='table-row-data'>
            <span className='score-integer-part'>{integerPart}</span>
            {decimalPartDom}
        </div>
    }
    const columns: ColumnsType<DataType> = [
        {
            title: <>
                <div className='table-header'>{t('redis.main.zset.main.table.rank_col_name')}</div>
            </>,
            dataIndex: 'rank',
            key: 'rank',
            width: 'calc(10vw)',
            ellipsis: true,
            render: (text) => {
                return (<div className='table-row-data'>
                    <i className={'rank-value'}>{text}</i>
                </div>);
            }
        },
        {
            title: <>
                <Flex justify={"space-between"}>
                    <div className='table-header'>{t('redis.main.zset.main.table.score_col_name')}</div>
                    <div className='sorted-type' onClick={onSort}>{sortIcon}</div>
                </Flex>
            </>,
            dataIndex: 'score',
            key: 'score',
            width: props.pinMode ? 'auto' : 'auto',
            ellipsis: true,
            render: scoreRender
        },
        {
            title: <>
                <div className='table-header'>{t('redis.main.zset.main.table.element_col_name')}</div>
            </>,
            dataIndex: 'member',
            key: 'member',
            ellipsis: true,
            render: (value: any, record: DataType, index: number) => {
                if (record.bytes) {
                    return renderBytesCell(record);
                } else {
                    return renderCell(value as string);
                }
            }
        }
    ];

    useEffect(() => {
        if (props.data && props.data.keyType == 'zset') {
            currentKey.current = props.data.key;
            setKey(props.data.key);
            setKeyType(props.data.keyType);
            setStart(0);
            setLeft(0);
            setRight(0);
            setSelectedRowKeys([]);
            queryData();
        }
    }, [props.data]);
    useEffect(() => {
        if (start == 0) {
            queryData();
        } else {
            setStart(0);
        }
    }, [sortType]);
    const removeListenerRef = useRef<UnlistenFn>();
    const removeListenerIdRef = useRef(0);
    const currentKey = useRef(key);
    useEffect(() => {
        const ts = Date.now();
        const addListenerAsync = async (data: DataType[]) => {
            return new Promise<UnlistenFn>(resolve => {
                listen('redis/update-value', (event) => {
                    // @ts-expect-error
                    const pl: UpdateRequest = event.payload;
                    if (pl.type == 'zset' && pl.key == currentKey.current) {
                        let isNewItem = true;
                        const newDs = data.map(v => {
                            if (v.key == pl.value) {
                                v.score = parseFloat(pl.field!);
                                isNewItem = false;
                            }
                            return v;
                        });
                        if (isNewItem) {
                            newDs.push({
                                key: pl.field,
                                score: parseFloat(pl.field!),
                                member: pl.value
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

    function queryData(ps?: number) {
        ps = ps || pageSize;
        if (start >= 0) {
            let cursor = start;
            if (filterPattern) {
                cursor = ps > 0 ? right : left;
            }
            rust_invoke("redis_zrange_members", {
                key: props.data.key,
                sorted: sortType,
                start: cursor,
                size: ps,
                pattern: filterPattern
            }).then(r => {
                const obj: ZRangeMemberResult = JSON.parse(r as string);
                obj.data.forEach(t => t.key = t.member);
                setLeft(obj.left);
                setRight(obj.right);
                setNoMoreDataPage(obj.nomore);
                setDataSource(obj.data);
                setTotal(obj.total);
                setDataRows(obj.data.length);
            });
        }
    }

    useEffect(() => {
        if (start >= 0 && !filterPattern) {
            queryData();
        }
    }, [start]);
    useEffect(() => {
        setStart(0);
        queryData();
    }, [filterPattern])

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

    const onNextPage = (pageNum: number) => {
        if (filterPattern) {
            queryData(Math.abs(pageSize));
        } else {
            setStart((pageNum - 1) * pageSize);
        }
    };
    const onPreviousPage = (pageNum: number) => {
        if (filterPattern) {
            queryData(-Math.abs(pageSize));
        } else {
            setStart((pageNum - 1) * pageSize);
        }
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
            setLeft(0);
            setRight(0);
            setPageOnly(true);
            setFilterPattern(`.*${param.query}.*`);
        } else {
            setPageOnly(false);
            setFilterPattern('');
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
    };

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
                                field: record.member,
                                value: record.score?.toString(),
                                redisKey: props.data.key,
                                type: 'FIELD_CLK',
                                dataType: 'zset'
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
            pinMode={props.pinMode}
            pageNumberOnly={pageOnly}
            noMoreDataPage={noMoreDataPage}
            action={footerAction}
            onNextPage={onNextPage}
            onPreviousPage={onPreviousPage}
            onFilter={onFilter}
            onRowAdd={props.onRowAdd}
        />
    </>
}

export default ZSetOperator;