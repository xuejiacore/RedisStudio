import Database from "@tauri-apps/plugin-sql";
import {initializeSystemDatabase} from "../initialization/DatabaseInitialization.ts";

class SqlLiteManager {
    static DATABASE_NAME: string = 'redisstudio.db';
    static initialized: boolean = false;
    static INSTANCE: SqlLiteManager;

    private database?: Database;
    private dbName?: string;

    constructor(dbName: string) {
        if (!dbName) {
            dbName = SqlLiteManager.DATABASE_NAME;
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
            this.INSTANCE = new SqlLiteManager(this.DATABASE_NAME);
            this.INSTANCE.connect().then(db => {
                this.INSTANCE.database = db;
                initializeSystemDatabase(db).then(r => {
                    invoker(db);
                });
            });
        } else {
            if (this.INSTANCE.database) {
                invoker(this.INSTANCE.database);
            }
        }
    }

}

export {SqlLiteManager};