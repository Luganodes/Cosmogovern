import os from "os"
import { join } from "path"
import info from "../package.json"

export let ENV = {
    HOME_DIR_PATH: Bun.env.HOME_DIR || join(os.homedir(), `.${info.name}`),
    TAG_IN_REPLAY: Bun.env.TAG_IN_RELAY || "",
    TELEGRAM_BOT_ID: Bun.env.TELEGRAM_BOT_ID,
    METADATA_ON_VOTES: Bun.env.METADATA || ""
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
  chatId = "<id>"

  # Networks configurations
  [[network]]
  name = "cosmoshub"
  chainId = "cosmoshub-4"
  hdPath = "m/44'/118'/0'/0/0"
  denom = "uatom"
  prefix = "cosmos"
  decimals = 6
  wallet = "default"
  granter = ""
  rpc = "https://cosmos-rpc.polkachu.com/"
  api = "https://cosmos-api.polkachu.com/"
  explorer = { proposal = "https://www.mintscan.io/cosmos/proposals/", tx = "https://www.mintscan.io/cosmos/txs/" }
  telegramLabel = "proposal"
`