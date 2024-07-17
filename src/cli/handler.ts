import logger from "../utils/log";

const log = logger("cli:handler");

const handleCommandError = (error: Error): void => {
  if (error instanceof Error) {
    log.error(error.message);
    process.exit(1);
  } else {
    log.error(error);
    process.exit(1);
  }
};

type CommandArguments = [key: string, options?: { recover?: boolean }];

export const runCommand =
  (commandFn: (...args: CommandArguments) => Promise<void>) =>
  async (...args: CommandArguments) => {
    try {
      await commandFn(...args);
    } catch (error) {
      handleCommandError(error as Error);
    }
  };
