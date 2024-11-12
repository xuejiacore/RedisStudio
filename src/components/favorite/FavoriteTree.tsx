import React, {useEffect, useRef, useState} from "react";
import type {TreeDataNode} from 'antd';
import {Tree} from 'antd';
import {DirectoryTreeProps} from "antd/es/tree";
import "./FavoriteTree.less"
import {UnlistenFn} from "@tauri-apps/api/event";

const {DirectoryTree} = Tree;

const treeData: TreeDataNode[] = [
    {
        title: 'parent 0',
        key: '0-0',
        children: [
            {title: 'leaf 0-0', key: '0-0-0', isLeaf: true},
            {title: 'leaf 0-1', key: '0-0-1', isLeaf: true},
        ],
    },
    {
        title: 'parent 1',
        key: '0-1',
        children: [
            {title: 'leaf 1-0', key: '0-1-0', isLeaf: true},
            {title: 'leaf 1-1', key: '0-1-1', isLeaf: true},
            {title: 'leaf 1-2', key: '0-1-2', isLeaf: true},
            {title: 'leaf 1-3', key: '0-1-3', isLeaf: true},
            {title: 'leaf 1-4', key: '0-1-4', isLeaf: true},
            {title: 'leaf 1-5', key: '0-1-5', isLeaf: true},
            {title: 'leaf 1-6', key: '0-1-6', isLeaf: true},
            {title: 'leaf 1-7', key: '0-1-7', isLeaf: true},
            {title: 'leaf 1-8', key: '0-1-8', isLeaf: true},
            {title: 'leaf 1-9', key: '0-1-9', isLeaf: true},
        ],
    },
    {
        title: 'parent 2',
        key: '0-2',
        children: [
            {title: 'leaf 2-0', key: '0-2-0', isLeaf: true},
            {title: 'leaf 2-1', key: '0-2-1', isLeaf: true},
            {title: 'leaf 2-2', key: '0-2-2', isLeaf: true},
            {title: 'leaf 2-3', key: '0-2-3', isLeaf: true},
            {title: 'leaf 2-4', key: '0-2-4', isLeaf: true},
            {title: 'leaf 2-5', key: '0-2-5', isLeaf: true},
            {title: 'leaf 2-6', key: '0-2-6', isLeaf: true},
            {title: 'leaf 2-7', key: '0-2-7', isLeaf: true},
            {title: 'leaf 2-8', key: '0-2-8', isLeaf: true},
            {title: 'leaf 2-9', key: '0-2-9', isLeaf: true},
        ],
    },
    {
        title: 'parent 3',
        key: '0-3',
        children: [
            {title: 'leaf 3-0', key: '0-3-0', isLeaf: true},
            {title: 'leaf 3-1', key: '0-3-1', isLeaf: true},
            {title: 'leaf 3-2', key: '0-3-2', isLeaf: true},
            {title: 'leaf 3-3', key: '0-3-3', isLeaf: true},
            {title: 'leaf 3-4', key: '0-3-4', isLeaf: true},
            {title: 'leaf 3-5', key: '0-3-5', isLeaf: true},
            {title: 'leaf 3-6', key: '0-3-6', isLeaf: true},
            {title: 'leaf 3-7', key: '0-3-7', isLeaf: true},
            {title: 'leaf 3-8', key: '0-3-8', isLeaf: true},
            {title: 'leaf 3-9', key: '0-3-9', isLeaf: true},
        ],
    },
];

interface FavoriteTreeProps {
    datasource?: string,
    database?: number
}

const FavoriteTree: React.FC<FavoriteTreeProps> = (props, context) => {
    const calParentHeight = () => (window.innerHeight
        || document.documentElement.clientHeight
        || document.body.clientHeight) - 198;
    const [comHeight, setComHeight] = useState(calParentHeight());

    const removeListenerRef = useRef<UnlistenFn>();
    const removeListenerIdRef = useRef(0);
    useEffect(() => {
        const handleResize = () => {
            const newHeight = calParentHeight();
            setComHeight(newHeight);
        }
        window.addEventListener("resize", handleResize);

        const ts = Date.now();
        const addListenerAsync = async () => {
            return new Promise<UnlistenFn>(resolve => {
                const resolveFn = (unlistenFn: UnlistenFn) => {
                    if (removeListenerIdRef.current != ts) {
                        //loadData();
                        resolve(unlistenFn);
                    } else {
                        unlistenFn();
                    }
                };
            });
        };
        (async () => {
            removeListenerRef.current = await addListenerAsync();
        })();
        return () => {
            window.removeEventListener("resize", handleResize);
            removeListenerIdRef.current = ts;
            const removeListenerAsync = async () => {
                return new Promise<void>(resolve => {
                    if (removeListenerRef.current) {
                        removeListenerRef.current();
                    }
                    resolve();
                })
            }

            removeListenerAsync().then(t => {
            });
        };
    }, []);

    const onSelect: DirectoryTreeProps['onSelect'] = (keys, info) => {
        console.log('Trigger Select', keys, info);
    };

    const onExpand: DirectoryTreeProps['onExpand'] = (keys, info) => {
        console.log('Trigger Expand', keys, info);
    };

    return (
        <div className={'favor-tree'}>
            <DirectoryTree
                multiple
                defaultExpandAll={false}
                onSelect={onSelect}
                onExpand={onExpand}
                treeData={treeData}

                height={comHeight}
                showLine={false}
                showIcon={false}
                checkable={false}
            />
        </div>
    )
}

export default FavoriteTree;