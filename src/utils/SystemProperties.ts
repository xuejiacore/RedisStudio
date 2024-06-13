import {SqlLiteManager} from "./SqlLiteManager.ts";
import {invoke} from "@tauri-apps/api/core";

export namespace SysProp {
    export const FIELD_NAME_SYS_DB_VERSION = 'f_db_version';
    export const FIELD_SYS_REDIS_SEPARATOR = 'f_redis_separator';
}

/**
 * System properties
 */
class SystemProperties {

    static properties = new Map<string, string>();

    /**
     * initialize system properties from databases
     */
    public static initialize() {
        SqlLiteManager.use(db => {
            db.select(`
                SELECT field, value
                FROM tbl_system
            `).then((result: any) => {
                result.forEach((row: any) => this.properties.set(row.field, row.value));
            });
        })
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
        SqlLiteManager.use(db => {
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