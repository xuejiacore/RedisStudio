import React, {useEffect, useRef} from "react";
import DatabaseItem from "./DatabaseItem.tsx";
import {Flex} from "antd";

import "./index.less";
import Scrollbar from "smooth-scrollbar";

interface DatabaseListProp {

}

const DatabaseList: React.FC<DatabaseListProp> = (props, context) => {
    const containerRef = useRef(null);
    const scrollbarRef = useRef<Scrollbar>();
    useEffect(() => {
        if (containerRef.current) {
            scrollbarRef.current = Scrollbar.init(containerRef.current, {
                damping: 0.1, // 设置滚动的阻尼大小
                thumbMinSize: 10, // 设置滚动条的最小大小
                alwaysShowTracks: false
            });

            // 在组件销毁时销毁 Smooth Scrollbar
            return () => {
                if (scrollbarRef.current) {
                    scrollbarRef.current.destroy();
                }
            };
        }
    }, []);
    return <>
        <Flex className={'database-list'} justify={"start"} align={"start"} vertical>
            <div ref={containerRef} className="scrollbar-container">
                <div className="scroll-content">
                    <DatabaseItem database={0} key_size={1243}/>
                    <DatabaseItem database={1} key_size={324}/>
                    <DatabaseItem selected={true} database={2} key_size={12}/>
                    <DatabaseItem database={3} key_size={12}/>
                    <DatabaseItem database={4} key_size={12}/>
                    <DatabaseItem database={5} key_size={12}/>
                    <DatabaseItem database={6} key_size={12}/>
                    <DatabaseItem database={7} key_size={12}/>
                    <DatabaseItem database={8} key_size={12}/>
                    <DatabaseItem database={9} key_size={12}/>
                    <DatabaseItem database={10} key_size={12}/>
                    <DatabaseItem database={11} key_size={12}/>
                    <DatabaseItem database={12} key_size={12}/>
                    <DatabaseItem database={13} key_size={12}/>
                    <DatabaseItem database={14} key_size={12}/>
                    <DatabaseItem database={15} key_size={12}/>
                    <DatabaseItem database={15} key_size={12}/>
                    <DatabaseItem database={15} key_size={12}/>
                </div>
            </div>
        </Flex>
    </>;
}

export default DatabaseList;