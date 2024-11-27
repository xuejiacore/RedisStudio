export interface DataSourceProps {
    datasourceId: number;
    host: string;
    port: number;
    name?: string;
    dscolor?: string;
    database: number;
    keySpac: number;
}

export interface DataSourceChangedEvent {
    props: DataSourceProps;
    winId: number;
}