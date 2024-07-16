import { Bot, Context, InlineKeyboard } from "grammy";
import type { Actionables } from "../interface";
import logger, { capitalize } from "../utils/log";
import { ENV } from "../constants";
import type { Proposal, ProposalQueryManager } from "../utils/managers/proposal.manager";
import { DatabaseManager } from "../utils/managers/database.manager";
import type { VoteResult } from "../utils/managers/signer.manager";

const log = logger("telegram:index");

export class Telegram {
    private readonly actions: Actionables[];
    private readonly bot: Bot;
    private readonly database: DatabaseManager;

    constructor(token: string, actions: Actionables[]) {
        if (!token) {
            throw new Error("Telegram bot token is required");
        }
        this.bot = new Bot(token);
        this.actions = actions;
        this.database = new DatabaseManager();
        this.bot.on("callback_query:data", this.handleVoting.bind(this)); 
    }

  
    private async handleVoting(ctx: Context): Promise<void> {
        if (!ctx.callbackQuery?.data) {
            await this.handleVoteError(ctx, new Error("Invalid callback query"));
            return;
        }

        const [proposalId, chainname, vote] = ctx.callbackQuery.data.split(":");
        const username = ctx.from?.username;
        const messageId = ctx.callbackQuery.message?.message_id;

        if (!proposalId || !chainname || !vote || !username || !messageId) {
            await this.handleVoteError(ctx, new Error("Incomplete vote data"));
            return;
        }

        try {
            await this.processVote(proposalId, chainname, vote, username, messageId, ctx);
        } catch (error) {
            await this.handleVoteError(ctx, error);
        }
    }

    private async processVote(
        proposalId: string,
        chainname: string,
        vote: string,
        username: string,
        messageId: number,
        ctx: Context
    ): Promise<void> {
        log.info(`Vote received from telegram: ProposalID: ${proposalId}, Chainname: ${chainname}, Vote: ${vote}, User: ${username}`);

        const action = this.actions.find(action => action.chain_name === chainname);
        if (!action) {
            throw new Error(`No action defined for chain: ${chainname}`);
        }

        const voteProcessed = await action.signer.voteOnProposal(proposalId, vote.trim());
        if (!voteProcessed.result) {
            throw new Error("Vote processing failed!");
        }

        await this.updateVoteStatus(action, proposalId, vote, username, messageId, voteProcessed, ctx);
    }

    private async updateVoteStatus(
        action: Actionables,
        proposalId: string,
        vote: string,
        username: string,
        messageId: number,
        voteProcessed: VoteResult,
        ctx: Context
    ): Promise<void> {
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        this.database.updateVotingStatus(action.chain_name, proposalId, true, vote, this.escapeMarkdown(username));
        
        const replyMessage = this.createVoteConfirmationMessage(action, proposalId, username, vote, voteProcessed.txHash!);
        await ctx.reply(replyMessage, {
            parse_mode: "Markdown",
            reply_parameters:{
                message_id:messageId
            }
        });
    }

    private createVoteConfirmationMessage(
        action: Actionables,
        proposalId: string,
        username: string,
        vote: string,
        txHash: string
    ): string {
        return `
✅ *Vote submitted for ${capitalize(action.chain_name)} Proposal ${proposalId}*

*Voted by*: @${this.escapeMarkdown(username.trim())}
*Voted*: ${vote.trim()}

[Transaction Details](${action.transaction_explorer.trim()}/${txHash.trim()})
        `;
    }

    private escapeMarkdown(text: string): string {
        return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    }

    private async checkForNewProposals(query: ProposalQueryManager): Promise<Proposal[]> {
        try {
            return await query.fetchProposals();
        } catch (error) {
            log.error("Error fetching proposals:", error);
            await this.sendErrorAlert(error as Error, "Fetching Proposals","");
            return [];
        }
    }
        private async startProposalMonitoring2(): Promise<void>{
            console.log("hello")
        }


    private async startProposalMonitoring(): Promise<void> {
        const interval = Number(ENV.MONITORING_INTERVAL) * 60000;
        log.info(`Bot started. Monitoring proposals every ${ENV.MONITORING_INTERVAL} minutes...`);


        setInterval(async () => {
            for (const action of this.actions) {
                try {
                    const proposals = await this.checkForNewProposals(action.query);
                    for (const proposal of proposals) {
                        await this.processProposal(action, proposal);
                    }
                } catch (error) {
                    log.error(`Error processing proposals for ${action.chain_name}:`, error);
                    await this.sendErrorAlert(error as Error, `Proposal Monitoring: ${action.chain_name}`, action.chat_id);
                }
            }
        }, interval);
    }

    private async processProposal(action: Actionables, proposal: Proposal): Promise<void> {
        const result = this.database.searchIfVoted(action.chain_name, proposal.id);
        if (!result.created) {
            await this.handleNewProposal(action, proposal);
        } else if (!result.voted) {
            await this.handleUnvotedProposal(action, proposal, result);
        }
    }

