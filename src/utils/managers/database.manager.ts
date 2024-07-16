import { join } from "path";
import { Database } from "bun:sqlite";
import { CONSTANT, ENV } from "../../constants";
import  {name as TABLE_NAME}  from "../../../package.json"
import logger from "../log";

const log = logger("manager:database")

export class DatabaseManager {
    private readonly db: Database;

    constructor() {
        try {
            const dbPath = join(ENV.HOME_DIR_PATH, CONSTANT.DB_FOLDER, `${TABLE_NAME}.sqlite`);
            this.db = new Database(dbPath);
            log.info(`Database connected: ${dbPath}`);
            this.initializeTable();
        } catch (error) {
            log.error(`Failed to initialize database: ${error}`);
            if (error instanceof Error) {
                throw new Error(`Database initialization failed: ${error.message}`);
            } else {
                throw new Error("Database initialization failed: Unknown error");
            }
        }
    }

    private initializeTable(): void {
        const query = `
            CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
                uid TEXT PRIMARY KEY,
                chainid TEXT NOT NULL, 
                proposal_id INTEGER NOT NULL, 
                proposal_start_time TEXT NOT NULL, 
                proposal_end_time TEXT NOT NULL, 
                voted_telegram BOOLEAN DEFAULT FALSE, 
                voted_by TEXT DEFAULT '',
                vote_option TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                message_id INTEGER DEFAULT -1
            )
        `;
        try {
            this.db.run(query);
            log.info("Table created or already exists");
        } catch (error) {
            log.error(`Failed to create table: ${error}`);
            throw new Error("Table creation failed");
        }
    }

    private generateUID(chainId: string, proposal_id: string): string {
        return `${chainId}_${proposal_id}`;
    }

    public insertDataIfNotExist(
        chainName: string,
        chainId: string,
        proposal_id: string,
        proposal_start_time: string,
        proposal_end_time: string,
        voted: boolean
    ): void {
        const uid = this.generateUID(chainName, proposal_id);
        const query = `
            INSERT OR IGNORE INTO ${TABLE_NAME} (
                uid, chainid, proposal_id, proposal_start_time, proposal_end_time, voted_telegram
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;
        try {
            this.db.run(query, [uid, chainId, proposal_id, proposal_start_time, proposal_end_time, voted]);
            log.info(`Inserted data for UID: ${uid}`);
        } catch (error) {
            log.error(`Failed to insert data for UID ${uid}: ${error}`);
            throw new Error("Data insertion failed");
        }
    }

    public searchIfVoted(chainId: string, proposal_id: string): { created: boolean; voted: boolean; message_id: number } {
        const uid = this.generateUID(chainId, proposal_id);
        const query = `SELECT voted_telegram, message_id FROM ${TABLE_NAME} WHERE uid = ?`;
    
        try {
            const result = this.db.query(query).get(uid) as { voted_telegram: number; message_id: number } | null;
            if (result) {
                return { 
                    created: true, 
                    voted: result.voted_telegram !== 0, 
                    message_id: result.message_id 
                };
            }
            return { created: false, voted: false, message_id: -2 };
        } catch (error) {
            log.error(`Error querying database for UID ${uid}: ${error}`);
            throw new Error("Database query failed");
        }
    }
    
    public checkIf6HoursPassed(chainId: string, proposal_id: string): boolean {
        const uid = this.generateUID(chainId, proposal_id);
        const query = `SELECT voted_telegram, last_checked FROM ${TABLE_NAME} WHERE uid = ?`;
    
        try {
            const result = this.db.query(query).get(uid) as {
                voted_telegram: number;
                last_checked: string;
            } | null;
    
            if (result && result.voted_telegram === 0) {
                const lastChecked = new Date(result.last_checked);
                const now = new Date();
                const diffHours = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60);
                if (diffHours >= 6) {
                    const updateQuery = `UPDATE ${TABLE_NAME} SET last_checked = CURRENT_TIMESTAMP WHERE uid = ?`;
                    this.db.run(updateQuery, [uid]);
                    return true;
                }
            }
            return false;
        } catch (error) {
            log.error(`Error checking time passage for UID ${uid}: ${error}`);
            throw new Error("Time check failed");
        }
    }
    
    public updateVotingStatus(chainId: string, proposal_id: string, voted: boolean, vote_option :string ,voted_by:string): void {
        const uid = this.generateUID(chainId, proposal_id);
        const query = `UPDATE ${TABLE_NAME} SET voted_telegram = ? ,voted_by = ?, vote_option = ? WHERE uid = ?`;
        try {
            this.db.run(query, [voted, voted_by,vote_option,uid]);
            log.info(`Updated voting status for UID: ${uid} to ${voted}`);
        } catch (error) {
            log.error(`Failed to update voting status for UID ${uid}: ${error}`);
            throw new Error("Voting status update failed");
        }
    }

    public updateMessageId(chainName: string, proposal_id: string, message_id: number): void {
        const uid = this.generateUID(chainName, proposal_id);
        const query = `UPDATE ${TABLE_NAME} SET message_id = ? WHERE uid = ?`;
        try {
            this.db.run(query, [message_id, uid]);
            log.debug(`Updated message ID for UID: ${uid} to ${message_id}`);
        } catch (error) {
            log.error(`Failed to update message ID for UID ${uid}: ${error}`);
            throw new Error("Message ID update failed");
        }
    }
}