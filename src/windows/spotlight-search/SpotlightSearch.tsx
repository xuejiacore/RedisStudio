import React from "react";
import "./index.less";
import {Flex} from "antd";
import SpotlightAutoComplete from "../../components/titlebar/spotlight/SpotlightAutoComplete.tsx";
import "../../utils/i18n.ts";
import useEscape from "../../hooks/useEscape.tsx";

interface SpotlightSearchProp {
}

const SpotlightSearch: React.FC<SpotlightSearchProp> = (props, context) => {
    useEscape();

    return <>
        <div className={'spotlight-panel'}>
            <Flex id={'spotlight-search-input'} className={'spotlight-container'} justify={"center"}
                  align={"flex-start"}>
                <SpotlightAutoComplete global={true}/>
            </Flex>
        </div>
    </>
}

export default SpotlightSearch;