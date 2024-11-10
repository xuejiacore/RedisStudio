import Database from "@tauri-apps/plugin-sql";
import {initializeSystemDatabase} from "../initialization/DatabaseInitialization.ts";
import {LazyStore} from "@tauri-apps/plugin-store";

class SysManager {
    static DATABASE_NAME: string = 'redisstudio.db';
    static SETTING_PATH: string = 'resources/setting.json';
    static initialized: boolean = false;
    static INSTANCE: SysManager;
    static properties = new Map<string, any>();

    private database?: Database;
    private dbName?: string;

    constructor(dbName: string) {
        if (!dbName) {
            dbName = SysManager.DATABASE_NAME;
        }
        this.dbName = dbName;
    }

    public async connect(): Promise<Database> {
        return Database.load("sqlite:" + this.dbName);
    }

    static use(invoker: (db: Database) => void) {
        if (!this.initialized) {
            console.log('SqliteManager initialized', this.initialized);
            this.initialized = true;
            this.INSTANCE = new SysManager(this.DATABASE_NAME);
            this.INSTANCE.connect().then(db => {
                this.INSTANCE.database = db;
                initializeSystemDatabase(db).then(r => {
                    invoker(db);
                });
            });

            const store = new LazyStore(this.SETTING_PATH, {autoSave: true});
            store.entries().then(entries => {
                entries.forEach(entry => {
                    const key = entry[0];
                    const value = entry[1];
                    this.properties.set(key, value);
                });
                console.log('-------->>2', this.properties);
            });
        } else {
            if (this.INSTANCE.database) {
                invoker(this.INSTANCE.database);
            }
        }
    }

    /**
     * get sys property value by key
     * @param key key of property
     */
    public static value(key: string, def?: any): any | undefined {
        return this.properties.get(key) ?? def;
    }

}

export {SysManager};