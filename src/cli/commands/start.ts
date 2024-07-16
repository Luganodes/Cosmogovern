import { ENV } from "../../constants";
import type { Actionables } from "../../interface";
import { Telegram } from "../../telegram";
import logger from "../../utils/log";
import { ConfigManager } from "../../utils/managers/config.manager";
import { KeyManager } from "../../utils/managers/key.manager";
import { ProposalQueryManager } from "../../utils/managers/proposal.manager";
import { SignerManager } from "../../utils/managers/signer.manager";


const log = logger("command:start")

export default async function StartBot(){
    const config = new ConfigManager()
    const keys = new KeyManager()
    
    const networks = config.getAllChains()
    let actions : Actionables[] = []

    for (const network of networks){
        
        const query = new ProposalQueryManager(network.api,network.authz.granter)
        await query.checkVersion()

        const wallet =  await keys.convertMnemonicsToKey(keys.findKeyByName(network.wallet)!,network.hd_path,network.prefix)
        const signer = new SignerManager(network.rpc,wallet,network.denom,network.decimals,network.authz.granter,config.getAuthVoteType(network.chain_id)!,config.getAuthExecType(network.chain_id)!)
        actions.push({
            chat_id: config.getTelegramChatByLabel(network.telegram_label)!,
            query,
            signer,
            chain_id:network.chain_id,
            chain_name:network.name,
            proposal_explorer:network.explorer.proposal,
            transaction_explorer:network.explorer.tx
        })
        log.info(`loaded Actionables for network : ${network.name}`)
    }

    if (ENV.TELEGRAM_BOT_ID){
        const bot = new Telegram(ENV.TELEGRAM_BOT_ID,actions)
        await bot.start()
    }



}

StartBot()