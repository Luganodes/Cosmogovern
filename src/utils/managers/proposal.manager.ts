import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import logger from "../log";

const log = logger("manager:proposal");

interface ProposalBase {
  id: string;
  title: string;
  voting_end_time: string;
  voting_start_time: string;
}

interface ProposalV1 extends ProposalBase {}

interface ProposalV1Beta1 extends ProposalBase {
  proposal_id: string;
  content: {
    title: string;
  };
}

export type Proposal = ProposalV1 | ProposalV1Beta1;

enum ProposalStatus {
  UNSPECIFIED = 0,
  DEPOSIT_PERIOD = 1,
  VOTING_PERIOD = 2,
  PASSED = 3,
  REJECTED = 4,
  FAILED = 5,
}

interface VoteResponse {
    vote?: {
      proposal_id: string;
      voter: string;
      options: Array<{
        option: string;
        weight: string;
      }>;
      metadata: string;
    };
  }

export class VoteNotFoundError extends Error {
    constructor(public proposalId: string, public granter: string) {
      super(`Vote not found for granter ${granter} on proposal ${proposalId}`);
      this.name = 'VoteNotFoundError';
    }
  }


export class ProposalQueryManager {
    private readonly api: string;
    private v1: boolean;
    private readonly granter: string;
    private readonly timeout: number;
    private readonly maxRetries: number;
  
    constructor(apiUrl: string, granter: string, timeoutMs: number = 10000, maxRetries: number = 3) {
      if (!apiUrl || typeof apiUrl !== 'string') {
        throw new Error("Invalid API URL provided");
      }
      this.api = apiUrl.trim();
      this.granter = granter;
      this.timeout = timeoutMs;
      this.v1 =false
      this.maxRetries = maxRetries;
    }

    public async checkVersion(): Promise<void> {
      const v1Url = `${this.api}/cosmos/gov/v1/proposals?proposal_status=2`;
      const v1beta1Url = `${this.api}/cosmos/gov/v1beta1/proposals?proposal_status=2`;
      const config: AxiosRequestConfig = {
        timeout: this.timeout,
        validateStatus: (status) => status === 200 || status === 400,
      };
    
      try {
        const v1Response = await axios.get(v1Url, config);
        if (v1Response.status === 200) {
          this.v1 = true;
          log.info(`Using cosmos/gov/v1 endpoint with ${this.api}`);
          return;
        }
      } catch (error) {
        log.warn(`Error checking v1 endpoint:  ${error}`);
      }
    
      try {
        const v1beta1Response = await axios.get(v1beta1Url, config);
        if (v1beta1Response.status === 200) {
          this.v1 = false;
          log.info(`Using cosmos/gov/v1beta1 endpoint with ${this.api}`);
          return;
        }
      } catch (error) {
        log.warn(`Error checking v1beta1 endpoint: ${error}` );
      }
    
      throw new Error("Neither v1 nor v1beta1 endpoints are supported by the API");
    }

  private getProposalUrl(): string {
    return this.v1
      ? `${this.api}/cosmos/gov/v1/proposals`
      : `${this.api}/cosmos/gov/v1beta1/proposals`;
  }

  public async fetchProposals(status: ProposalStatus = ProposalStatus.VOTING_PERIOD): Promise<Proposal[]> {
    const url = `${this.getProposalUrl()}?proposal_status=${status}`;
    const config: AxiosRequestConfig = {
      timeout: this.timeout,
      validateStatus: (status) => status === 200,
    };

    try {
      const response = await axios.get(url, config);
      return this.parseProposals(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  public getMessageType(): string {
    return this.v1 ? "/cosmos.gov.v1.MsgVote" : "/cosmos.gov.v1beta1.MsgVote";
  }

  private parseProposals(data: any): Proposal[] {
    if (!data || !data.proposals || !Array.isArray(data.proposals)) {
      log.warn(`No valid proposals found in the response from: ${this.api}`);
      return [];
    }

    const proposals = data.proposals;
    log.info(`Found ${proposals.length} Proposals from: ${this.api}`);
    return this.v1 ? this.parseV1Proposals(proposals) : this.parseV1Beta1Proposals(proposals);
  }

  private parseV1Proposals(proposals: any[]): ProposalV1[] {
    return proposals.map((proposal): ProposalV1 => ({
      id: proposal.id,
      title: proposal.title,
      voting_end_time: proposal.voting_end_time,
      voting_start_time: proposal.voting_start_time,
    }));
  }

  private parseV1Beta1Proposals(proposals: any[]): ProposalV1Beta1[] {
    return proposals.map((proposal): ProposalV1Beta1 => ({
      id: proposal.proposal_id,
      proposal_id: proposal.proposal_id,
      title: proposal.content.title,
      content: { title: proposal.content.title },
      voting_end_time: proposal.voting_end_time,
      voting_start_time: proposal.voting_start_time,
    }));
  }

  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        return new Error(`API request failed: ${axiosError.response.status} ${axiosError.response.statusText}`);
      } else if (axiosError.request) {
        if (axiosError.code === 'ECONNABORTED') {
          return new Error(`Request timed out after ${this.timeout}ms: ${this.api}`);
        }
        return new Error(`No response received from the server: ${this.api}`);
      } else {
        return new Error(`Error setting up the request: ${axiosError.message}`);
      }
    }
    return error instanceof Error ? error : new Error(`An unknown error occurred: ${String(error)}`);
  }

  public async checkIfVotedByGranter(proposalId: string): Promise<boolean> {
    const url = `${this.api}/cosmos/gov/v1/proposals/${proposalId}/votes/${this.granter}`;
    const config: AxiosRequestConfig = {
      timeout: this.timeout,
      validateStatus: (status) => status === 200 || status === 400 || status === 404,
    };

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.get<VoteResponse>(url, config);
        
        if (response.status === 200 && response.data.vote) {
          log.info(`Granter ${this.granter} has voted on proposal ${proposalId}`);
          return true;
        } else if (response.status === 400 || response.status === 404) {
          log.info(`Granter ${this.granter} has not voted on proposal ${proposalId}`);
          return false;
        } else {
          throw new Error(`Unexpected response status: ${response.status}`);
        }
      } catch (error) {
        if (attempt === this.maxRetries) {
          throw this.handleVoteCheckError(error, proposalId);
        }
        log.warn(`Attempt ${attempt} failed, retrying...`);
        await this.delay(1000 * attempt); // Exponential backoff
      }
    }

    throw new Error("Unexpected error: all retries failed");
  }

  private handleVoteCheckError(error: unknown, proposalId: string): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        if (axiosError.response.status === 400 || axiosError.response.status === 404) {
          return new VoteNotFoundError(proposalId, this.granter);
        }
        return new Error(`API request failed: ${axiosError.response.status} ${axiosError.response.statusText}`);
      } else if (axiosError.request) {
        if (axiosError.code === 'ECONNABORTED') {
          return new Error(`Request timed out after ${this.timeout}ms: ${this.api}`);
        }
        return new Error(`No response received from the server: ${this.api}`);
      } else {
        return new Error(`Error setting up the request: ${axiosError.message}`);
      }
    }
    return error instanceof Error ? error : new Error(`An unknown error occurred: ${String(error)}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}