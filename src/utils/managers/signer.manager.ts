import type { Coin, EncodeObject } from "@cosmjs/proto-signing";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { calculateFee, GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { MsgVote as GovMsgVote } from "cosmjs-types/cosmos/gov/v1/tx";
import { MsgExec as ExecMsgVote } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { VoteOption } from 'cosmjs-types/cosmos/gov/v1/gov';
import { bignumber, format, multiply, pow } from 'mathjs';
import { ENV } from "../../constants";
import logger from "../log";

const log = logger("manager:signer");

type VoteType = "/cosmos.gov.v1beta1.MsgVote" | "/cosmos.gov.v1.MsgVote";
type ExecType = "/cosmos.authz.v1beta1.MsgExec" | "/cosmos.authz.v1.MsgExec";
type VoteOptionType = 'yes' | 'no' | 'veto' | 'abstain';

interface VoteResult {
    result: boolean;
    txHash?: string;
    error?: string;
}

export class SignerManager {
    private readonly rpc: string;
    private readonly wallet: DirectSecp256k1HdWallet;
    private readonly denom: string;
    private readonly decimal: number;
    private readonly granter: string;
    private readonly voteType: VoteType;
    private readonly execType: ExecType;
    private client?: SigningStargateClient;
    private chainID?: string;

    constructor(
        rpc: string,
        wallet: DirectSecp256k1HdWallet,
        denom: string,
        decimal: number,
        granter: string,
        voteType: VoteType,
        execType: ExecType
    ) {
        this.rpc = rpc;
        this.wallet = wallet;
        this.denom = denom;
        this.decimal = decimal;
        this.granter = granter;
        this.voteType = voteType;
        this.execType = execType;
        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            this.client = await SigningStargateClient.connectWithSigner(this.rpc, this.wallet);
            this.chainID = await this.client.getChainId();
            log.info(`SignerManager initialized with Stargate client. Chain ID: ${this.chainID}`);
        } catch (error) {
            log.error('Failed to initialize SignerManager:', error);
            throw new Error(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getAddress(): Promise<string> {
        const accounts = await this.wallet.getAccounts();
        if (accounts.length === 0) {
            throw new Error("No accounts found in the wallet");
        }
        return accounts[0].address;
    }

    private async getMinimumGasFee(): Promise<string> {
        if (!this.denom || this.denom.trim() === "") {
            throw new Error("Invalid denom: denom cannot be empty");
        }
        if (!Number.isInteger(this.decimal) || this.decimal < 0) {
            throw new Error("Invalid decimals: must be a non-negative integer");
        }

        try {
            const fee = multiply(0.000000025, pow(10, this.decimal)).toString();
            const formattedFee = format(bignumber(fee), {
                notation: 'fixed',
                precision: 4,
            });
            return `${formattedFee}${this.denom}`;
        } catch (error) {
            throw new Error(`Error calculating minGasPrice: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getClient(): Promise<SigningStargateClient> {
        if (!this.client) {
            throw new Error('SignerManager not initialized.');
        }
        return this.client;
    }

    private async getNetworkFee(txs: EncodeObject[], fee: "auto" | number): Promise<{ amount: readonly Coin[]; gas: string }> {
        const address = await this.getAddress();
        const client = await this.getClient();
        const gasPrice = await this.getMinimumGasFee();

        const gasEstimation = await client.simulate(address, txs, undefined);
        const price = GasPrice.fromString(gasPrice);
        const multiplier = typeof fee === 'number' ? fee : 1.5;
        const stdFee = calculateFee(Math.round(gasEstimation * multiplier), price);
        return {
            amount: stdFee.amount,
            gas: stdFee.gas,
        };
    }

    private convertTypeToVote(type: VoteOptionType): VoteOption {
        switch (type) {
            case 'yes':
                return VoteOption.VOTE_OPTION_YES;
            case 'no':
                return VoteOption.VOTE_OPTION_NO;
            case 'veto':
                return VoteOption.VOTE_OPTION_NO_WITH_VETO;
            case 'abstain':
                return VoteOption.VOTE_OPTION_ABSTAIN;
            default:
                throw new Error(`Invalid vote type: ${type}`);
        }
    }

    private async createExecutionMessage(proposalId: bigint, option: VoteOption): Promise<EncodeObject[]> {
        const msgVote = GovMsgVote.fromPartial({
            proposalId,
            option,
            voter: this.granter,
            metadata: ENV.METADATA_ON_VOTES
        });
        const grantee = await this.getAddress();
        const msgExec = ExecMsgVote.fromPartial({
            grantee,
            msgs: [
                {
                    typeUrl: this.voteType,
                    value: GovMsgVote.encode(msgVote).finish(),
                },
            ]
        });

        return [{
            typeUrl: this.execType,
            value: msgExec,
        }];
    }

    public async voteOnProposal(proposalId: string | number, vote: VoteOptionType): Promise<VoteResult> {
        try {
            const account = await this.getAddress();
            const authzTransactionMessage = await this.createExecutionMessage(BigInt(proposalId), this.convertTypeToVote(vote));
            const fee = await this.getNetworkFee(authzTransactionMessage, "auto");

            log.info(`Voting client started:
    - Chain: ${this.chainID}
    - Proposal: ${proposalId}
    - Vote: ${vote}
    - Fee: ${fee.amount}
    - Gas: ${fee.gas}`);

            const result = await this.client?.signAndBroadcast(
                account,
                authzTransactionMessage,
                fee
            );

            if (!result) {
                throw new Error("Failed to sign and broadcast transaction");
            }

            return {
                result: result.code === 0,
                txHash: result.transactionHash,
                error: result.code !== 0 ? `Transaction failed with code ${result.code}` : undefined
            };
        } catch (error) {
            log.error(`Error voting on proposal ${proposalId}:`, error);
            return {
                result: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}