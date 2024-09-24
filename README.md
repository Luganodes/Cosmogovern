# Cosmogovern Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Usage](#usage)
5. [Environment Variables](#environment-variables)
6. [Tested Networks](#Tested-networks)

## Introduction

Cosmogovern is a self-hosted Telegram bot designed for voting on Cosmos-based ecosystems. It leverages the `x/authz` module to provide secure voting capabilities.

## Installation

### Prerequisites
- [Bun](https://bun.sh) JavaScript runtime environment

### Build from Source

1. Install Bun:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Build the project:
   ```bash
   make all
   ```
   This command generates a binary named `cosmogovern` in the project's root directory.

## Configuration

1. Initialize the bot:
   ```bash
   cosmogovern init
   ```
   By default, this creates configurations and details in the `~/.cosmogovern` directory.

2. Add your keys:
   ```bash
   cosmogovern keys add <keyname>
   ```
   Note: You can use the same mnemonics for multiple chains.

3. Configure your network settings:
   Edit the config file (typically located in `~/.cosmogovern/config.toml`) and add your chain configurations under the `network` section. Example:

   ```toml
   [[telegram]]
   label = "proposal"
   chat_id = "<id>"

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
   ```

4. Grant Authz access:
   For security reasons, the bot uses the Cosmos ecosystem's authz functionality for voting. Follow the [Keplr guide](https://help.keplr.app/articles/a-step-by-step-guide-for-granting-voting-rights-to-your-account-via-authz) to grant permissions. After granting permission, fill in the granter address in the `network.authz` section of the config file.

## Usage

To start the bot:
```bash
cosmogovern start
```

## Environment Variables

Set the following environment variables before starting the bot:

| Variable               | Description                                               | Required/Optional     |
|------------------------|-----------------------------------------------------------|-----------------------|
| `HOME_DIR`             | Specifies the home directory path for the tool            | Optional              |
| `TAG_IN_REPLAY`        | Tag used in replay for reminder scenarios                 | Optional              |
| `TELEGRAM_BOT_TOKEN`   | Token for the Telegram bot (used for alerts/automation)   | Required              |
| `METADATA`             | Metadata related to votes, stored for reference           | Optional              |
| `MONITORING_INTERVAL`  | Interval (in seconds) for monitoring checks/updates       | Optional (Default: 5) |

## Tested Networks

Cosmogovern has been tested on:
- Locally spun Cosmos SDK-based chains
- Nibiru Mainnet: [Transaction](https://nibiru.explorers.guru/transaction/B0118ACDDD14F6B4149E997CECB0E6F69816D67E6B05210C21851F0C2F7EB3A5?height=11902532)

For more information or support, please refer to the project's GitHub repository or contact the maintainers.
