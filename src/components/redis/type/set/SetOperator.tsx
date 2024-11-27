import React, {useEffect, useRef, useState} from "react";
import RedisToolbar from "../../toolbar/RedisToolbar.tsx";
import {Table} from "antd";
import {ColumnsType} from "antd/es/table";
import {useTranslation} from "react-i18next";
import "./SetOperator.less";
import RedisFooter, {FooterAction, ValueFilterParam} from "../../footer/RedisFooter.tsx";
import {redis_invoke} from "../../../../utils/RustIteractor.tsx";
import {TableRowSelection} from "antd/es/table/interface";
import {ValueChanged} from "../../watcher/ValueEditor.tsx";
import {RedisKeyInfo} from "../../type-editor/RedisTypeEditor.tsx";

interface SetOperatorProp {
    data: RedisKeyInfo,
    pinMode?: boolean;
    onFieldClicked: (e: ValueChanged) => void;
    onClose?: React.MouseEventHandler<HTMLSpanElement>;
    onReload?: () => void;

    datasourceId: number;
    selectedDatabase: number;
}

interface DataType {
    key?: string;
    member?: string;
}

interface SetMemberResult {
    data: string[],
    total: number
}

const SetOperator: React.FC<SetOperatorProp> = (props, context) => {
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

    const [key, setKey] = useState('');
    const [keyType, setKeyType] = useState('');
    const [pageSize, setPageSize] = useState(30);
    const [dataSource, setDataSource] = useState<DataType[]>([{key: '-'}]);
    const [total, setTotal] = useState(0);
    const [dataRows, setDataRows] = useState(0);
    const [start, setStart] = useState(-1);
    const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
    const [scanPattern, setScanPattern] = useState('');
    const [footerAction, setFooterAction] = useState<FooterAction>();
    const calParentHeight = () => (window.innerHeight
        || document.documentElement.clientHeight
        || document.body.clientHeight) - (props.pinMode ? 100 : 140);
    const [comHeight, setComHeight] = useState(calParentHeight());

    const renderCell = (text: string) => {
        return text ? <>
            <div className='table-row-data'>{text}</div>
        </> : <>
            <div className='table-row-data'>
                <i className={'empty-data'}>&lt;Empty&gt;</i>
            </div>
        </>
    };
    const columns: ColumnsType<DataType> = [
        {
            title: <>
                <div className='table-header'>{t('redis.main.set.main.table.member_col_name')}</div>
            </>,
            dataIndex: 'member',
            key: 'member',
            ellipsis: true,
            render: renderCell
        }
    ];

    useEffect(() => {
        if (props.data && props.data.keyType == 'set') {
            setKey(props.data.keyName);
            setKeyType(props.data.keyType);
            setStart(0);
            setSelectedRowKeys([]);
            queryData();
        }
    }, [props.data]);

    function queryData() {
        if (start >= 0) {
            redis_invoke("redis_sscan", {
                key: props.data.keyName,
                start: start,
                size: pageSize,
                pattern: scanPattern,
            }, datasourceRef.current, databaseRef.current).then(r => {
                const obj: SetMemberResult = JSON.parse(r as string);
                const data = obj.data.map<DataType>(t => {
                    return {
                        key: t,
                        member: t
                    }
                });
                setDataSource(data);
                setTotal(obj.total);
                setDataRows(data.length);
            });
        }
    }

    useEffect(() => {
        if (start >= 0) {
            queryData();
        }
    }, [start, scanPattern]);
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
            setScanPattern(`*${param.query}*`)
        } else {
            setScanPattern('');
        }
    };
    const onReload = () => {
        if (props.onReload) {
            props.onReload();
        }
        setFooterAction({type: 'RESET', ts: Date.now()})
        /* TODO: 查询数据
        if (start == 0) {
            queryData();
        } else {
            setStart(0);
        }
        */
    }
    return <>
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
                                field: '',
                                value: record.member,
                                redisKey: props.data.keyName,
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
            action={footerAction}
            pageSize={pageSize}
            keyName={key}
            pinMode={props.pinMode}
            onNextPage={onNextPage}
            onPreviousPage={onPreviousPage}
            onFilter={onFilter}
        />
    </>
}

export default SetOperator;