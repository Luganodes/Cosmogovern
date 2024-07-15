import fs from "fs";
import toml from "toml";
import { join } from "path";
import { CONSTANT, DEFAULT_VALUES, ENV } from "../../constants";
import logger from "../log";
import type { Toml, Network } from "../../interface";

const log = logger("manager:config");


export class ConfigManager {
  private readonly config: Toml;
  private readonly configPath: string;

  constructor() {
    this.configPath = join(ENV.HOME_DIR_PATH, CONSTANT.CONFIG_FILE);
    this.createDefaultConfigIfNeeded();
    this.config = this.loadConfig();
  }

  private loadConfig(): Toml {
    try {
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Config file not found at path: ${this.configPath}`);
      }

      const fileContents = fs.readFileSync(this.configPath, "utf-8");
      return toml.parse(fileContents) as Toml;
    } catch (error) {
      log.error(`Failed to load config: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error("Failed to load configuration");
    }
  }

  private createDefaultConfigIfNeeded(): void {
    try {
      this.ensureDirectoryExists(ENV.HOME_DIR_PATH);
      this.ensureFileExists(this.configPath, DEFAULT_VALUES);
      this.ensureDirectoryExists(join(ENV.HOME_DIR_PATH, CONSTANT.KEY_FOLDER));
      this.ensureDirectoryExists(join(ENV.HOME_DIR_PATH, CONSTANT.DB_FOLDER));
    } catch (error) {
      log.error(`Error creating default config: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error("Failed to create default configuration");
    }
  }

  private ensureDirectoryExists(directoryPath: string): void {
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
      log.info(`Created directory: ${directoryPath}`);
    }
  }

  private ensureFileExists(filePath: string, defaultContent: string): void {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, defaultContent, "utf-8");
      log.info(`Created file with default content: ${filePath}`);
    }
  }

  public getTelegramChatByLabel(label: string): string | undefined {
    try {
      const telegramConfig = this.config.telegram.find((t) => t.label === label);
      if (!telegramConfig) {
        log.warn(`No Telegram configuration found for label: ${label}`);
      }
      return telegramConfig?.chatId;
    } catch (error) {
      log.error(`Error getting Telegram chat by label: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  public getNetworksByWalletName(walletName: string): string[] {
    try {
      const networks = this.config.network
        .filter((n) => n.wallet === walletName)
        .map((n) => n.name);

      if (networks.length === 0) {
        log.warn(`No networks found for wallet name: ${walletName}`);
      }

      return networks;
    } catch (error) {
      log.error(`Error getting networks by wallet name: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  public getAllChains(): Network[] {
    return this.config.network;
  }

  public getChainNetInfoById(chainId: string): Network | undefined {
    try {
      const network = this.config.network.find((n) => n.chainId === chainId);
      if (!network) {
        log.warn(`No network found for chain ID: ${chainId}`);
      }
      return network;
    } catch (error) {
      log.error(`Error getting chain net info by ID: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  public getChainNetInfoByName(name: string): Network | undefined {
    try {
      const network = this.config.network.find((n) => n.name === name);
      if (!network) {
        log.warn(`No network found for name: ${name}`);
      }
      return network;
    } catch (error) {
      log.error(`Error getting chain net info by name: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
}