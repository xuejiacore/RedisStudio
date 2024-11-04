import React from "react";
import {ResponsiveFunnel} from "@nivo/funnel";

export interface DataItem {
    id: string;
    label: string;
    value: number;
}

interface MemoryFreeOverTimeProps {
    data: DataItem[];
}

const MemoryFreeOverTime: React.FC<MemoryFreeOverTimeProps> = (props) => {

    return <>
        <ResponsiveFunnel
            data={props.data}
            margin={{top: 20, right: 20, bottom: 20, left: 20}}
            valueFormat=">-.4s"
            colors={{scheme: 'spectral'}}
            borderWidth={6}
            layers={['separators', 'parts', 'annotations', (c => {
                return c.parts.map(t => {
                    return (
                        <g key={`${t.data.id}_${t.x}_${t.y}`} transform={`translate(${t.x}, ${t.y})`}>
                            <text textAnchor={'middle'}
                                  dominantBaseline={'central'}
                                  fontWeight={600}
                                  fontSize={12}
                                  pointerEvents={'none'}
                            >{t.data.label}</text>
                        </g>
                    );
                })
            })]}
            labelColor={{
                from: 'color',
                modifiers: [
                    [
                        'darker',
                        3
                    ]
                ]
            }}
            enableBeforeSeparators={false}
            enableAfterSeparators={false}
            beforeSeparatorLength={100}
            beforeSeparatorOffset={20}
            afterSeparatorLength={100}
            afterSeparatorOffset={20}
            currentPartSizeExtension={5}
            currentBorderWidth={8}
            motionConfig="wobbly"
        />
    </>;
}

export default MemoryFreeOverTime;