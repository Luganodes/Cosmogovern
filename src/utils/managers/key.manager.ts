import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { stringToPath } from "@cosmjs/crypto";
import type { Keys } from "../../interface";
import { join } from "path"
import { CONSTANT, ENV } from "../../constants";
import fs from "fs/promises"
import logger from "../log";


const log = logger("manager:key")

export class KeyManager {
    private keypath: string
    private keys: Map<string, string> = new Map();


    constructor() {
        this.keypath = join(ENV.HOME_DIR_PATH, CONSTANT.KEY_FOLDER)
        this.loadKeys()
    }

    public async createNewMnemonics(): Promise<string> {
        const { mnemonic } = await DirectSecp256k1HdWallet.generate(24)
        return mnemonic
    }

    public async convertMnemonicsTokey(
        mnemonics: string,
        hdPath: string,
        prefix: string
    ): Promise<DirectSecp256k1HdWallet> {
        try {
            const signer = await DirectSecp256k1HdWallet.fromMnemonic(mnemonics, {
                prefix: prefix,
                hdPaths: [stringToPath(hdPath)],
            });
            return signer;
        } catch (error) {
            throw new Error(`Failed to convert mnemonics to key: ${error}`);
        }
    }

    public async writeKeysDataToFile(keyname: string, data: Keys): Promise<void> {
        const filePath = join(this.keypath, `${keyname}.json`);

        try {
            const exists = await this.fileExists(filePath);

            if (exists) {
                log.info(`File ${filePath} already exists.`);
                return
            }
            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
            log.info(`Keys data written to ${filePath}`);
        } catch (error) {
            throw new Error(`Failed to write keys data to file: ${error}`);
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

    private async loadKeys(): Promise<void> {
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
            throw new Error(`Failed to load keys from folder: ${error}`);
        }
    }

    public findKeyByName(name: string): string | undefined {
        return this.keys.get(name);
    }

}