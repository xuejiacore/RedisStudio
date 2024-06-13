import React from "react";
import type {TreeDataNode} from 'antd';
import {Tree} from 'antd';
import {DirectoryTreeProps} from "antd/es/tree";
import './index.less';

interface FavoriteTreeProp {

}

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
        ],
    },
];

const FavoriteTree: React.FC<FavoriteTreeProp> = (props, context) => {
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
                defaultExpandAll
                onSelect={onSelect}
                onExpand={onExpand}
                treeData={treeData}
            />
        </div>
    )
}

export default FavoriteTree;