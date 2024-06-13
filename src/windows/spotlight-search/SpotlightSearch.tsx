import React from "react";
import "./index.less";
import {Button, Divider, Flex, Input, Row, Space} from "antd";

interface SpotlightSearchProp {
}

const SpotlightSearch: React.FC<SpotlightSearchProp> = (props, context) => {
    return <>
        <div className={'spotlight-search-container'}>
            <div className={'visible-content'}>
                <Flex justify={"center"} align={"flex-start"}>
                    <Input placeholder={'Search anything.'} className={'input-style'} autoFocus/>
                </Flex>
                <Divider className={'divider'}/>
            </div>
        </div>
    </>
}

export default SpotlightSearch;