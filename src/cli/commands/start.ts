import { ENV } from "../../constants";
import type { Actionables } from "../../interface";
import { Telegram } from "../../telegram";
import logger from "../../utils/log";
import { ConfigManager } from "../../utils/managers/config.manager";
import { KeyManager } from "../../utils/managers/key.manager";
import { ProposalQueryManager } from "../../utils/managers/proposal.manager";
import { SignerManager } from "../../utils/managers/signer.manager";

const log = logger("command:start");

export default async function startBot(): Promise<void> {
    try {
        const config = new ConfigManager();
        const keys = new KeyManager();
        await keys.loadKeys()
        const networks = config.getAllChains();
        const actions: Actionables[] = (await Promise.all(networks.map(async (network) => {
            try {
                const query = new ProposalQueryManager(network.api, network.authz.granter);
                await query.checkVersion();

                const key = keys.findKeyByName(network.wallet);
                if (!key) {
                    throw new Error(`Key not found for wallet: ${network.wallet}`);
                }

                const wallet = await keys.convertMnemonicsToKey(key, network.hd_path, network.prefix);
                const signer = new SignerManager(
                    network.rpc,
                    wallet,
                    network.denom,
                    network.decimals,
                    network.authz.granter,
                    config.getAuthVoteType(network.chain_id)!,
                    config.getAuthExecType(network.chain_id)!
                );

                const chatId = config.getTelegramChatByLabel(network.telegram_label);
                if (!chatId) {
                    throw new Error(`Telegram chat ID not found for label: ${network.telegram_label}`);
                }

                log.info(`Loaded Actionables for network: ${network.name}`);

                return {
                    chat_id: chatId,
                    query,
                    signer,
                    chain_id: network.chain_id,
                    chain_name: network.name,
                    proposal_explorer: network.explorer.proposal,
                    transaction_explorer: network.explorer.tx
                };
            } catch (error) {
                log.error(`Failed to load Actionables for network ${network.name}:`, error);
                return null;
            }
        }))).filter((action): action is Actionables => action !== null);

        if (actions.length === 0) {
            throw new Error("No valid actions were loaded. Check your network configurations.");
        }

        if (!ENV.TELEGRAM_BOT_ID) {
            throw new Error("TELEGRAM_BOT_ID is not set in the environment variables");
        }

        const bot = new Telegram(ENV.TELEGRAM_BOT_ID, actions);
        await bot.start();

        log.info("Bot started successfully");
    } catch (error) {
        log.error("Failed to start bot:", error);
        process.exit(1);
    }
}

