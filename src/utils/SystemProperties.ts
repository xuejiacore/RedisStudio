import {SysManager} from "./SysManager.ts";
import {invoke} from "@tauri-apps/api/core";
import {LazyStore} from "@tauri-apps/plugin-store";

export namespace SysProp {
    export const FIELD_NAME_SYS_DB_VERSION = 'f_db_version';
    export const FIELD_SYS_REDIS_SEPARATOR = 'f_separator';
}

/**
 * System properties
 */
class SystemProperties {

    static properties = new Map<string, any>();

    /**
     * initialize system properties from databases
     */
    public static initialize() {
        const store = new LazyStore("resources/setting.json", {autoSave: true});
        store.entries().then(entries => {
            entries.forEach(entry => {
                const key = entry[0];
                const value = entry[1];
                this.properties.set(key, value);
            });
            console.log('-------->>2', this.properties);
        });
        console.log('-------->>', this.properties);
        // SqlLiteManager.use(db => {
        //     db.select(`
        //         SELECT field, value
        //         FROM tbl_system
        //     `).then((result: any) => {
        //         result.forEach((row: any) => this.properties.set(row.field, row.value));
        //     });
        // })
    }

    /**
     * get sys property value by key
     * @param key key of property
     */
    public static value(key: string): string {
        return SystemProperties.properties.get(key) as string;
    }

    public static async val(key: string): Promise<string> {
        return invoke<string>('sys_prop', {property: key});
    }

    /**
     * set property value with key
     * @param key key
     * @param value value
     */
    public static set(key: string, value: string) {
        SysManager.use(db => {
            db.execute(`
                UPDATE tbl_system
                SET value       = $1,
                    update_time = $2
                WHERE field = $3`, [value, Date.now(), key]
            ).then(r => {
                if (r.rowsAffected == 0) {
                    db.execute(`
                        INSERT INTO tbl_system(field, value, create_time)
                        values ($1, $2, $3)
                    `, [key, value, Date.now()]).then(r => {
                        console.debug('insert result', r);
                    });
                } else {
                    SystemProperties.properties.set(key, value);
                }
            });
        });
    }
}

export default SystemProperties;