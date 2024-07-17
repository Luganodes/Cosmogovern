import { ConfigManager } from "../../utils/managers/config.manager";
import logger from "../../utils/log";

const log = logger("command:init");

export async function initCommand(): Promise<void> {
    try {
        const _ = new ConfigManager();
        log.info("Initialization completed successfully.");
    } catch (error) {
        log.error("Initialization failed:", error);
        throw error;
    }
}