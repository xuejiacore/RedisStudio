import React from "react";

interface DataSourceGroupProp {
    name: string
}

const DataSourceGroup: React.FC<DataSourceGroupProp> = (props, context) => {

    return (
        <>
            <div className={'group-name-node'}>
                {props.name}
            </div>
        </>
    )
}

export default DataSourceGroup;