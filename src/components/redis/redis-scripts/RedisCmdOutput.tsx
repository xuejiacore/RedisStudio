import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from "react";
import {CmdResultItem} from "./RedisCmdEditor.tsx";
import "./RedisCmdOutput.less";
import RedisResp from "./RedisResp.tsx";
import Scrollbar from "smooth-scrollbar";

export interface CmdOutputChannel {
    onOutput: (output: CmdResultItem[]) => void;
}

export interface RedisCmdOutputRef {
    channel: CmdOutputChannel;
}

export interface RedisCmdOutputProp {
    datasourceId: string;
    selectedDatabase: number;
}

const RedisCmdOutput = forwardRef<RedisCmdOutputRef | undefined, RedisCmdOutputProp>((props, ref) => {
    const [outputItems, setOutputItems] = useState<CmdResultItem[]>([]);
    const [content, setContent] = useState(<></>);
    const scrollbarRef = useRef<Scrollbar>();

    // 使用 useImperativeHandle 来自定义暴露给父组件的实例值
    useImperativeHandle(ref, () => ({
        channel: {
            onOutput: item => {
                setOutputItems(item);
            }
        }
    }));

    useEffect(() => {
        setContent(asPrettyPlainText(outputItems));
        if (scrollbarRef.current) {
            setTimeout(() => {
                if (scrollbarRef.current) {
                    scrollbarRef.current.scrollTo(0, scrollbarRef.current.limit.y, 300); // 1000 是滚动动画的时间
                }
            }, 200);
        }
        return () => {
        }
    }, [outputItems]);


    const asPrettyPlainText = (content: CmdResultItem[]) => {
        return (<>
            {content.map((item, idx) => {
                return <RedisResp key={item.key}
                                  index={idx}
                                  resp={item}
                                  datasourceId={props.datasourceId}
                                  selectedDatabase={props.selectedDatabase}/>;
            })}
        </>);
    };

    const containerRef = useRef(null);

    useEffect(() => {
        if (containerRef.current) {
            scrollbarRef.current = Scrollbar.init(containerRef.current, {
                damping: 0.1, // 设置滚动的阻尼大小
                thumbMinSize: 10, // 设置滚动条的最小大小
                alwaysShowTracks: true
            });

            // 在组件销毁时销毁 Smooth Scrollbar
            return () => {
                if (scrollbarRef.current) {
                    scrollbarRef.current.destroy();
                }
            };
        }
    }, []); // 空数组作为依赖，确保只初始化一次

    return <>
        <div ref={containerRef} className="scrollbar-container">
            <div className="scroll-content">
                {content}
            </div>
        </div>
    </>
});
RedisCmdOutput.displayName = 'RedisCmdOutput';
export default RedisCmdOutput;
