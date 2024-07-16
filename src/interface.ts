import type { ProposalQueryManager } from "./utils/managers/proposal.manager";
import type { SignerManager } from "./utils/managers/signer.manager";

export interface Explorer {
    proposal: string;
    tx: string;
}

export interface Network {
    name: string;
    chain_id: string;
    hd_path: string;
    denom: string;
    prefix: string;
    decimals: number;
    wallet: string;
    api: string;
    rpc: string;
    explorer: Explorer;
    authz: Authz;
    telegram_label: string;
}

export interface Authz {
    granter : string;
    v1_vote_type : boolean;
    v1_exec_type: boolean;
}

export interface Telegram {
    label: string;
    chat_id: string;
}

export interface Toml {
    telegram: Telegram[];
    network: Network[];
}

export interface Keys {
    name: string;
    mnemonics: string;
}

export interface Actionables {
    query: ProposalQueryManager;
    signer: SignerManager;
    chat_id: string;
    chain_id:string;
    chain_name:string,
    proposal_explorer:string,
    transaction_explorer:string
}