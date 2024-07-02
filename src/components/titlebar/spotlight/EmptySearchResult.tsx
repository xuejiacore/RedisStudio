import {Empty, Flex} from "antd";
import no_data_svg from "../../../assets/images/icons/no-data.svg";
import React from "react";
import "./EmptySearchResult.less";
import {useTranslation} from "react-i18next";

interface EmptySearchResultProp {

}

const EmptySearchResult: React.FC<EmptySearchResultProp> = (props, context) => {
    const {t} = useTranslation();
    return <>
        <Flex justify={'center'}>
            <Empty
                className={'search-empty'}
                image={no_data_svg}
                imageStyle={{
                    height: 40,
                }}
                description={(
                    <span>{t("redis.spotlight.empty.description")}</span>
                )}
            >
            </Empty>
        </Flex>
    </>
};

export default EmptySearchResult;