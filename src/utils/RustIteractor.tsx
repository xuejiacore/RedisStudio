import {invoke} from "@tauri-apps/api/core";

type Command = {
    [key: string]: { cmd: string }
};
const CommandConst: Command = {
    redis_get_hash: {cmd: "action"},
    redis_list_datasource: {cmd: "action"},
    redis_get_database_info: {cmd: "action"},
}

function redis_invoke(cmd: keyof Command, payload: any, datasource_id: number, database: number) {
    return invoke("redis_invoke", {
        data: JSON.stringify({
            cmd: cmd,
            datasource_id: datasource_id,
            database: database,
            ...payload
        })
    });
}

export {redis_invoke, CommandConst};
