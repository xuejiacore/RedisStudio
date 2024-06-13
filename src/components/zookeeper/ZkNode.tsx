import React, {ReactNode, useEffect, useRef} from "react";
import type {DataNode} from "antd/es/tree";
import "./ZkNodeTree.less";

type CustomDataNode = DataNode & {
    keyType?: string,
    isLeaf?: boolean,
    total: number
};

interface ZkNodeProp {
    node: CustomDataNode
}

/*
 * 定义redisKey。关键作用是监听key在树种的视窗可见状态，当可见后，判定类型数据的加载情况，如果数据已经加载，那么直接试用，否则与后端交互获得
 * 对应的类型数据
 */
const ZkNode: React.FC<ZkNodeProp> = (props, context) => {
    const ref = useRef(null);
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                if (!node.keyType || node.keyType == 'undefined') {
                    // rust_invoke("redis_key_type", {
                    //     datasource_id: 'props.datasourceId',
                    //     key: node.key
                    // }).then(ret => {
                    //     const obj: { type: string } = JSON.parse(ret as string);
                    //     node.keyType = obj.type;
                    // });
                }
            } else {
            }
        });

        if (ref.current) {
            observer.observe(ref.current);
        }
        return () => {
            observer.disconnect();
        }
    }, []);
    let node = props.node;
    const deleteClz = '';//deletedKeys.has(data.key as string) ? ' deleted' : '';
    const keyTypeNameFirstChar = node.keyType?.substring(0, 1).toUpperCase();
    let title = node.title as ReactNode;
    return <>
        <div ref={ref} className="tree-node-name">
            <div className={"zk-file-type " + node.keyType + deleteClz}>N{keyTypeNameFirstChar}</div>
            <div className={'zk-file-name'}>{title}</div>
        </div>
    </>
}
export default ZkNode;