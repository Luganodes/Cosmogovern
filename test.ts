import { ProposalQueryClient, VoteNotFoundError } from "./src/utils/managers/proposal.manager";


const client = new ProposalQueryClient(
    "https://cosmos-api.polkachu.com",
    true,
    "cosmos1m902jrk0pn4yc47zfvauqwvtq0e03nen3juh82",
    30000, // 30 seconds timeout
    5 // 5 max retries
  );
const proposalId = "938";
const granter = "cosmos1qqp5aqz63nqh3lz43k3m3msv2ymxh8dzznwvjd";

try {
  const hasVoted = await client.checkIfVotedByGranter(proposalId);
  if (hasVoted) {
    console.log(`Granter ${granter} has voted on proposal ${proposalId}`);
  } else {
    console.log(`Granter ${granter} has not voted on proposal ${proposalId}`);
  }
} catch (error) {
    if (error instanceof VoteNotFoundError) {
        console.log(`Granter ${error.granter} has not voted on proposal ${error.proposalId}`);
      } else {
        console.error(`Error checking vote: ${error}`);
      }
}