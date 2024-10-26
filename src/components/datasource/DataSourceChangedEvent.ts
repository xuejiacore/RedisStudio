export interface DataSourceProps {
    datasourceId: string;
    host: string;
    port: number;
    database: number;
    keySpac: number;
}

export interface DataSourceChangedEvent {
    props: DataSourceProps;
    winId: number;
}