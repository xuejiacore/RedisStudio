/* eslint-disable */
import React, {useEffect, useRef, useState} from "react";
import {Button, Col, Flex, Input, InputRef, Row} from "antd";
import {LeftOutlined, PlusOutlined, RightOutlined} from "@ant-design/icons";
import {useTranslation} from "react-i18next";
import "./RedisFooter.less";
import StretchIcon from "../../icons/StretchIcon.tsx";
import {invoke} from "@tauri-apps/api/core";

export interface ValueFilterParam {
    query: string,
}

export interface FooterAction {
    type: string,
    ts: number
}

interface RedisFooterProps {
    pageLength: number;
    total: number;
    pageSize?: number;
    data?: any;
    keyName: string;
    pinMode?: boolean;
    pageNumberOnly?: boolean;
    noMoreDataPage?: boolean;
    dynamicPageSize?: number;
    scannedSize?: number;
    action?: FooterAction;
    onPage?: (pageNum: number) => void;
    onPreviousPage: (pageNum: number) => void;
    onNextPage: (pageNum: number) => void;
    onRowAdd?: (keyInfo: any) => void;
    onFilter?: (param: ValueFilterParam) => void;
}

const RedisFooter: React.FC<RedisFooterProps> = (props, context) => {
    const {t} = useTranslation();
    const fixPageTotal = useRef(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(props.pageSize || 5);
    const searchInputRef = useRef<InputRef>(null);
    const [inputValue, setInputValue] = useState('');
    const debounceTimeoutRef = useRef<any>();
    const [pageInfo, setPageInfo] = useState(<></>);

    useEffect(() => {
        searchInputRef.current?.focus();
        setPage(1);
        fixPageTotal.current = 0;
    }, [props.data]);
    useEffect(() => {
        if (props.pageNumberOnly) {
            setPageInfo(<>Page {page}</>);
        } else {
            setPageInfo(<>{page} / {calPageTotal(props.total)}</>);
        }
    }, [props.total, props.pageNumberOnly, page]);
    const onPreviousPage = (e: any) => {
        const pageNum = Math.max(page - 1, 0);
        setPage(pageNum);
        props.onPreviousPage(pageNum);
    };
    const onNextPage = (e: any) => {
        const pageNum = page + 1;
        setPage(pageNum);
        props.onNextPage(pageNum);
    };
    const calPageTotal = (total: number) => {
        if (props.dynamicPageSize) {
            return props.dynamicPageSize;
        } else {
            if (fixPageTotal.current == 0) {
                fixPageTotal.current = Math.ceil(total / pageSize);
            }
            return fixPageTotal.current;
        }
    }
    const onSearchInputKeyDown = (e: any) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.keyCode === 65) {
                // CTRL/CMD + A
                searchInputRef.current!.focus({cursor: 'all'})
            } else if (e.keyCode === 67) {
                // CTRL/CMD + C
                // writeText(contentValue as string).then(r => {
                // });
            } else if (e.keyCode === 86) {
                // CTRL/CMD + V
                // readText().then(setContentValue)
            } else if (e.keyCode == 1) {

            }
        } else if (e.keyCode == 13) {
            if (props.onFilter) {
                clearTimeout(debounceTimeoutRef.current);
                // @ts-ignore
                const value = searchInputRef.current.input.value;
                props.onFilter({query: value})
            }
        }
    };

    // 防抖函数
    function debounce(func: any, wait: any) {
        return function () {
            // @ts-ignore
            const context = this;
            const args = arguments;
            clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = setTimeout(function () {
                func.apply(context, args);
            }, wait);
        };
    }

    // 查询函数，这里进行了防抖处理
    const debouncedQuery = debounce(async () => {
        try {
            // @ts-ignore
            const value = searchInputRef.current.input.value;
            if (props.onFilter) {
                setPage(1);
                props.onFilter({query: value})
            }
        } catch (error) {
            console.error('Error fetching query result:', error);
        }
    }, 150); // 设置防抖时间为500毫秒

    // 处理输入变化
    const handleInputChange = (event: any) => {
        // @ts-ignore
        const value = searchInputRef.current.input.value;
        setInputValue(value);
        debouncedQuery(); // 每次输入都调用防抖后的查询函数
    };

    // 清理防抖定时器，防止在组件卸载后执行
    useEffect(() => {
        return () => {
            clearTimeout(debounceTimeoutRef.current);
        };
    }, []); // 空依赖数组确保只在组件卸载时清理

    useEffect(() => {
        switch (props.action?.type) {
            case 'RESET':
                setPage(1);
                break
        }
    }, [props.action]);

    const onAddRowBtnClicked = (e: any) => {
        props.onRowAdd?.(props.data);
    };

    const pinModeClass = props.pinMode ? 'pinned' : '';
    const leftDisabled = page == 1;
    const rightDisabled = props.pageNumberOnly ? props.noMoreDataPage : page == calPageTotal(props.total);

    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({x: 0, y: 0});

    const handleMouseDown = (e: any) => {
        console.log('---------------')
        setIsDragging(true);
    };

    const handleMouseMove = (e: any) => {
        if (isDragging) {
            // const touch = e.touches[0]; // 取第一个触点
            // setPosition({x: touch.clientX, y: touch.clientY});
            // invoke('resize_redis_pushpin_window', {keyName: props.keyName, x: e.screenX, y: e.screenY}).then(r => {
            // });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    return (<>
        <div className={'redis-footer ' + pinModeClass}>
            <Row>
                <Col span={8}>
                    <Flex className={'right-button-group'} gap="small" align="center" wrap="wrap">
                        <Button
                            className={`redis-footer-button first-btn ${pinModeClass}`}
                            type="default"
                            size="small"
                            icon={<PlusOutlined/>}
                            onClick={onAddRowBtnClicked}
                        >Row</Button>

                        <Input
                            className={'redis-footer-button search-input ' + pinModeClass}
                            autoComplete={'off'}
                            spellCheck={false}
                            ref={searchInputRef}
                            onKeyDown={onSearchInputKeyDown}
                            onChange={handleInputChange}
                            autoFocus={true}
                            style={{width: props.pinMode ? '60px' : '10vw'}}
                            placeholder={t('redis.main.hash.footer.search_placeholder')}
                        />

                    </Flex>
                </Col>
                <Col span={8}>
                    <div className={'redis-footer-info-text'}>
                        {props.pageLength} rows {props.scannedSize && !pinModeClass ? `/ ${props.scannedSize} scanned` : ''}
                    </div>
                </Col>
                <Col span={8}>
                    <div
                        className={`redis-footer-pager ${pinModeClass} ${leftDisabled && rightDisabled ? 'disabled' : ''}`}>
                        <Flex gap="small" align="center" wrap="wrap">
                            <Button type="default"
                                    size="small"
                                    icon={<LeftOutlined/>}
                                    className={`redis-footer-button ${leftDisabled ? 'disabled' : ''}`}
                                    onClick={onPreviousPage}
                                    disabled={page == 1}
                            />

                            <div
                                className={`redis-footer-pager-info ${leftDisabled && rightDisabled ? 'disabled' : ''}`}>
                                {pageInfo}
                            </div>

                            <Button type="default"
                                    size="small"
                                    icon={<RightOutlined/>}
                                    className={`redis-footer-button ${rightDisabled ? 'disabled' : ''}`}
                                    onClick={onNextPage}
                                    disabled={props.pageNumberOnly ? props.noMoreDataPage : page == calPageTotal(props.total)}
                            />
                        </Flex>
                    </div>
                </Col>
            </Row>
            <div className={`resize-icon ${props.pinMode ? 'pin-mode' : ' hidden'}`}>
                <StretchIcon className={'icon'} style={{width: 10, color: '#efefef'}}
                             onMouseDown={handleMouseDown}
                             onMouseUp={handleMouseUp}
                             onMouseMove={handleMouseMove}
                />
            </div>
        </div>
    </>)
};

export default RedisFooter;
