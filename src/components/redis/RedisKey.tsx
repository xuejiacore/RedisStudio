import React, {ReactNode, useEffect, useRef, useState} from "react";
import type {DataNode} from "antd/es/tree";
import {rust_invoke} from "../../utils/RustIteractor";
import "./RedisKey.less";

type CustomDataNode = DataNode & {
    keyType?: string,
    isLeaf?: boolean,
    total: number
};

interface RedisKeyProp {
    node: CustomDataNode
}

/*
 * 定义redisKey。关键作用是监听key在树种的视窗可见状态，当可见后，判定类型数据的加载情况，如果数据已经加载，那么直接试用，否则与后端交互获得
 * 对应的类型数据
 */
const RedisKey: React.FC<RedisKeyProp> = (props, context) => {
    const ref = useRef(null);
    const node = props.node;
    const deleteClz = '';//deletedKeys.has(data.key as string) ? ' deleted' : '';
    const keyTypeNameFirstChar = node.keyType?.substring(0, 1).toUpperCase();
    const title = node.title as ReactNode;
    const [keyTypeFirstChart, setKeyTypeFirstChart] = useState(keyTypeNameFirstChar)
    const [keyType, setKeyType] = useState<string | undefined>(node.keyType);

    useEffect(() => {
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (!node.keyType || node.keyType == 'undefined') {
                        rust_invoke("redis_key_type", {
                            datasource_id: 'datasource01',
                            keys: [node.key]
                        }).then(ret => {
                            const obj = JSON.parse(ret as string);
                            node.keyType = obj.types[node.key as string];
                            setKeyTypeFirstChart(node.keyType?.substring(0, 1).toUpperCase())
                            setKeyType(node.keyType);
                        });
                        observer.disconnect();
                    }
                }
            })
        });

        if (ref.current) {
            observer.observe(ref.current);
        }
        return () => {
            if (ref.current) {
                observer.unobserve(ref.current);
            }
        }
    }, []);

    return <>
        <div ref={ref} className="tree-node-name">
            <div className={"redis-type " + keyType + deleteClz}>{keyTypeFirstChart}</div>
            <div className={`redis-key-name ${title ? '' : 'empty'}`}>{title ? title : '<Empty>'}</div>
        </div>
    </>
}
export default RedisKey;