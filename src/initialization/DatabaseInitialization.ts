import Database from "@tauri-apps/plugin-sql";
import {SysProp} from "../utils/SystemProperties.ts";

const SYS_DB_VERSION: string = '0.0.1';

/**
 * initialize default system properties
 * @param executeInitSql sql func
 */
function initializeDefaultSystemProperties(executeInitSql: (sql: string, bindValues?: unknown[]) => void) {
    const cts = Date.now();
    const addProp = (k: string, v: string) => {
        executeInitSql(`INSERT INTO tbl_system(field, value, create_time)
                        VALUES ($1, $2, $3)`, [k, v, cts]);
    };

    addProp(SysProp.FIELD_NAME_SYS_DB_VERSION, SYS_DB_VERSION);
}

/**
 * create system database's tables
 * @param executeInitSql sql executor
 * @param updateDbVersion sql parameters
 */
function createSystemTables(executeInitSql: (sql: string, bindValues?: unknown[]) => void, updateDbVersion?: number) {
    // create and initialize system table.
    executeInitSql(`
        CREATE TABLE IF NOT EXISTS tbl_system
        (
            id          INTEGER NOT NULL
                CONSTRAINT tbl_system_pk
                    PRIMARY KEY AUTOINCREMENT,
            field       TEXT, -- system property field                
            value       TEXT, -- system property value
            create_time INTEGER,
            update_time INTEGER
        )
    `);

    // table for storage datasource configuration.
    executeInitSql(`
        CREATE TABLE IF NOT EXISTS tbl_datasource
        (
            id                 INTEGER NOT NULL
                CONSTRAINT tbl_datasource_pk
                    PRIMARY KEY AUTOINCREMENT,
            datasource_name    TEXT,                 -- datasource name
            host               TEXT,                 -- host 
            port               INTEGER default 3306, -- port
            user_name          TEXT,                 -- username
            password           TEXT,                 -- password
            default_database   INTEGER default 0,    -- default database
            ssh_tunnel_enabled INTEGER,              -- 1:ssh tunnel enabled, 2:disabled
            color              TEXT,                 -- datasource color
            properties         TEXT,                 -- configuration properties json
            create_time        INTEGER,              -- create time
            path               TEXT    default '/'   -- path of directory
        )
    `);

    // table for group redis custom tags.
    executeInitSql(`
        CREATE TABLE IF NOT EXISTS tbl_redis_tag_group
        (
            id            INTEGER NOT NULL
                CONSTRAINT tbl_redis_tag_group_pk
                    PRIMARY KEY AUTOINCREMENT,
            datasource_id INTEGER, -- datasource id
            pid           INTEGER, -- parent tag group
            group_name    TEXT,    -- group name
            tag_id        INTEGER  -- tag id
        )
    `)

    // table for redis custom tag
    executeInitSql(`
        CREATE TABLE IF NOT EXISTS tbl_redis_custom_tag
        (
            id            INTEGER NOT NULL
                CONSTRAINT tbl_redis_custom_tag_pk
                    PRIMARY KEY AUTOINCREMENT,
            pattern       TEXT,    -- pattern for redis key, eg: 'foo:{userId}:bar:{nid}'
            name          TEXT,    -- name of tag
            description   TEXT,    -- description of tag
            meta          TEXT,    -- meta info json for pattern, eg: {"userId":"用户ID","nid":"NID"}
            last_vars     TEXT,    -- last variables record, eg: {"userId":"foo", "nid":"bar"}
            datasource_id TEXT,    -- datasource id
            create_time   INTEGER, -- create time
            update_time   INTEGER, -- update time
            mode          INTEGER, -- match mode, 1: exact 2: fuzzy
            pin_meta      TEXT     -- pinned field
        )
    `);

    // table for store analysis result
    executeInitSql(`
        CREATE TABLE IF NOT EXISTS tbl_database_analysis_result
        (
            id                   INTEGER NOT NULL
                CONSTRAINT tbl_database_analysis_result_pk
                    PRIMARY KEY AUTOINCREMENT,
            datasource_id        TEXT,    -- datasource id
            database             INTEGER, -- database index
            create_time          INTEGER, -- create time
            analysis_json_result TEXT,    -- analysis json result
            ver                  INTEGER  -- version
        )
    `);

    // table for data view
    executeInitSql(`
        CREATE TABLE IF NOT EXISTS tbl_data_view
        (
            id         integer                     -- id
                constraint tbl_data_view_pk
                    primary key autoincrement,
            datasource integer not null,           -- datasource id
            database   integer not null default 0, -- database index
            name       TEXT    not null,           -- name of data view
            sort       integer          default 0  -- sort value
        );
    `);

    // table for store item of data view
    executeInitSql(`
        CREATE TABLE IF NOT EXISTS tbl_data_view_items
        (
            id           integer           -- id
                constraint tbl_data_view_items_pk
                    primary key autoincrement,
            data_view_id integer not null, -- data view id
            key          TEXT    not null, -- key of data view
            key_type     TEXT    not null, -- key type
            sort         integer default 0 -- sort value
        )
    `);

    // table for store data view's variables
    executeInitSql(`
        CREATE TABLE IF NOT EXISTS tbl_data_view_vars
        (
            id                integer           -- id
                constraint tbl_data_view_vars_pk
                    primary key autoincrement,
            data_view_item_id integer not null, -- data view item id
            name              TEXT    not null, -- variable name
            value             TEXT    not null, -- variable value
            create_time       INTEGER           -- create time
        )
    `);

    // update the current version into table `tbl_system`
    if (updateDbVersion == 0) {
        // initialize table first time
        initializeDefaultSystemProperties(executeInitSql);
    } else {
        executeInitSql(`
            UPDATE tbl_system
            set value = $1
            where field = $2
        `, [SYS_DB_VERSION, SysProp.FIELD_NAME_SYS_DB_VERSION]);
    }
}

/**
 * Initialize the system database.
 * @param db database instance
 */
async function initializeSystemDatabase(db: Database) {
    const executeInitSql = (sql: string, bindValues?: unknown[]) => {
        db.execute(sql, bindValues).then(r => {
            console.debug('execute sql: ', sql, r)
        });
    };

    const r = await db.select(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'tbl_system';
    `);

    if (Array.isArray(r) && r.length == 0) {
        console.debug('initialize system databases.', r)
        createSystemTables(executeInitSql, 0);
    } else {
        const version = await db.select(`
            SELECT value
            FROM tbl_system
            where field = $1
        `, [SysProp.FIELD_NAME_SYS_DB_VERSION]);
        if (Array.isArray(version)) {
            if (version.length == 0) {
                createSystemTables(executeInitSql, 0)
            } else if (version[0].value != SYS_DB_VERSION) {
                createSystemTables(executeInitSql, 1)
            }
        } else {
            console.error('error result', r);
        }
    }
}

export {initializeSystemDatabase};