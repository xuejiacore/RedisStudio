import React from "react";
import {ResponsiveLine} from "@nivo/line";

interface ThroughoutMonitorProps {
}

const data = [
    {
        "id": "japan",
        "color": "hsl(314, 70%, 50%)",
        "data": [
            {
                "x": "plane",
                "y": 150
            },
            {
                "x": "helicopter",
                "y": 172
            },
            {
                "x": "boat",
                "y": 120
            },
            {
                "x": "train",
                "y": 297
            },
            {
                "x": "subway",
                "y": 187
            },
            {
                "x": "bus",
                "y": 263
            },
            {
                "x": "car",
                "y": 202
            },
            {
                "x": "moto",
                "y": 7
            },
            {
                "x": "bicycle",
                "y": 294
            },
            {
                "x": "horse",
                "y": 3
            },
            {
                "x": "skateboard",
                "y": 5
            },
            {
                "x": "others",
                "y": 49
            }
        ]
    },
    {
        "id": "us",
        "color": "hsl(252, 70%, 50%)",
        "data": [
            {
                "x": "plane",
                "y": 193
            },
            {
                "x": "helicopter",
                "y": 260
            },
            {
                "x": "boat",
                "y": 59
            },
            {
                "x": "train",
                "y": 35
            },
            {
                "x": "subway",
                "y": 212
            },
            {
                "x": "bus",
                "y": 6
            },
            {
                "x": "car",
                "y": 45
            },
            {
                "x": "moto",
                "y": 242
            },
            {
                "x": "bicycle",
                "y": 203
            },
            {
                "x": "horse",
                "y": 220
            },
            {
                "x": "skateboard",
                "y": 59
            },
            {
                "x": "others",
                "y": 105
            }
        ]
    },
];

const ThroughoutMonitor: React.FC<ThroughoutMonitorProps> = props => {
    return <>
        <ResponsiveLine
            data={data}
            margin={{top: 20, right: 10, bottom: 50, left: 50}}
            xScale={{type: 'point'}}
            yScale={{
                type: 'linear',
                min: 'auto',
                max: 'auto',
                stacked: true,
                reverse: false
            }}
            enableGridX={false}
            enableGridY={false}
            yFormat=" >-.2f"
            curve="cardinal"
            axisTop={null}
            axisRight={null}
            colors={["#3B4BF5", "#932069"]}
            theme={{
                "axis": {
                    "ticks": {
                        "text": {
                            "fill": "#878787",
                            "fontSize": 10,
                        }
                    },
                    "legend": {
                        "text": {
                            "fill": "#cac2c2",
                            "fontSize": 14,
                        }
                    },
                }
            }}
            axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: '',
                legendOffset: 36,
                legendPosition: 'middle',
                truncateTickAt: 0
            }}
            axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: 'Mb/s',
                legendOffset: -40,
                legendPosition: 'middle',
                truncateTickAt: 0,
            }}
            lineWidth={1}
            pointSize={3}
            pointColor={{theme: 'background'}}
            pointBorderWidth={2}
            pointBorderColor={{from: 'serieColor'}}
            pointLabel="data.yFormatted"
            pointLabelYOffset={-12}
            enableArea={false}
            enableTouchCrosshair={true}
            useMesh={true}
        />
    </>
}

export default ThroughoutMonitor;