    private async handleNewProposal(action: Actionables, proposal: Proposal): Promise<void> {
        const voted = await action.query.checkIfVotedByGranter(proposal.id);
        this.database.insertDataIfNotExist(
            action.chain_name,
            action.chain_id,
            proposal.id,
            proposal.voting_start_time,
            proposal.voting_end_time,
            voted
        );

        const messageId = await this.sendProposalAlerts(action, proposal, voted);
        this.database.updateMessageId(action.chain_name, proposal.id, messageId);
    }

    private async handleUnvotedProposal(
        action: Actionables,
        proposal: Proposal,
        result: { message_id: number }
    ): Promise<void> {
        const sixHoursPassed = this.database.checkIf6HoursPassed(action.chain_id, proposal.id);
        if (sixHoursPassed && result.message_id !== -1) {
            await this.sendReminder(action, proposal, result.message_id);
        } else if (result.message_id === -1) {
            const messageId = await this.sendProposalAlerts(action, proposal, false);
            this.database.updateMessageId(action.chain_name, proposal.id, messageId);
        }
    }

    private async sendReminder(action: Actionables, proposal: Proposal, messageId: number): Promise<void> {
        try {
            await this.bot.api.sendMessage(
                action.chat_id,
                `Please vote on the ${capitalize(action.chain_name)} proposal number: ${proposal.id}\n${ENV.TAG_IN_REPLAY}`,
                { reply_to_message_id: messageId }
            );
            log.info("Reminder message sent.");
        } catch (error) {
            log.error("Error sending reminder message:", error);
            await this.sendErrorAlert(error as Error, "Sending Reminder", action.chat_id);
        }
    }

    private async sendProposalAlerts(action: Actionables, proposal: Proposal, voted: boolean): Promise<number> {
        try {
            const message = this.createProposalMessage(proposal, action, voted);
            const keyboard = this.createVotingKeyboard(proposal.id, action.chain_name);

            const result = await this.bot.api.sendMessage(action.chat_id, message, {
                parse_mode: "Markdown",
                reply_markup: voted ? undefined : keyboard,
            });
            log.info(`Message sent for ${action.chain_name} Proposal ${proposal.id}`);
            return result.message_id;
        } catch (error) {
            log.error(`Error sending proposal alert: ${error}`);
            await this.sendErrorAlert(error as Error, `Sending Proposal Alert: ${action.chain_name} Proposal ${proposal.id}`, action.chat_id);
            return -1;
        }
    }

    private createProposalMessage(proposal: Proposal, action: Actionables, voted: boolean): string {
        let message = `
🗳 *New ${capitalize(action.chain_id)} Governance Proposal*

*ID*: ${proposal.id}
*Title*: ${proposal.title}

⏰ *Voting Period*
*Start*: ${new Date(proposal.voting_start_time).toUTCString()}
*End*: ${new Date(proposal.voting_end_time).toUTCString()}

[Proposal Details](${action.proposal_explorer.trim()}/${proposal.id})
`;

        if (voted) {
            message += "\n*Voted*: Yes";
        }

        return message;
    }

    private createVotingKeyboard(proposalId: string, chainName: string): InlineKeyboard {
        return new InlineKeyboard()
            .text("Yes", `${proposalId}:${chainName}:yes`)
            .text("No", `${proposalId}:${chainName}:no`)
            .row()
            .text("No with veto", `${proposalId}:${chainName}:veto`)
            .text("Abstain", `${proposalId}:${chainName}:abstain`);
    }

    private async handleVoteError(ctx: Context, error: unknown): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        log.error(`Error handling vote: ${errorMessage}`);
        await ctx.answerCallbackQuery({ text: "Error processing vote. Please try again." });
        await this.sendErrorAlert(errorMessage, "Vote Error Handling", ctx.chat?.id.toString() || '');
    }

    private async sendErrorAlert(error: Error | string, context: string, chatId: string): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : error;
        const alertMessage = `
🚨 *Bot Error Alert*

*Context*: ${context}
*Error*: ${errorMessage}
*Timestamp*: ${new Date().toISOString()}

Please check the logs for more details.
        `;

        try {
            await this.bot.api.sendMessage(chatId, alertMessage, {
                parse_mode: "Markdown",
            });
            log.info(`Error alert sent to chat: ${chatId}`);
        } catch (sendError) {
            log.error(`Failed to send error alert: ${sendError}`);
        }
    }

    public async start(): Promise<void> {
        try {
            log.info("Telegram bot started successfully");
            this.bot.start();
            await this.startProposalMonitoring();  
        } catch (error) {
            log.error("Failed to start Telegram bot:", error);
        }
    }
}
