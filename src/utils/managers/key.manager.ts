import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { stringToPath } from "@cosmjs/crypto";
import { join } from "path";
import fs from "fs/promises";
import { CONSTANT, ENV } from "../../constants";
import logger from "../log";
import type { Keys } from "../../interface";

const log = logger("manager:key");



export type KeyData = {
    [key: string]: string;
};

export class KeyManager {
    private readonly keypath: string;
    private keys: Map<string, string> = new Map();

    constructor() {
        this.keypath = join(ENV.HOME_DIR_PATH, CONSTANT.KEY_FOLDER);
        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            await this.ensureKeyDirectoryExists();
        } catch (error) {
            log.error("Failed to initialize KeyManager:", error);
            throw new Error(`KeyManager initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async ensureKeyDirectoryExists(): Promise<void> {
        try {
            await fs.mkdir(this.keypath, { recursive: true });
        } catch (error) {
            throw new Error(`Failed to create key directory: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async createNewMnemonics(strength: 12 | 15 | 18 | 21 | 24 = 24): Promise<string> {
        try {
            const { mnemonic } = await DirectSecp256k1HdWallet.generate(strength);
            return mnemonic;
        } catch (error) {
            throw new Error(`Failed to generate new mnemonics: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async convertMnemonicsToKey(
        mnemonics: string,
        hdPath: string,
        prefix: string
    ): Promise<DirectSecp256k1HdWallet> {
        try {
            return await DirectSecp256k1HdWallet.fromMnemonic(mnemonics, {
                prefix: prefix,
                hdPaths: [stringToPath(hdPath)],
            });
        } catch (error) {
            throw new Error(`Failed to convert mnemonics to key: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public async writeKeysDataToFile(keyname: string, data: Keys): Promise<void> {
        const filePath = join(this.keypath, `${keyname}.json`);

        try {
            const exists = await this.fileExists(filePath);

            if (exists) {
                log.warn(`File ${filePath} already exists. Skipping write operation.`);
                return;
            }

            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
            log.info(`Keys data written to ${filePath}`);

            // Update the in-memory keys map
            this.keys.set(data.name, data.mnemonics);
        } catch (error) {
            throw new Error(`Failed to write keys data to file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    public async loadKeys(): Promise<void> {
        try {
            const files = await fs.readdir(this.keypath);
            this.keys.clear();

            await Promise.all(files.map(async (file) => {
                if (file.endsWith('.json')) {
                    const filePath = join(this.keypath, file);
                    const data = await fs.readFile(filePath, 'utf-8');
                    const keyData: Keys = JSON.parse(data);
                    this.keys.set(keyData.name, keyData.mnemonics);
                }
            }));
            log.info(`Loaded ${this.keys.size} keys`);
        } catch (error) {
            throw new Error(`Failed to load keys from folder: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public findKeyByName(name: string): string | undefined {
        const key = this.keys.get(name);
        if (!key) {
            log.warn(`Key not found for name: ${name}`);
        }
        return key;
    }

    public getAllKeys(): KeyData {
        const keyData: KeyData = {};
        this.keys.forEach((value, key) => {
            keyData[key] = value;
        });
        return keyData;
    }



    public async deleteKey(keyname: string): Promise<boolean> {
        try {
            const filePath = join(this.keypath, `${keyname.trim()}.json`);
            await fs.access(filePath);
            await fs.unlink(filePath);
            return true
        } catch (error) {
            if (error === 'ENOENT') {
                log.warn(`File for key "${keyname}" not found on disk`);
                return true;
            }
            throw new Error(`Failed to delete key "${keyname}": ${error}`);
        }
    }

}
