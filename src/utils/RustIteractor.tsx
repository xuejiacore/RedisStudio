import {invoke} from "@tauri-apps/api/core";

type Command = {
    [key: string]: { cmd: string }
};
const CommandConst: Command = {
    redis_get_hash: {cmd: "action"},
    redis_list_datasource: {cmd: "action"},
    redis_get_database_info: {cmd: "action"},
}

function rust_invoke(cmd: keyof Command, payload: any) {
    return invoke("redis_invoke", {
        data: JSON.stringify({
            cmd: cmd,
            ...payload
        })
    });
}

function zk_invoke(cmd: string, payload: any) {
    return invoke('zk_invoke', {
        cmd: cmd,
        params: JSON.stringify(payload)
    })
}

export {rust_invoke, zk_invoke, CommandConst};
