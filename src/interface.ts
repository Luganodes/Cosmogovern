export interface Explorer {
    proposal: string;
    tx: string;
}

export interface Network {
    name: string;
    chainId: string;
    hdPath: string;
    denom: string;
    prefix: string;
    decimals: number;
    wallet: string;
    api: string;
    rpc: string;
    explorer: Explorer;
    granter: string;
    telegramLabel: string;
}

export interface Telegram {
    label: string;
    chatId: string;
}

export interface Toml {
    telegram: Telegram[];
    network: Network[];
}

export interface Keys {
    name: string;
    mnemonics: string;
}