import os from "os"
import { join } from "path"
import info from "../package.json"

export let ENV = {
    HOME_DIR_PATH: Bun.env.HOME_DIR || join(os.homedir(), `.${info.name}`),
    TAG_IN_REPLAY: Bun.env.TAG_IN_RELAY || "",
    TELEGRAM_BOT_ID: Bun.env.TELEGRAM_BOT_TOKEN,
    METADATA_ON_VOTES: Bun.env.METADATA || "",
    MONITORING_INTERVAL : Bun.env.MONITORING_INTERVAL || 5
}

export const CONSTANT = {
    KEY_FOLDER: "keys",
    DB_FOLDER: "db",
    CONFIG_FILE: "config.toml"
}

export const DEFAULT_VALUES = `
# Telegram configurations
[[telegram]]
label = "proposal"
chat_id = "<id>"

# Network configurations

[[network]]
name = "cosmoshub"
chain_id = "cosmoshub-4"
hd_path = "m/44'/118'/0'/0/0"
denom = "uatom"
prefix = "cosmos"
decimals = 6
wallet = "default"
rpc = "https://cosmos-rpc.polkachu.com/"
api = "https://cosmos-api.polkachu.com/"
telegram_label = "proposal"

[network.authz]
granter = ""
v1_vote_type = true
v1_exec_type = false

[network.explorer]
proposal = "https://www.mintscan.io/cosmos/proposals/"
tx = "https://www.mintscan.io/cosmos/txs/"
`