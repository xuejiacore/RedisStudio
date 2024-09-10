import React, {useEffect, useRef} from "react";
import "./index.less";
import {Flex, InputRef} from "antd";
import SpotlightAutoComplete from "../../components/titlebar/spotlight/SpotlightAutoComplete.tsx";
import "../../utils/i18n.ts";

interface SpotlightSearchProp {
}

const SpotlightSearch: React.FC<SpotlightSearchProp> = (props, context) => {
    const searchInputRef = useRef<InputRef>(null);

    useEffect(() => {
        searchInputRef.current?.focus();
    }, []);

    return <>
        <Flex className={'spotlight-container'} justify={"center"} align={"flex-start"}>
            {/*<Input ref={searchInputRef} placeholder={'Search anything.'} className={'input-style'}/>*/}
            <SpotlightAutoComplete global={true}/>
        </Flex>
    </>
}

export default SpotlightSearch;